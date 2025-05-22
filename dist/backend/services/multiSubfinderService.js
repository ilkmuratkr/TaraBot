"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processSingleDomainForMultiScan = exports.deleteMultiScanJob = exports.stopMultiScanJob = exports.resumeMultiScanJob = exports.pauseMultiScanJob = exports.getMultiScanResults = exports.updateMultiJobWithSingleScanResult = exports.getAllMultiScanJobs = exports.getMultiScanJob = exports.createMultiScanJob = exports.multiScanQueue = exports.multiScanQueueName = void 0;
const uuid_1 = require("uuid");
const redisClient_1 = require("../redisClient"); // YENİ IMPORT
const subfinderService = __importStar(require("./subfinderService")); // subfinderService fonksiyonlarını kullanmak için
const bullmq_1 = require("bullmq"); // JobData importu kaldırıldı
// Redis key önekleri
const MULTI_SUBFINDER_JOB_KEY_PREFIX = 'multiSubfinder:job:';
const MULTI_SUBFINDER_RESULTS_KEY_PREFIX = 'multiSubfinder:results:';
// SUBFINDER_RESULT_KEY_PREFIX subfinderService'den import ediliyor.
exports.multiScanQueueName = 'multiScanQueue'; // Kuyruk adını export et
exports.multiScanQueue = new bullmq_1.Queue(exports.multiScanQueueName, {
    connection: redisClient_1.redisClient,
});
console.log('multiScanQueue baglantisi kontrol:', exports.multiScanQueue.opts.connection === redisClient_1.redisClient);
function createMultiScanJob(name, domains, options = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        const id = (0, uuid_1.v4)();
        const now = new Date();
        const jobData = {
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
        yield redisClient_1.redisClient.set(MULTI_SUBFINDER_JOB_KEY_PREFIX + id, JSON.stringify(jobData));
        console.log(`Çoklu tarama işi Redis'e kaydedildi: ${id}, İsim: ${name}`);
        const bullJobsPromises = [];
        for (let i = 0; i < domains.length; i++) {
            const domain = domains[i];
            const payload = {
                multiJobId: id,
                domainToScan: domain,
                singleScanOptions: Object.assign(Object.assign({}, options), { multiJobId: id, targetDomainForMultiJob: domain }),
                originalIndex: i
            };
            console.log(`'${domain}' için BullMQ'ya iş ekleniyor (multiJobId: ${id})`);
            bullJobsPromises.push(exports.multiScanQueue.add('processDomainForMultiScan', payload));
        }
        try {
            const addedBullJobs = yield Promise.all(bullJobsPromises);
            jobData.bullJobIds = addedBullJobs.map((job) => job.id).filter((jobId) => jobId !== undefined);
            jobData.updatedAt = new Date();
            yield redisClient_1.redisClient.set(MULTI_SUBFINDER_JOB_KEY_PREFIX + id, JSON.stringify(jobData));
            console.log(`${domains.length} domain için BullMQ işleri eklendi: ${id}`);
        }
        catch (error) {
            console.error(`BullMQ'ya işler eklenirken hata oluştu (multiJobId: ${id}):`, error);
            jobData.status = 'failed';
            jobData.updatedAt = new Date();
            yield redisClient_1.redisClient.set(MULTI_SUBFINDER_JOB_KEY_PREFIX + id, JSON.stringify(jobData));
            throw error;
        }
        return jobData;
    });
}
exports.createMultiScanJob = createMultiScanJob;
function getMultiScanJob(id) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield redisClient_1.redisClient.get(MULTI_SUBFINDER_JOB_KEY_PREFIX + id);
        return data ? JSON.parse(data) : null;
    });
}
exports.getMultiScanJob = getMultiScanJob;
function getAllMultiScanJobs() {
    return __awaiter(this, void 0, void 0, function* () {
        const keys = yield redisClient_1.redisClient.keys(MULTI_SUBFINDER_JOB_KEY_PREFIX + '*');
        const jobsData = [];
        if (keys.length === 0)
            return jobsData;
        const pipeline = redisClient_1.redisClient.pipeline();
        keys.forEach(key => pipeline.get(key));
        const results = yield pipeline.exec();
        results === null || results === void 0 ? void 0 : results.forEach((result) => {
            if (result && result[1]) {
                jobsData.push(JSON.parse(result[1]));
            }
        });
        return jobsData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    });
}
exports.getAllMultiScanJobs = getAllMultiScanJobs;
function updateMultiJobWithSingleScanResult(multiJobId, domain, singleScanId, scanStatus, errorMessage, foundSubdomainsCount) {
    return __awaiter(this, void 0, void 0, function* () {
        const multiJob = yield getMultiScanJob(multiJobId);
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
                    const singleScanResults = yield subfinderService.getSubfinderResults(singleScanId, 0, 100000);
                    if (singleScanResults && singleScanResults.length > 0) {
                        const currentMultiResultsRaw = yield redisClient_1.redisClient.get(MULTI_SUBFINDER_RESULTS_KEY_PREFIX + multiJobId);
                        const currentMultiResults = currentMultiResultsRaw ? JSON.parse(currentMultiResultsRaw) : [];
                        const uniqueNewResults = singleScanResults.filter(newRes => !currentMultiResults.some(existingRes => existingRes.host === newRes.host));
                        if (uniqueNewResults.length > 0) {
                            const combinedResults = [...currentMultiResults, ...uniqueNewResults];
                            yield redisClient_1.redisClient.set(MULTI_SUBFINDER_RESULTS_KEY_PREFIX + multiJobId, JSON.stringify(combinedResults));
                            console.log(`${uniqueNewResults.length} yeni benzersiz sonuç ${multiJobId} için birleştirilmiş sonuçlara eklendi.`);
                        }
                        else {
                            console.log(`Tekil tarama (${singleScanId}) sonuçları zaten ${multiJobId} içinde mevcut veya boş.`);
                        }
                    }
                    else {
                        console.log(`Tekil tarama (${singleScanId}) için getSubfinderResults boş veya tanımsız sonuç döndürdü.`);
                    }
                }
                catch (getResultsError) {
                    console.error(`[${multiJobId}] getSubfinderResults (${singleScanId}) çağrılırken veya sonuçlar işlenirken HATA:`, getResultsError);
                    if (multiJob.completedDomainScans[domain]) {
                        multiJob.completedDomainScans[domain].error = (multiJob.completedDomainScans[domain].error || "") +
                            `; Sonuçlar birleştirilirken hata: ${getResultsError.message}`.substring(0, 200);
                    }
                }
            }
        }
        else {
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
        multiJob.currentDomainIndex = completedOrFailedCount - 1;
        multiJob.updatedAt = new Date();
        if (multiJob.status === 'pending' && completedOrFailedCount > 0) {
            multiJob.status = 'running';
        }
        if (completedOrFailedCount === multiJob.domains.length) {
            multiJob.status = 'completed';
            console.log(`Çoklu tarama işi tamamlandı: ${multiJobId}`);
        }
        yield redisClient_1.redisClient.set(MULTI_SUBFINDER_JOB_KEY_PREFIX + multiJobId, JSON.stringify(multiJob));
        console.log(`MultiJob Redis'te güncellendi (${multiJobId}), İlerleme: ${multiJob.overallProgress}%`);
        return multiJob;
    });
}
exports.updateMultiJobWithSingleScanResult = updateMultiJobWithSingleScanResult;
function getMultiScanResults(id, page = 0, limit = 100) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield redisClient_1.redisClient.get(MULTI_SUBFINDER_RESULTS_KEY_PREFIX + id);
        if (data) {
            const results = JSON.parse(data);
            const startIndex = page * limit;
            return results.slice(startIndex, startIndex + limit);
        }
        return [];
    });
}
exports.getMultiScanResults = getMultiScanResults;
function pauseMultiScanJob(id) {
    return __awaiter(this, void 0, void 0, function* () {
        const job = yield getMultiScanJob(id);
        if (!job || job.status !== 'running') {
            console.warn(`Durdurulacak aktif bir çoklu tarama işi bulunamadı veya zaten durdurulmuş/tamamlanmış: ${id}`);
            return job;
        }
        job.status = 'paused';
        job.updatedAt = new Date();
        yield redisClient_1.redisClient.set(MULTI_SUBFINDER_JOB_KEY_PREFIX + id, JSON.stringify(job));
        console.log(`Çoklu tarama işi duraklatıldı: ${id}`);
        if (job.bullJobIds) {
            for (const bullJobId of job.bullJobIds) {
                try {
                    const bullJobInstance = yield exports.multiScanQueue.getJob(bullJobId);
                    if (bullJobInstance && ((yield bullJobInstance.isActive()) || (yield bullJobInstance.isWaiting()))) {
                        console.log(`BullMQ işi ${bullJobId} için manuel duraklatma mantığı (worker'da kontrol edilecek).`);
                    }
                }
                catch (error) {
                    console.error(`BullMQ işi ${bullJobId} bilgileri alınırken hata:`, error);
                }
            }
        }
        return job;
    });
}
exports.pauseMultiScanJob = pauseMultiScanJob;
function resumeMultiScanJob(id) {
    return __awaiter(this, void 0, void 0, function* () {
        const job = yield getMultiScanJob(id);
        if (!job || job.status !== 'paused') {
            console.warn(`Devam ettirilecek duraklatılmış bir çoklu tarama işi bulunamadı: ${id}`);
            return job;
        }
        job.status = 'running';
        job.updatedAt = new Date();
        yield redisClient_1.redisClient.set(MULTI_SUBFINDER_JOB_KEY_PREFIX + id, JSON.stringify(job));
        console.log(`Çoklu tarama işi devam ettiriliyor: ${id}`);
        console.log(`BullMQ işleri için devam ettirme mantığı (worker'lar durumu kontrol edecek) (multiJobId: ${id})`);
        return job;
    });
}
exports.resumeMultiScanJob = resumeMultiScanJob;
function stopMultiScanJob(id) {
    return __awaiter(this, void 0, void 0, function* () {
        const job = yield getMultiScanJob(id);
        if (!job || job.status === 'completed' || job.status === 'failed' || job.status === 'stopping') {
            console.warn(`Durdurulacak uygun durumda bir çoklu tarama işi bulunamadı: ${id}, Durum: ${job === null || job === void 0 ? void 0 : job.status}`);
            return job;
        }
        job.status = 'stopping';
        job.updatedAt = new Date();
        yield redisClient_1.redisClient.set(MULTI_SUBFINDER_JOB_KEY_PREFIX + id, JSON.stringify(job));
        console.log(`Çoklu tarama işi durduruluyor (stopping): ${id}`);
        if (job.bullJobIds) {
            for (const bullJobId of job.bullJobIds) {
                try {
                    const bullJobInstance = yield exports.multiScanQueue.getJob(bullJobId);
                    if (bullJobInstance && ((yield bullJobInstance.isActive()) || (yield bullJobInstance.isWaiting()) || (yield bullJobInstance.isDelayed()))) {
                        yield bullJobInstance.remove();
                        console.log(`BullMQ işi ${bullJobId} kaldırıldı.`);
                    }
                }
                catch (error) {
                    console.error(`BullMQ işi ${bullJobId} kaldırılırken hata:`, error);
                }
            }
        }
        job.status = 'failed';
        job.updatedAt = new Date();
        yield redisClient_1.redisClient.set(MULTI_SUBFINDER_JOB_KEY_PREFIX + id, JSON.stringify(job));
        console.log(`Çoklu tarama işi durduruldu (artık ${job.status}): ${id}`);
        return job;
    });
}
exports.stopMultiScanJob = stopMultiScanJob;
function deleteMultiScanJob(id) {
    return __awaiter(this, void 0, void 0, function* () {
        const job = yield getMultiScanJob(id);
        if (!job) {
            console.warn(`Silinecek çoklu tarama işi bulunamadı: ${id}`);
            return false;
        }
        if (job.status === 'running' || job.status === 'paused' || job.status === 'pending' || job.status === 'stopping') {
            yield stopMultiScanJob(id);
        }
        yield redisClient_1.redisClient.del(MULTI_SUBFINDER_JOB_KEY_PREFIX + id);
        yield redisClient_1.redisClient.del(MULTI_SUBFINDER_RESULTS_KEY_PREFIX + id);
        console.log(`Çoklu tarama işi ve sonuçları Redis'ten silindi: ${id}`);
        return true;
    });
}
exports.deleteMultiScanJob = deleteMultiScanJob;
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
function processSingleDomainForMultiScan(job) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`processSingleDomainForMultiScan işleniyor: ${job.id}, Domain: ${job.data.domainToScan}`);
        if (!job.data || !job.data.multiJobId || !job.data.domainToScan || !job.data.singleScanOptions) {
            console.error(`[Worker ${job.id}] Eksik iş verisi:`, job.data);
            yield job.moveToFailed(new Error(`[Worker ${job.id}] Eksik iş verisi`), 'worker:missing_data_token'); // Token eklendi
            return;
        }
        const { multiJobId, domainToScan, singleScanOptions } = job.data;
        try {
            const singleScanJob = yield subfinderService.createSubfinderScan(domainToScan, singleScanOptions);
            console.log(`[Worker ${job.id}] Tekil tarama oluşturuldu: ${singleScanJob.id} for domain ${domainToScan}`);
            yield subfinderService.startSubfinderScan(singleScanJob.id);
            console.log(`[Worker ${job.id}] Tekil tarama başlatıldı: ${singleScanJob.id}`);
        }
        catch (error) {
            console.error(`[Worker ${job.id}] Tekil domain (${domainToScan}) işlenirken hata:`, error);
            yield job.moveToFailed(new Error(`[Worker ${job.id}] Domain (${domainToScan}) işlenirken hata: ${error.message}`), 'worker:processing_error_token'); // Token eklendi
            yield updateMultiJobWithSingleScanResult(multiJobId, domainToScan, "N/A", 'failed', error.message);
        }
    });
}
exports.processSingleDomainForMultiScan = processSingleDomainForMultiScan;
//# sourceMappingURL=multiSubfinderService.js.map