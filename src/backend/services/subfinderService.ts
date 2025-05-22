import { exec } from 'child_process';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { redisClient } from '../redisClient';
import fetch, { RequestInit } from 'node-fetch';
import dns from 'dns';
import * as multiSubfinderService from './multiSubfinderService'; // Çoklu tarama servisini import et

const execAsync = promisify(exec);

// Redis key önekleri (Export ediliyor)
export const SUBFINDER_KEY_PREFIX = 'subfinder:';
export const SUBFINDER_RESULT_KEY_PREFIX = 'subfinder:result:';

// Yeni Redis key önekleri (Çoklu Tarama için) - Bunlar multiSubfinderService.ts'de kalmalı
// const MULTI_SUBFINDER_JOB_KEY_PREFIX = 'multiSubfinder:job:'; 
// const MULTI_SUBFINDER_RESULTS_KEY_PREFIX = 'multiSubfinder:results:';

// Varsayılan değerler
const DEFAULT_TIMEOUT_SUBFINDER_MAIN = 300; // 5 dakika
const DEFAULT_THREADS = 10;
const DEFAULT_RESOLVERS = ['1.1.1.1', '8.8.8.8', '9.9.9.9'];
const DEFAULT_TIMEOUT_PERMUTATION = 120; // 2 dakika
const DEFAULT_TIMEOUT_DNS_DEEP_DIVE = 600; // 10 dakika

// SubFinder taraması için seçenekler
export interface SubfinderOptions {
  timeout?: number;         // İstek zaman aşımı (saniye)
  // concurrency?: number;     // Eşzamanlı işlem sayısı - threads olarak adlandırıldı
  threads?: number;         // Eşzamanlı işlem sayısı (Subfinder -t parametresi)
  resolvers?: string[];     // DNS sunucuları
  outputFormat?: 'json' | 'text'; // Çıktı formatı
  onlyActive?: boolean;     // Sadece aktif subdomainleri göster (-nW)
  usePassive?: boolean;      // Sadece pasif kaynakları kullan (-passive) - Subfinder'da -passive diye bir flag var
  useActiveNetwork?: boolean; // Aktif ağ kontrolleri yap (örn: -active ile DNS çözünürlüğü)
  useAllSources?: boolean;   // Tüm kaynakları kullan (-all)
  verbose?: boolean;        // Detaylı çıktı
  usePermutations?: boolean; // Alt domain permütasyonlarını kullan
  useRecursive?: boolean;   // Alt domainler için özyinelemeli tarama yap
  deepDnsSearch?: boolean;  // Derinlemesine DNS kayıtlarını araştır
  useWaybackMachine?: boolean; // Wayback Machine arşivlerini kullan
  permutationMode?: 'short' | 'full'; // Permütasyon modu
  multiJobId?: string; 
  targetDomainForMultiJob?: string; 
}

// SubFinder tarama durumu ve verileri
export interface SubfinderJobData {
  id: string;
  domain: string;
  createdAt: Date;
  options: SubfinderOptions;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped';
  progress?: {
    total: number;
    current: number;
    percent: number;
  };
  result?: SubfinderResult[]; // Bu genellikle SUBFINDER_RESULT_KEY_PREFIX altında saklanır
  error?: string;
  multiJobId?: string; 
}

// SubFinder sonuç veri yapısı
export interface SubfinderResult {
  host: string;
  source?: string[] | string;
  ip?: string;
  input?: string;
}

// Çoklu SubFinder Tarama İşi Veri Yapısı
export interface MultiSubfinderJobData {
  id: string;
  name: string;
  domains: string[];
  options: SubfinderOptions; // Tüm domainler için ortak seçenekler
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'stopping';
  createdAt: Date;
  updatedAt: Date;
  currentDomainIndex: number; // Şu anda işlenen veya en son işlenen domainin indeksi
  // Tamamlanan her bir domain taramasının detayları
  completedDomainScans: { 
    [domain: string]: {
      scanId: string; // Tekil SubfinderJobData ID'si
      resultCount: number;
      status: 'completed' | 'failed'; // Tekil taramanın sonucu
      error?: string; // Eğer tekil tarama başarısızsa
    } 
  };
  // Hata veren domainler ve hata mesajları
  // failedDomains: { [domain: string]: string }; // completedDomainScans içinde yönetilecek
  overallProgress: number;
  totalSubdomainsFound: number;
  // BullMQ iş ID'leri (opsiyonel, duraklatma/devam ettirme için)
  bullJobIds?: string[]; 
}

// SubFinder'ın kurulu olup olmadığını kontrol et
async function isSubfinderInstalled(): Promise<boolean> {
  try {
    await execAsync('subfinder -version'); // which subfinder yerine -version daha iyi bir kontrol olabilir
    return true;
  } catch (error) {
    console.error("Subfinder kurulu değil veya PATH'de bulunamıyor.", error);
    return false;
  }
}

// Yeni bir SubFinder taraması oluştur
export async function createSubfinderScan(
  domain: string,
  options: SubfinderOptions = {}
): Promise<SubfinderJobData> {
  const id = uuidv4();
  const job: SubfinderJobData = {
    id,
    domain,
    createdAt: new Date(),
    options: { // Varsayılanları burada da atayabiliriz veya constructSubfinderCommand içinde
        timeout: options.timeout || DEFAULT_TIMEOUT_SUBFINDER_MAIN,
        threads: options.threads || DEFAULT_THREADS,
        resolvers: options.resolvers || [...DEFAULT_RESOLVERS],
        ...options, // Kullanıcının girdiği seçenekler varsayılanları ezer
    },
    status: 'pending',
    multiJobId: options.multiJobId // multiJobId'yi options'dan al
  };
  await redisClient.set(SUBFINDER_KEY_PREFIX + id, JSON.stringify(job));
  return job;
}

// SubFinder taramasını başlat
export async function startSubfinderScan(id: string): Promise<SubfinderJobData | null> {
  const jobData = await getSubfinderScan(id);
  if (!jobData) {
    console.error(`startSubfinderScan: Başlatılacak iş bulunamadı: ${id}`);
    return null;
  }

  if (jobData.status === 'running') {
    console.warn(`startSubfinderScan: İş zaten çalışıyor: ${id}`);
    return jobData;
  }

  jobData.status = 'running';
  await redisClient.set(SUBFINDER_KEY_PREFIX + id, JSON.stringify(jobData));

  // Taramayı asenkron olarak başlat, multiJobId'yi ve domain bilgisini de geçir
  runSubfinderScan(id, jobData).catch(async error => {
    console.error(`SubFinder taraması (${id}) çalıştırılırken hata:`, error);
    const updatedJob = await getSubfinderScan(id);
    if (updatedJob) {
      updatedJob.status = 'failed';
      updatedJob.error = error instanceof Error ? error.message : String(error);
      await redisClient.set(SUBFINDER_KEY_PREFIX + id, JSON.stringify(updatedJob));
      
      // Eğer çoklu tarama işinin bir parçasıysa, ana işi de güncelle
      if (updatedJob.multiJobId && updatedJob.options.targetDomainForMultiJob) {
        await multiSubfinderService.updateMultiJobWithSingleScanResult(
          updatedJob.multiJobId,
          updatedJob.options.targetDomainForMultiJob,
          id,
          'failed',
          updatedJob.error
        );
      }
    }
  });

  return jobData;
}

// SubFinder taramasını durdur
export async function stopSubfinderScan(id: string): Promise<SubfinderJobData | null> {
  const jobData = await getSubfinderScan(id);
  if (!jobData) return null;

  if (jobData.status !== 'running') {
    return jobData;
  }

  // Tarama durumunu güncelle
  jobData.status = 'stopped';
  await redisClient.set(SUBFINDER_KEY_PREFIX + id, JSON.stringify(jobData));

  // Bu noktada taramayı durduracak bir işlem yapılabilir
  // Şu anda tarama zaten tamamlanmış veya hata vermiş olabilir

  return jobData;
}

// Tüm SubFinder taramalarını getir
export async function getAllSubfinderScans(): Promise<SubfinderJobData[]> {
  const keys = await redisClient.keys(SUBFINDER_KEY_PREFIX + '*');
  const jobKeys = keys.filter((key: string) => !key.startsWith(SUBFINDER_RESULT_KEY_PREFIX)); // Sadece iş anahtarlarını al, sonuç anahtarlarını dışla
  
  const scans: SubfinderJobData[] = [];
  for (const key of jobKeys) { // jobKeys olarak düzeltildi
    const data = await redisClient.get(key);
    if (data) {
      const scanJob = JSON.parse(data) as SubfinderJobData;
      // Sadece multiJobId'si olmayan (yani bağımsız tekil taramalar) işleri listeye ekle
      if (!scanJob.multiJobId) {
        scans.push(scanJob);
      }
    }
  }
  
  return scans.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// Belirli bir SubFinder taramasını getir
export async function getSubfinderScan(id: string): Promise<SubfinderJobData | null> {
  const data = await redisClient.get(SUBFINDER_KEY_PREFIX + id);
  return data ? JSON.parse(data) : null;
}

// SubFinder tarama sonuçlarını getir
export async function getSubfinderResults(
  id: string,
  page = 0,
  limit = 100
): Promise<SubfinderResult[]> {
  console.log(`getSubfinderResults çağrıldı (${id}) - Redis'ten okumadan ÖNCE`);
  const data = await redisClient.get(SUBFINDER_RESULT_KEY_PREFIX + id);
  console.log(`getSubfinderResults (${id}) - Redis'ten okuduktan SONRA. Dönen veri: ${data ? 'VERİ VAR' : 'VERİ YOK (nil)'}, İçerik: ${data}`);
  
  if (data) {
    const results: SubfinderResult[] = JSON.parse(data);
    const startIndex = page * limit;
    return results.slice(startIndex, startIndex + limit);
  }
  
  // Redis'te yoksa dosyadan okumayı dene
  try {
    const outputFile = path.join(process.cwd(), 'temp', `subfinder-${id}.json`);
    const fileExists = await fs.stat(outputFile).catch(() => false);
    
    if (fileExists) {
      console.log(`Redis'te sonuç bulunamadı, dosyadan okunuyor: ${outputFile}`);
      const resultData = await fs.readFile(outputFile, 'utf-8');
      
      if (resultData && resultData.trim()) {
        const results = resultData
          .split('\n')
          .filter(line => line.trim() !== '')
          .map(line => {
            try {
              return JSON.parse(line) as SubfinderResult;
            } catch (e) {
              console.error(`JSON parse hatası (${id}, satır): ${line}`, e);
              return null;
            }
          })
          .filter((item): item is SubfinderResult => item !== null);
        
        // Sonuçları Redis'e kaydet
        await redisClient.set(SUBFINDER_RESULT_KEY_PREFIX + id, JSON.stringify(results));
        
        // İstenen sayfayı döndür
        const startIndex = page * limit;
        return results.slice(startIndex, startIndex + limit);
      }
    }
  } catch (error) {
    console.error(`Dosyadan sonuçları okuma hatası (${id}):`, error);
  }
  
  // Hiçbir yerden sonuç alınamadıysa boş dizi döndür
  return [];
}

// Belirli bir SubFinder taramasını sil
export async function deleteSubfinderScan(id: string): Promise<boolean> {
  try {
    const scan = await getSubfinderScan(id);
    if (!scan) throw new Error('SubFinder taraması bulunamadı');
    
    console.log(`SubFinder taraması siliniyor: ${id}`);
    
    // Önce taramayı durdur (eğer hala çalışıyorsa)
    if (scan.status === 'running') {
      await stopSubfinderScan(id);
      // Kısa bir bekleme ekle
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Redis'ten tarama verilerini sil
    const redisKeys = [
      SUBFINDER_KEY_PREFIX + id,            // Ana tarama verisi
      SUBFINDER_RESULT_KEY_PREFIX + id,     // Tarama sonuçları
    ];
    
    // Tüm tarama ile ilgili redis anahtarlarını sil
    for (const key of redisKeys) {
      await redisClient.del(key);
    }
    
    return true;
  } catch (error) {
    console.error(`SubFinder taraması silinirken hata (${id}):`, error);
    return false;
  }
}

// DNS kayıtlarını derinlemesine inceleme
async function performDeepDnsSearch(domain: string, parentScanId: string, timeout: number): Promise<string[]> {
  console.log(`[${parentScanId}] Derinlemesine DNS araştırması başlıyor: ${domain}`);
  const additionalDomains = new Set<string>();
  const recordTypes = ['MX', 'TXT', 'CNAME', 'SRV', 'NS'];

  for (const type of recordTypes) {
    try {
      // Zaman aşımı ile dig komutu
      const { stdout } = await Promise.race([
        execAsync(`dig ${type} ${domain} +short +time=${Math.floor(timeout/recordTypes.length)} +retry=1`),
        new Promise<{stdout: string, stderr: string}>((_, reject) => 
          setTimeout(() => reject(new Error(`Dig ${type} timeout for ${domain}`)), timeout * 1000 / recordTypes.length)
        )
      ]);

      const lines = stdout.split('\n').filter(line => line.trim() !== '');
      lines.forEach(line => {
        // Basit domain çıkarma (daha sofistike olabilir)
        const found = line.match(/([a-zA-Z0-9\-_]+\.)+[a-zA-Z]{2,}/g);
        if (found) {
          found.forEach(f => { 
            if (f.endsWith('.')) f = f.slice(0, -1);
            if (f !== domain && f.includes('.')) additionalDomains.add(f);
          });
        }
      });
    } catch (error: any) {
      console.warn(`[${parentScanId}] ${type} kaydı alınamadı (${domain}): ${error.message}`);
    }
  }
  console.log(`[${parentScanId}] Derinlemesine DNS tamamlandı, ${additionalDomains.size} potansiyel domain.`);
  return Array.from(additionalDomains);
}

// Wayback Machine'den tarihsel subdomain'leri çıkar
async function getWaybackDomains(domain: string, parentScanId: string): Promise<string[]> {
  console.log(`[${parentScanId}] Wayback Machine ve CommonCrawl taraması başlıyor: ${domain}`);
  const subdomains = new Set<string>();
  const urlsToFetch = [
    `http://web.archive.org/cdx/search/cdx?url=*.${domain}/*&output=json&fl=original&collapse=urlkey&limit=10000`,
    `https://index.commoncrawl.org/CC-MAIN-2023-50-index?url=*.${domain}&output=json&limit=5000` // Örnek bir CommonCrawl index
  ];

  for (const apiUrl of urlsToFetch) {
    try {
      // node-fetch için timeout'u RequestInit içinde signal ile sağlıyoruz.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 saniye timeout
      const response = await fetch(apiUrl, { signal: controller.signal as RequestInit['signal'] });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[${parentScanId}] Arşiv API hatası (${apiUrl}): ${response.status} ${response.statusText}`);
        continue;
      }
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json() as any[];
        if (apiUrl.includes('web.archive.org')) {
          // İlk satır başlık olabilir, kontrol et
          const startIndex = Array.isArray(data[0]) && data[0][0] === 'original' ? 1 : 0;
          for (let i = startIndex; i < data.length; i++) {
            if (Array.isArray(data[i]) && data[i][0]) {
              try { new URL(data[i][0]); subdomains.add(new URL(data[i][0]).hostname); } catch {}
            }
          }
        }
      } else {
        const textData = await response.text();
        const lines = textData.split('\n');
        lines.forEach(line => {
          try {
            if (apiUrl.includes('commoncrawl.org')) {
              const jsonLine = JSON.parse(line);
              if (jsonLine.url) { try { new URL(jsonLine.url); subdomains.add(new URL(jsonLine.url).hostname); } catch {} }
            }
          } catch {}
        });
      }
    } catch (error: any) {
      console.error(`[${parentScanId}] Arşiv API genel hata (${apiUrl}):`, error.message);
    }
  }
  
  const finalSubdomains = new Set<string>();
  subdomains.forEach(h => {
    if (h.endsWith(`.${domain}`) && h !== domain) {
      finalSubdomains.add(h);
    }
  });

  console.log(`[${parentScanId}] Arşiv taraması tamamlandı, ${finalSubdomains.size} benzersiz subdomain.`);
  return Array.from(finalSubdomains);
}

// SubFinder taramasını çalıştır
async function runSubfinderScan(id: string, jobData: SubfinderJobData): Promise<void> {
  let results: SubfinderResult[] = [];
  const { domain, options, multiJobId } = jobData; // multiJobId'yi buradan al
  const targetDomainForMultiJob = options.targetDomainForMultiJob;

  const outputDir = path.join(process.cwd(), 'temp');
  const tempOutputFile = path.join(outputDir, `subfinder-${id}.json`);
  let scanError: string | undefined = undefined;
  let finalStatus: 'completed' | 'failed' = 'failed'; // Varsayılan olarak failed

  try {
    console.log(`[${id}] runSubfinderScan başladı. Domain: ${domain}`);
    const isInstalled = await isSubfinderInstalled();
    if (!isInstalled) {
      throw new Error('SubFinder kurulu değil. Lütfen önce SubFinder\'ı yükleyin.');
    }
    
    try {
      await fs.access(outputDir);
    } catch {
      await fs.mkdir(outputDir, { recursive: true });
    }
    await fs.writeFile(tempOutputFile, ''); // Mevcut dosyayı temizle

    const subfinderCmdParts = constructSubfinderCommand(domain, tempOutputFile, options);
    const subfinderCmd = 'subfinder';

    console.log(`[${id}] SubFinder komutu çalıştırılacak: ${subfinderCmd} ${subfinderCmdParts.join(' ')}`);
    
    let execResult;
    try {
      execResult = await execAsync(`${subfinderCmd} ${subfinderCmdParts.join(' ')}`, 
          { timeout: (options.timeout || DEFAULT_TIMEOUT_SUBFINDER_MAIN) * 1000 + 10000 } // Komut zaman aşımına biraz pay ekle
      );
    } catch (execError: any) {
      console.error(`[${id}] execAsync HATASI:`, execError);
      if (execError.stdout) console.error(`[${id}] execAsync Hata stdout: ${execError.stdout}`);
      if (execError.stderr) console.error(`[${id}] execAsync Hata stderr: ${execError.stderr}`);
      throw execError; // Hatayı tekrar fırlat ki ana catch bloğu yakalasın
    }
    
    const { stdout, stderr } = execResult;
    console.log(`[${id}] SubFinder komutu tamamlandı. stdout: ${stdout ? stdout.substring(0,100) : 'BOŞ'}, stderr: ${stderr ? stderr.substring(0,100) : 'BOŞ'}`);
            
    if (stderr && !stderr.toLowerCase().includes("found 0 subdomains")) { // "found 0 subdomains" bir hata değil
        // Bazı subfinder versiyonları stderr'e normal loglar yazabiliyor.
        // Gerçek bir hata olup olmadığını anlamak için daha iyi bir kontrol gerekebilir.
        console.warn(`SubFinder (${id}) stderr: ${stderr.substring(0, 500)}`);
        // Eğer stderr 'flag provided but not defined' gibi kritik bir hata içeriyorsa, bunu scanError yap
        if (stderr.includes("flag provided but not defined") || stderr.includes("failed to validate Shopify token")) {
            scanError = `Subfinder execution error: ${stderr}`;
        }
    }
    // console.log(`SubFinder (${id}) stdout: ${stdout.substring(0, 500)}`); // Genellikle boş veya kısa olur

    if (scanError) {
        throw new Error(scanError);
    }

    const fileExists = await fs.stat(tempOutputFile).catch(() => false);
    if (!fileExists) {
      throw new Error('SubFinder çıktı dosyası oluşturulamadı.');
    }
    
    const fileContent = await fs.readFile(tempOutputFile, 'utf-8');
    if (fileContent && fileContent.trim()) {
      const lines = fileContent.split('\n').filter(line => line.trim() !== '');
      results = lines.map(line => {
        try {
          return JSON.parse(line) as SubfinderResult;
        } catch (e) {
          console.warn(`SubFinder sonucu ayrıştırılamadı (${id}): ${line}`);
          return null;
        }
      }).filter((item): item is SubfinderResult => item !== null);
      console.log(`SubFinder temel tarama sonuçları parse edildi (${id}): ${results.length} adet.`);
    } else {
      console.warn(`SubFinder sonuç dosyası boş veya okunamadı (${id}).`);
    }

    // Ek taramalar (Permütasyon, Deep DNS, Wayback)
    // Bu fonksiyonlar artık results dizisini doğrudan değiştirecek ve loglama yapacak.
    if (options.usePermutations && options.permutationMode) {
        const permResults = await performPermutationScan(domain, options.permutationMode, results.map(r => r.host), options.timeout || DEFAULT_TIMEOUT_PERMUTATION, id);
        results.push(...permResults);
    }
    if (options.deepDnsSearch) {
        const dnsResults = await performDeepDnsSearch(domain, id, options.timeout || DEFAULT_TIMEOUT_DNS_DEEP_DIVE);
        // Yinelenenleri kontrol ederek ekle
        dnsResults.forEach(dr => { if (!results.some(r => r.host === dr)) results.push({ host: dr, source: ['deep-dns'], input: domain }); });
    }
    if (options.useWaybackMachine) {
        const waybackResults = await getWaybackDomains(domain, id);
        waybackResults.forEach(wr => { if (!results.some(r => r.host === wr)) results.push({ host: wr, source: ['archive-search'], input: domain }); });
    }

    finalStatus = 'completed';
    console.log(`SubFinder taraması (${id}) tüm adımlarıyla ${results.length} sonuçla tamamlandı.`);

  } catch (error: any) {
    console.error(`[${id}] runSubfinderScan genel HATA:`, error);
    scanError = error.message || String(error);
    finalStatus = 'failed';
  } finally {
    try {
      if (await fs.stat(tempOutputFile).catch(() => false)) {
        await fs.unlink(tempOutputFile);
        // console.log(`Geçici SubFinder çıktı dosyası silindi: ${tempOutputFile}`);
      }
    } catch (cleanupError) {
      console.warn(`Geçici SubFinder çıktı dosyası (${tempOutputFile}) silinirken hata:`, cleanupError);
    }

    // Tarama durumunu ve sonuçlarını Redis'e kaydet
    const currentJobData = await getSubfinderScan(id);
    if (currentJobData) {
      currentJobData.status = finalStatus;
      currentJobData.error = scanError;
      // currentJobData.result = results; // Sonuçları doğrudan buraya yazmak yerine ayrı bir key'de tutuyoruz
      await redisClient.set(SUBFINDER_KEY_PREFIX + id, JSON.stringify(currentJobData));
      
      // Sonuçları ayrı bir anahtara kaydet
      await redisClient.set(SUBFINDER_RESULT_KEY_PREFIX + id, JSON.stringify(results));
      console.log(`Tekil tarama (${id}) durumu: ${finalStatus}, Sonuç sayısı: ${results.length}, Hata: ${scanError || 'Yok'}`);

      // Eğer çoklu tarama işinin bir parçasıysa, ana işi güncelle
      if (multiJobId && targetDomainForMultiJob) {
        console.log(`[${id}] Multi-job güncellemesi tetikleniyor (finally bloğunda): multiJobId=${multiJobId}, domain=${targetDomainForMultiJob}, status=${finalStatus}`);
        try { // updateMultiJobWithSingleScanResult etrafına try-catch ekle
          await multiSubfinderService.updateMultiJobWithSingleScanResult(
            multiJobId,
            targetDomainForMultiJob,
            id, // singleScanId
            finalStatus,
            scanError,
            finalStatus === 'completed' ? results.length : 0
          );
        } catch (updateError: any) {
          console.error(`[${id}] updateMultiJobWithSingleScanResult çağrılırken HATA:`, updateError);
        }
      }
    } else {
      console.warn(`runSubfinderScan: Tarama durumu güncellenemedi, iş bulunamadı: ${id}`);
    }
  }
}

function constructSubfinderCommand(domain: string, outputPath: string, options: SubfinderOptions): string[] {
    const command = ['-d', domain, '-o', outputPath, '-oJ'];

    command.push('-timeout', (options.timeout || DEFAULT_TIMEOUT_SUBFINDER_MAIN).toString());
    command.push('-t', (options.threads || DEFAULT_THREADS).toString());

    if (options.usePassive) { 
        command.push('-passive'); 
    }
    if (options.onlyActive) { // Bu -nW anlamına geliyor
        command.push('-nW'); 
    }
    // useActiveNetwork için özel bir Subfinder flag'i yok, genellikle -recursive veya -bruteforce ile birleşir.
    // -all zaten geniş bir kaynak kümesini kullanır.

    if (options.resolvers && options.resolvers.length > 0) {
        command.push('-r', options.resolvers.join(','));
    } else {
        command.push('-r', DEFAULT_RESOLVERS.join(','));
    }

    if (options.useAllSources) {
        command.push('-all');
    }
    
    // Permütasyon için -w wordlist parametresi Subfinder'dan kaldırıldı, manuel yapılıyor.
    // if (options.usePermutations && options.permutationMode) { ... }

    if (options.verbose) {
        command.push('-v');
    }

    // console.log(`SubFinder komutu oluşturuldu: subfinder ${command.join(' ')}`);
    return command;
}

// Ek Tarama Fonksiyonları (Permütasyon, Deep DNS, Wayback)
async function performPermutationScan(mainDomain: string, mode: 'short' | 'full', existingSubdomains: string[], timeout: number, parentScanId: string): Promise<SubfinderResult[]> {
    console.log(`[${parentScanId}] Permütasyon taraması başlıyor: ${mainDomain}, Mod: ${mode}`);
    const results: SubfinderResult[] = [];
    const wordlistFilename = mode === 'full' ? 'subdomains_full.txt' : 'subdomains_short.txt';
    const wordlistPath = path.join(process.cwd(), 'wordlists', wordlistFilename);

    try {
        const wordlistContent = await fs.readFile(wordlistPath, 'utf-8');
        const prefixes = wordlistContent.split('\n').filter(line => line.trim() !== '');
        const dnsPromises = dns.promises;

        const limitedPrefixes = prefixes.slice(0, mode === 'short' ? 20 : prefixes.length); // Kısa modda ilk 20

        for (const prefix of limitedPrefixes) {
            const potentialSubdomain = `${prefix}.${mainDomain}`;
            if (existingSubdomains.includes(potentialSubdomain) || results.some(r => r.host === potentialSubdomain)) {
                continue;
            }
            try {
                // Zaman aşımı ile DNS lookup
                const address = await Promise.race([
                    dnsPromises.lookup(potentialSubdomain),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('DNS lookup timeout')), timeout * 1000 / limitedPrefixes.length )) // Her birine düşen süre
                ]);

                if (address && (address as any).address) {
                    results.push({ host: potentialSubdomain, source: ['permutation'], ip: (address as any).address, input: mainDomain });
                    // console.log(`[${parentScanId}] Permütasyonla bulundu: ${potentialSubdomain}`);
                }
            } catch (dnsError: any) {
                // console.log(`[${parentScanId}] Permütasyon DNS hatası (${potentialSubdomain}): ${dnsError.message}`);
            }
        }
    } catch (error) {
        console.error(`[${parentScanId}] Permütasyon wordlist okuma hatası (${wordlistPath}):`, error);
    }
    console.log(`[${parentScanId}] Permütasyon taraması tamamlandı, ${results.length} yeni sonuç.`);
    return results;
}