import { v4 as uuidv4 } from 'uuid';
import { redisClient } from '../redisClient'; // YENİ IMPORT
import { 
  SubfinderOptions, 
  SubfinderResult, 
  MultiSubfinderJobData,
  SubfinderJobData // Tekil tarama sonuçlarını almak için
} from './subfinderService'; // subfinderService'ten arayüzleri import et
import * as subfinderService from './subfinderService'; // subfinderService fonksiyonlarını kullanmak için
import { Queue, Job, Worker } from 'bullmq'; // JobData importu kaldırıldı

// MultiScanJob için BullMQ iş yükü arayüzü
export interface MultiScanJobPayload { // JobData extend kaldırıldı, EXPORT EKLENDİ
  multiJobId: string;
  domainToScan: string;
  singleScanOptions: SubfinderOptions;
  originalIndex: number; 
}

// Redis key önekleri
const MULTI_SUBFINDER_JOB_KEY_PREFIX = 'multiSubfinder:job:';
const MULTI_SUBFINDER_RESULTS_KEY_PREFIX = 'multiSubfinder:results:';
// SUBFINDER_RESULT_KEY_PREFIX subfinderService'den import ediliyor.

export const multiScanQueueName = 'multiScanQueue'; // Kuyruk adını export et
export const multiScanQueue = new Queue<MultiScanJobPayload>(multiScanQueueName, { // Export edilen adı kullan
  connection: redisClient,
});

console.log('multiScanQueue baglantisi kontrol:', multiScanQueue.opts.connection === redisClient);

export async function createMultiScanJob(
  name: string,
  domains: string[],
  options: SubfinderOptions = {}
): Promise<MultiSubfinderJobData> {
  const id = uuidv4();
  const now = new Date();

  const jobData: MultiSubfinderJobData = {
    id,
    name,
    domains,
    options,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    currentDomainIndex: -1,
    completedDomainScans: {},
    overallProgress: 0,
    totalSubdomainsFound: 0,
    bullJobIds: [],
  };

  await redisClient.set(MULTI_SUBFINDER_JOB_KEY_PREFIX + id, JSON.stringify(jobData));
  console.log(`Çoklu tarama işi Redis'e kaydedildi: ${id}, İsim: ${name}`);

  const bullJobsPromises: Promise<Job<MultiScanJobPayload, any, string>>[] = [];
  for (let i = 0; i < domains.length; i++) {
    const domain = domains[i];
    const payload: MultiScanJobPayload = {
        multiJobId: id,
        domainToScan: domain,
        singleScanOptions: { 
            ...options, 
            multiJobId: id, // singleScanOptions'a da ekleyelim ki subfinderService içinde erişilebilsin
            targetDomainForMultiJob: domain 
        },
        originalIndex: i
    };
    
    console.log(`'${domain}' için BullMQ'ya iş ekleniyor (multiJobId: ${id})`);
    bullJobsPromises.push(
      multiScanQueue.add('processDomainForMultiScan', payload)
    );
  }

  try {
    const addedBullJobs = await Promise.all(bullJobsPromises);
    jobData.bullJobIds = addedBullJobs.map((job: Job<MultiScanJobPayload, any, string>) => job.id).filter((jobId: string | undefined): jobId is string => jobId !== undefined);
    jobData.updatedAt = new Date();
    await redisClient.set(MULTI_SUBFINDER_JOB_KEY_PREFIX + id, JSON.stringify(jobData));
    console.log(`${domains.length} domain için BullMQ işleri eklendi: ${id}`);
  } catch (error) {
    console.error(`BullMQ'ya işler eklenirken hata oluştu (multiJobId: ${id}):`, error);
    jobData.status = 'failed';
    jobData.updatedAt = new Date();
    await redisClient.set(MULTI_SUBFINDER_JOB_KEY_PREFIX + id, JSON.stringify(jobData));
    throw error;
  }

  return jobData;
}

export async function getMultiScanJob(id: string): Promise<MultiSubfinderJobData | null> {
  const data = await redisClient.get(MULTI_SUBFINDER_JOB_KEY_PREFIX + id);
  return data ? JSON.parse(data) as MultiSubfinderJobData : null;
}

export async function getAllMultiScanJobs(): Promise<MultiSubfinderJobData[]> {
  const keys = await redisClient.keys(MULTI_SUBFINDER_JOB_KEY_PREFIX + '*');
  const jobsData: MultiSubfinderJobData[] = [];
  if (keys.length === 0) return jobsData;

  const pipeline = redisClient.pipeline();
  keys.forEach(key => pipeline.get(key));
  const results = await pipeline.exec() as [Error | null, string | null][];

  results?.forEach((result: [Error | null, string | null]) => {
    if (result && result[1]) {
      jobsData.push(JSON.parse(result[1] as string));
    }
  });
  return jobsData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function updateMultiJobWithSingleScanResult(
  multiJobId: string,
  domain: string, 
  singleScanId: string, 
  scanStatus: 'completed' | 'failed',
  errorMessage?: string,
  foundSubdomainsCount?: number
): Promise<MultiSubfinderJobData | null> {
  const multiJob = await getMultiScanJob(multiJobId);
  if (!multiJob) {
    console.error(`updateMultiJobWithSingleScanResult: MultiJob bulunamadı: ${multiJobId}`);
    return null;
  }

  console.log(`MultiJob güncelleniyor (${multiJobId}) - Domain: ${domain}, Tekil Tarama ID: ${singleScanId}, Durum: ${scanStatus}`);

  if (scanStatus === 'completed') {
    multiJob.completedDomainScans[domain] = {
      scanId: singleScanId,
      resultCount: foundSubdomainsCount || 0,
      status: 'completed',
    };
    multiJob.totalSubdomainsFound += (foundSubdomainsCount || 0);

    if (foundSubdomainsCount && foundSubdomainsCount > 0) {
      try {
        const singleScanResults = await subfinderService.getSubfinderResults(singleScanId, 0, 100000);
        if (singleScanResults && singleScanResults.length > 0) {
          const currentMultiResultsRaw = await redisClient.get(MULTI_SUBFINDER_RESULTS_KEY_PREFIX + multiJobId);
          const currentMultiResults: SubfinderResult[] = currentMultiResultsRaw ? JSON.parse(currentMultiResultsRaw) : [];
          
          const uniqueNewResults = singleScanResults.filter(
            newRes => !currentMultiResults.some(existingRes => existingRes.host === newRes.host)
          );

          if (uniqueNewResults.length > 0) {
            const combinedResults = [...currentMultiResults, ...uniqueNewResults];
            await redisClient.set(MULTI_SUBFINDER_RESULTS_KEY_PREFIX + multiJobId, JSON.stringify(combinedResults));
            console.log(`${uniqueNewResults.length} yeni benzersiz sonuç ${multiJobId} için birleştirilmiş sonuçlara eklendi.`);
          } else {
            console.log(`Tekil tarama (${singleScanId}) sonuçları zaten ${multiJobId} içinde mevcut veya boş.`);
          }
        } else {
           console.log(`Tekil tarama (${singleScanId}) için getSubfinderResults boş veya tanımsız sonuç döndürdü.`);
        }
      } catch (getResultsError: any) {
        console.error(`[${multiJobId}] getSubfinderResults (${singleScanId}) çağrılırken veya sonuçlar işlenirken HATA:`, getResultsError);
        if (multiJob.completedDomainScans[domain]) {
            multiJob.completedDomainScans[domain].error = (multiJob.completedDomainScans[domain].error || "") + 
                `; Sonuçlar birleştirilirken hata: ${getResultsError.message}`.substring(0, 200);
        }
      }
    }
  } else {
    multiJob.completedDomainScans[domain] = {
      scanId: singleScanId,
      resultCount: 0,
      status: 'failed',
      error: errorMessage || 'Bilinmeyen bir hata oluştu.',
    };
    console.warn(`Tekil tarama başarısız oldu (${domain}, multiJobId: ${multiJobId}): ${errorMessage}`);
  }
  
  const completedOrFailedCount = Object.keys(multiJob.completedDomainScans).length;
  multiJob.overallProgress = Math.round((completedOrFailedCount / multiJob.domains.length) * 100);
  multiJob.currentDomainIndex = completedOrFailedCount -1;
  multiJob.updatedAt = new Date();

  if (multiJob.status === 'pending' && completedOrFailedCount > 0) {
    multiJob.status = 'running';
  }

  if (completedOrFailedCount === multiJob.domains.length) {
    multiJob.status = 'completed';
    console.log(`Çoklu tarama işi tamamlandı: ${multiJobId}`);
  }

  await redisClient.set(MULTI_SUBFINDER_JOB_KEY_PREFIX + multiJobId, JSON.stringify(multiJob));
  console.log(`MultiJob Redis'te güncellendi (${multiJobId}), İlerleme: ${multiJob.overallProgress}%`);
  return multiJob;
}

export async function getMultiScanResults(
  id: string,
  page = 0,
  limit = 100
): Promise<SubfinderResult[]> {
  const data = await redisClient.get(MULTI_SUBFINDER_RESULTS_KEY_PREFIX + id);
  if (data) {
    const results: SubfinderResult[] = JSON.parse(data);
    const startIndex = page * limit;
    return results.slice(startIndex, startIndex + limit);
  }
  return [];
}

export async function pauseMultiScanJob(id: string): Promise<MultiSubfinderJobData | null> {
  const job = await getMultiScanJob(id);
  if (!job || job.status !== 'running') {
    console.warn(`Durdurulacak aktif bir çoklu tarama işi bulunamadı veya zaten durdurulmuş/tamamlanmış: ${id}`);
    return job;
  }
  job.status = 'paused';
  job.updatedAt = new Date();
  await redisClient.set(MULTI_SUBFINDER_JOB_KEY_PREFIX + id, JSON.stringify(job));
  console.log(`Çoklu tarama işi duraklatıldı: ${id}`);
  
  if (job.bullJobIds) {
    for (const bullJobId of job.bullJobIds) {
      try {
        const bullJobInstance = await multiScanQueue.getJob(bullJobId);
        if (bullJobInstance && (await bullJobInstance.isActive() || await bullJobInstance.isWaiting())) {
          console.log(`BullMQ işi ${bullJobId} için manuel duraklatma mantığı (worker'da kontrol edilecek).`);
        }
      } catch (error) {
        console.error(`BullMQ işi ${bullJobId} bilgileri alınırken hata:`, error);
      }
    }
  }
  return job;
}

export async function resumeMultiScanJob(id: string): Promise<MultiSubfinderJobData | null> {
  const job = await getMultiScanJob(id);
  if (!job || job.status !== 'paused') {
    console.warn(`Devam ettirilecek duraklatılmış bir çoklu tarama işi bulunamadı: ${id}`);
    return job;
  }
  job.status = 'running';
  job.updatedAt = new Date();
  await redisClient.set(MULTI_SUBFINDER_JOB_KEY_PREFIX + id, JSON.stringify(job));
  console.log(`Çoklu tarama işi devam ettiriliyor: ${id}`);
  console.log(`BullMQ işleri için devam ettirme mantığı (worker'lar durumu kontrol edecek) (multiJobId: ${id})`);
  return job;
}

export async function stopMultiScanJob(id: string): Promise<MultiSubfinderJobData | null> {
    const job = await getMultiScanJob(id);
    if (!job || job.status === 'completed' || job.status === 'failed' || job.status === 'stopping') {
      console.warn(`Durdurulacak uygun durumda bir çoklu tarama işi bulunamadı: ${id}, Durum: ${job?.status}`);
      return job;
    }
    
    job.status = 'stopping';
    job.updatedAt = new Date();
    await redisClient.set(MULTI_SUBFINDER_JOB_KEY_PREFIX + id, JSON.stringify(job));
    console.log(`Çoklu tarama işi durduruluyor (stopping): ${id}`);

    if (job.bullJobIds) {
        for (const bullJobId of job.bullJobIds) {
            try {
                const bullJobInstance = await multiScanQueue.getJob(bullJobId);
                if (bullJobInstance && (await bullJobInstance.isActive() || await bullJobInstance.isWaiting() || await bullJobInstance.isDelayed())) {
                    await bullJobInstance.remove();
                    console.log(`BullMQ işi ${bullJobId} kaldırıldı.`);
                }
            } catch (error) {
                console.error(`BullMQ işi ${bullJobId} kaldırılırken hata:`, error);
            }
        }
    }
    
    job.status = 'failed'; 
    job.updatedAt = new Date();
    await redisClient.set(MULTI_SUBFINDER_JOB_KEY_PREFIX + id, JSON.stringify(job));
    console.log(`Çoklu tarama işi durduruldu (artık ${job.status}): ${id}`);
    return job;
}

export async function deleteMultiScanJob(id: string): Promise<boolean> {
  const job = await getMultiScanJob(id);
  if (!job) {
    console.warn(`Silinecek çoklu tarama işi bulunamadı: ${id}`);
    return false;
  }

  if (job.status === 'running' || job.status === 'paused' || job.status === 'pending' || job.status === 'stopping') {
      await stopMultiScanJob(id);
  }

  await redisClient.del(MULTI_SUBFINDER_JOB_KEY_PREFIX + id);
  await redisClient.del(MULTI_SUBFINDER_RESULTS_KEY_PREFIX + id);
  
  console.log(`Çoklu tarama işi ve sonuçları Redis'ten silindi: ${id}`);
  return true;
}

// YORUM SATIRI: processDomainForMultiScanWorker fonksiyonu artık kullanılmıyor, processSingleDomainForMultiScan kullanılacak.
/*
export async function processDomainForMultiScanWorker(job: Job<MultiScanJobPayload, any, string>): Promise<void> {
  const { multiJobId, domainToScan, singleScanOptions, originalIndex } = job.data;
  console.log(`WORKER: İş alındı - MultiJobID: ${multiJobId}, Domain: ${domainToScan}, Index: ${originalIndex}`);

  if (!multiJobId || !domainToScan || !singleScanOptions) {
    console.error('WORKER: Eksik iş verisi!', job.data);
    await job.moveToFailed(new Error('Eksik iş verisi'), 'worker:generic_token_1'); // Token eklendi
    return;
  }
  
  let singleScanJob: SubfinderJobData | null = null;
  try {
    singleScanJob = await subfinderService.createSubfinderScan(domainToScan, singleScanOptions);
    console.log(`Tekil tarama oluşturuldu: ${singleScanJob.id} (domain: ${domainToScan}, multiJobId: ${multiJobId})`);
    await subfinderService.startSubfinderScan(singleScanJob.id);
    console.log(`Tekil tarama başlatıldı: ${singleScanJob.id}`);
    console.log(`WORKER: ${domainToScan} için tarama başlatıldı. Sonuç runSubfinderScan tarafından işlenecek.`);
  } catch (error: any) {
    console.error(`WORKER: Tarama sırasında hata (${domainToScan}, multiJobId: ${multiJobId}):`, error);
    await job.moveToFailed(new Error(error.message || 'Bilinmeyen hata'), 'worker:generic_token_2'); // Token eklendi
    if (singleScanJob) {
        const failedScanData = await subfinderService.getSubfinderScan(singleScanJob.id);
        if (failedScanData) {
            failedScanData.status = 'failed';
            failedScanData.error = error.message || 'Worker hatası';
            await redisClient.set(subfinderService.SUBFINDER_KEY_PREFIX + singleScanJob.id, JSON.stringify(failedScanData));
        }
        await updateMultiJobWithSingleScanResult(multiJobId, domainToScan, singleScanJob.id, 'failed', error.message || 'Worker hatası');
    } else {
        const multiJob = await getMultiScanJob(multiJobId);
        if (multiJob) {
            multiJob.completedDomainScans[domainToScan] = {
                scanId: 'N/A_WORKER_ERROR',
                resultCount: 0,
                status: 'failed',
                error: `Worker hatası (tekil tarama oluşturulamadı): ${error.message || 'Bilinmeyen hata'}`
            };
            const completedOrFailedCount = Object.keys(multiJob.completedDomainScans).length;
            multiJob.overallProgress = Math.round((completedOrFailedCount / multiJob.domains.length) * 100);
            multiJob.updatedAt = new Date();
            if (completedOrFailedCount === multiJob.domains.length) multiJob.status = 'completed';
            await redisClient.set(MULTI_SUBFINDER_JOB_KEY_PREFIX + multiJobId, JSON.stringify(multiJob));
        }
    }
  }
}
*/

export async function processSingleDomainForMultiScan(job: Job<MultiScanJobPayload>): Promise<void> {
  console.log(`processSingleDomainForMultiScan işleniyor: ${job.id}, Domain: ${job.data.domainToScan}`);
  
  if (!job.data || !job.data.multiJobId || !job.data.domainToScan || !job.data.singleScanOptions) {
    console.error(`[Worker ${job.id}] Eksik iş verisi:`, job.data);
    await job.moveToFailed(new Error(`[Worker ${job.id}] Eksik iş verisi`), 'worker:missing_data_token'); // Token eklendi
    return;
  }

  const { multiJobId, domainToScan, singleScanOptions } = job.data;

  try {
    const singleScanJob = await subfinderService.createSubfinderScan(domainToScan, singleScanOptions);
    console.log(`[Worker ${job.id}] Tekil tarama oluşturuldu: ${singleScanJob.id} for domain ${domainToScan}`);
    await subfinderService.startSubfinderScan(singleScanJob.id);
    console.log(`[Worker ${job.id}] Tekil tarama başlatıldı: ${singleScanJob.id}`);
  } catch (error: any) {
    console.error(`[Worker ${job.id}] Tekil domain (${domainToScan}) işlenirken hata:`, error);
    await job.moveToFailed(new Error(`[Worker ${job.id}] Domain (${domainToScan}) işlenirken hata: ${error.message}`), 'worker:processing_error_token'); // Token eklendi
    await updateMultiJobWithSingleScanResult(
      multiJobId,
      domainToScan,
      "N/A", 
      'failed',
      error.message
    );
  }
}
