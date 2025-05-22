import Queue from 'bull';
import Redis from 'ioredis';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { config } from '../config';
import { Domain } from '../../models/DomainList';
import { Scan, ScanResult } from '../../models/Scan';
import { updateScanStatus, addScanResult, updateScannedDomains, getScan } from '../services/scanService';
import { getDomainList } from '../services/domainService';

// Redis bağlantıları
const redisClient = new Redis({
  host: config.redis.url ? new URL(config.redis.url).hostname : 'localhost',
  port: config.redis.url ? parseInt(new URL(config.redis.url).port || '6379', 10) : 6379,
  password: config.redis.password,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    return Math.min(times * 100, 3000); // Exponential backoff but max 3s
  }
});
const redisSubscriber = new Redis({
  host: config.redis.url ? new URL(config.redis.url).hostname : 'localhost',
  port: config.redis.url ? parseInt(new URL(config.redis.url).port || '6379', 10) : 6379,
  password: config.redis.password,
  maxRetriesPerRequest: 3
});

// Küresel durdurma kontrol bayrağı - scanId bazlı durdurulan işleri takip etmek için
const stoppedScans: Set<string> = new Set();

// Tarama kuyruğu
export const scanQueue = new Queue('scan-queue', {
  redis: {
    host: redisClient.options.host,
    port: redisClient.options.port,
    password: config.redis.password,
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
  },
  settings: {
    stalledInterval: 10000,       // Takılan işleri 10 saniyede bir kontrol et
    maxStalledCount: 3,           // Takılan işleri en fazla 3 kez yeniden dene
    lockDuration: 60000,          // Kilit süresi (60 saniye) - işlem süresi için daha uzun
    lockRenewTime: 30000,         // Kilit yenileme süresi (30 saniye)
    drainDelay: 30,               // Drenaj gecikmesi
  },
  defaultJobOptions: {
    attempts: 3,                  // İş başarısız olursa 3 kez daha dene
    backoff: {                    // Yeniden deneme stratejisi
      type: 'exponential',        // Üstel gecikme süresi
      delay: 3000,                // Başlangıç gecikmesi 3 saniye
    },
    removeOnComplete: {           // Tamamlanan işleri sil
      count: 200,                 // Son 200 tamamlanan işi sakla
      age: 7200                   // 2 saat sonra sil
    },
    removeOnFail: {               // Başarısız işleri sil
      count: 50,                  // Son 50 başarısız işi sakla
      age: 3600                   // 1 saat sonra sil
    },
    stackTraceLimit: 10           // Hata stacks izlerini sınırla (bellek kullanımını azaltmak için)
  }
});

// Axios yapılandırması
const axiosOptions = {
  timeout: config.scanner.timeout,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; TaraBot/1.0; +https://tarabot.com)',
  },
  validateStatus: (status: number) => true, // Tüm durum kodlarını kabul et
};

// Tarama durmak için yardımcı fonksiyon - dışardan çağırılabilir
export async function stopScan(scanId: string): Promise<boolean> {
  try {
    stoppedScans.add(scanId);
    console.log(`Tarama durdurma isteği alındı, scanId: ${scanId}`);
    
    // Bu tarama için aktif olan işleri bul ve durdur
    const jobTypes = ['active', 'waiting', 'delayed'];
    let stoppedCount = 0;
    
    for (const type of jobTypes) {
      let jobs;
      try {
        jobs = type === 'active' ? await scanQueue.getActive() :
              type === 'waiting' ? await scanQueue.getWaiting() :
              await scanQueue.getDelayed();
      } catch (err) {
        console.error(`${type} işleri alınırken hata oluştu:`, err);
        continue;
      }
      
      for (const job of jobs) {
        try {
          const data = job.data as ScanJobData;
          if (data && data.scanId === scanId) {
            if (type === 'active') {
              // Aktif işi durdur
              await job.moveToFailed(new Error('Tarama kullanıcı tarafından durduruldu'), true);
            } else {
              // Bekleyen/gecikmeli işi sil
              await job.remove();
            }
            stoppedCount++;
            console.log(`${type} tarama işi durduruldu, JobID: ${job.id}`);
          }
        } catch (err) {
          console.warn(`${type} iş durdurulurken hata: ${job.id}`, err);
        }
      }
    }
    
    // İşlemden sonra Redis'e bilgi ekleyerek taramanın durduğunu kaydet (işlem yeniden başlayabilirse diye)
    try {
      await redisClient.set(`stop:${scanId}`, Date.now().toString(), 'EX', 86400); // 24 saat boyunca tut
    } catch (err) {
      console.warn(`Tarama durdurma durumu Redis'e kaydedilirken hata: ${scanId}`, err);
    }
    
    console.log(`Toplam ${stoppedCount} iş durduruldu, scanId: ${scanId}`);
    return true;
  } catch (error) {
    console.error(`Tarama durdurulurken hata:`, error);
    // Hata olsa bile durduruldu olarak işaretle - tarama sürecinde kontrol edilecek
    stoppedScans.add(scanId);
    return false;
  }
}

// Tarama işleme motoru - Sade ve basit bir yaklaşım
scanQueue.process(async (job) => {
  // İş data'sını al
  const data = job.data as ScanJobData;
  
  // Tarama kimliği yok ise hata fırlat
  if (!data || !data.scanId) {
    throw new Error('Geçersiz tarama işi: scanId eksik');
  }
  
  // Bu tarama önceden durmuş mu kontrol et
  if (stoppedScans.has(data.scanId)) {
    console.log(`Bu tarama önceden durdurulmuş, işlenmiyor: ScanID=${data.scanId}`);
    return { success: false, stopped: true };
  }
  
  // Redis'te durma durumu var mı kontrol et
  try {
    const isStopped = await redisClient.exists(`stop:${data.scanId}`);
    if (isStopped) {
      console.log(`Redis'te durma kaydı bulundu, işlenmiyor: ScanID=${data.scanId}`);
      stoppedScans.add(data.scanId);
      return { success: false, stopped: true };
    }
  } catch (error) {
    console.warn(`Redis durma kontrolü yapılırken hata oluştu: ${error}`);
  }
  
  // Varsayılan değerleri daha sağlam değerlerle güncelle
  const scanConfig = {
    scanId: data.scanId,
    domains: data.domains,
    startIndex: data.startIndex,
    includeSubdomains: data.includeSubdomains, 
    subdomains: data.subdomains || [],
    paths: data.paths,
    searchTerms: data.searchTerms,
    // Performans ayarları için varsayılan değerleri güncelle
    concurrency: data.concurrency || 2,                // Eşzamanlı domain işleme sayısını düşür
    timeout: data.timeout || 20000,                    // Timeout süresini 20 saniyeye çıkar
    batchSize: data.batchSize || 10,                   // Batch boyutunu küçült
    urlBatchSize: data.urlBatchSize || 2,              // URL batch boyutunu düşür 
    retries: data.retries || 3,                        // Yeniden deneme sayısını artır
    waitBetweenRetries: data.waitBetweenRetries || 3000 // Denemeler arası bekleme süresini artır
  };
  
  console.log(`Tarama işi başladı: JobID=${job.id}, ScanID=${scanConfig.scanId}, başlangıç indeksi=${scanConfig.startIndex}`);
  console.log(`Performans ayarları: concurrency=${scanConfig.concurrency}, timeout=${scanConfig.timeout}ms, batchSize=${scanConfig.batchSize}, urlBatchSize=${scanConfig.urlBatchSize}, retries=${scanConfig.retries}`);
  
  try {
    // Tarama durumunu takip etmek için değişkenler
    let scannedCount = 0;
    let foundCount = 0;
    const results: ScanResult[] = [];
    const startTime = Date.now();
    let lastStatusCheckTime = startTime;
    let lastProgressReportTime = startTime;
    
    // Tarama durumunu "running" olarak güncelle
    await updateScanStatus(scanConfig.scanId, 'running');
    
    // Ana tarama döngüsü - belirtilen indeksten başla
    for (let i = scanConfig.startIndex; i < scanConfig.domains.length; i += scanConfig.batchSize) {
      // Her 10 batch'te bir veya 2 dakikada bir durum kontrolü yap
      const currentTime = Date.now();
      if (i % (10 * scanConfig.batchSize) === 0 || currentTime - lastStatusCheckTime > 120000) {
        lastStatusCheckTime = currentTime;
        
        // Taramanın durumu kontrol et (Redis'ten)
        try {
          const scan = await getScan(scanConfig.scanId);
          if (!scan || scan.status !== 'running') {
            console.log(`Tarama durumu artık 'running' değil (${scan?.status}), işlem durduruluyor: ScanID=${scanConfig.scanId}`);
            stoppedScans.add(scanConfig.scanId);
            break;
          }
          
          // Redis'te durdurma kaydı kontrolü
          const isStopped = await redisClient.exists(`stop:${scanConfig.scanId}`);
          if (isStopped) {
            console.log(`Redis'te durma kaydı bulundu, işlem durduruluyor: ScanID=${scanConfig.scanId}`);
            stoppedScans.add(scanConfig.scanId);
            break;
          }
        } catch (error) {
          console.warn(`Tarama durum kontrolü yapılırken hata oluştu: ${error}`);
          // Hata durumunda işlemi durdurmuyoruz, devam ediyoruz
        }
      }
      
      // İşin durdurulup durdurulmadığını kontrol et
      if (stoppedScans.has(scanConfig.scanId)) {
        console.log(`Tarama durduruldu, ScanID: ${scanConfig.scanId}, JobID: ${job.id}`);
        // Durumu güncelle ve kaldığı indeksi kaydet
        await updateScannedDomains(scanConfig.scanId, i);
        await updateScanStatus(scanConfig.scanId, 'paused');
        return {
          totalScanned: scannedCount,
          totalFound: foundCount,
          index: i,
          completedAt: new Date(),
          stopped: true
        };
      }
      
      // Her domain grubu için paralel işlemleri topla
      const batchDomains = scanConfig.domains.slice(i, i + scanConfig.batchSize);
      
      // Her batch'te ilk domain için log mesajı
      if (batchDomains.length > 0) {
        console.log(`Tarama batchi başladı: ScanID=${scanConfig.scanId}, indeks=${i}, işlenecek domain sayısı=${batchDomains.length}`);
      }
      
      // Domain'leri tara ve sonuçları topla
      const batchResults = await processDomainsInBatch(batchDomains, scanConfig, i);
      
      // Sonuçları ana sonuç listesine ekle
      scannedCount += batchResults.scannedCount;
      foundCount += batchResults.foundCount;
      results.push(...batchResults.results);
      
      // İşlenen domain indeksini güncelle
      await updateScannedDomains(scanConfig.scanId, i + batchDomains.length - 1);
      
      // İlerleme durumunu güncelle
      const progress = Math.floor((i + batchDomains.length) / scanConfig.domains.length * 100);
      await job.progress(progress);
      
      // Her 10 domain grubunda bir veya 1 dakikada bir ilerleme bilgisi logla
      if (i % (10 * scanConfig.batchSize) === 0 || currentTime - lastProgressReportTime > 60000) {
        lastProgressReportTime = currentTime;
        const elapsedMinutes = (currentTime - startTime) / 60000;
        const domainsPerMinute = i / elapsedMinutes;
        console.log(`İlerleme: %${progress}, ${i}/${scanConfig.domains.length} domain işlendi, geçen süre: ${elapsedMinutes.toFixed(2)} dakika`);
        console.log(`Performans: ${domainsPerMinute.toFixed(2)} domain/dakika, ${foundCount} eşleşme bulundu`);
      }
      
      // İş takibi için daha güçlü bir yaklaşım - check-in job yerine Redis'te veri saklama
      await updateJobStatus(job, scanConfig.scanId, i);
    }
    
    // Tarama tamamlandı
    console.log(`Tarama tamamlandı: ScanID=${scanConfig.scanId}, tarandı=${scannedCount}, bulundu=${foundCount}`);
    await updateScanStatus(scanConfig.scanId, 'completed');
    
    return {
      totalScanned: scannedCount,
      totalFound: foundCount,
      results: results,
      completedAt: new Date(),
      success: true
    };
  } catch (error) {
    console.error(`Tarama hatası (ScanID: ${scanConfig.scanId}): ${error}`);
    
    // İşlem hata verdiğinde, durumu güncelleyip durdurmayı dene
    try {
      await updateScanStatus(scanConfig.scanId, 'failed');
      stoppedScans.add(scanConfig.scanId);
    } catch (secondaryError) {
      console.error(`Tarama durum güncelleme hatası: ${secondaryError}`);
    }
    
    throw error;
  }
});

// Domain batch'ini işle
async function processDomainsInBatch(
  batchDomains: Domain[],
  data: ScanJobData,
  startIndex: number
): Promise<{ scannedCount: number, foundCount: number, results: ScanResult[] }> {
  const results: ScanResult[] = [];
  let scannedCount = 0;
  let foundCount = 0;
  
  // Her domain için URL'leri oluştur ve kontrol et
  for (let j = 0; j < batchDomains.length; j++) {
    // Tarama durdurulduysa, işlemi sonlandır
    if (stoppedScans.has(data.scanId)) {
      return { scannedCount, foundCount, results };
    }
    
    const domainObj = batchDomains[j];
    const domain = domainObj.domain;
    const domainIndex = startIndex + j;
    
    try {
      // Ana domain ve subdomain'ler için URL'leri oluştur
      const urls: string[] = [];
      
      // Ana domain için URL'leri oluştur
      data.paths.forEach(path => {
        urls.push(`https://${domain}${path}`);
      });
      
      // Subdomain'ler için URL'leri oluştur
      if (data.includeSubdomains && data.subdomains && data.subdomains.length > 0) {
        data.subdomains.forEach(subdomain => {
          data.paths.forEach(path => {
            urls.push(`https://${subdomain}.${domain}${path}`);
          });
        });
      }
      
      // URL'leri işle
      const domainResults = await processDomainUrls(urls, domain, data);
      
      // Sonuçları ekle
      results.push(...domainResults);
      foundCount += domainResults.length;
      
      // Taranan domain sayısını artır
      scannedCount++;
    } catch (error) {
      console.error(`Domain işleme hatası (${domain}): ${error}`);
    }
  }
  
  return { scannedCount, foundCount, results };
}

// Domain URL'lerini işle
async function processDomainUrls(
  urls: string[],
  domain: string,
  config: ScanJobData
): Promise<ScanResult[]> {
  const results: ScanResult[] = [];
  // undefined kontrolü ile varsayılan değeri ayarla
  const urlBatchSize = typeof config.urlBatchSize === 'number' ? config.urlBatchSize : 2;
  
  // Önce sadece HTTPS URL'lerini filtrele
  const httpsUrls = urls.filter(url => url.startsWith('https://'));
  
  // URL'leri gruplar halinde paralel işle
  for (let i = 0; i < httpsUrls.length; i += urlBatchSize) {
    // Tarama durdurulduysa, işlemi sonlandır
    if (stoppedScans.has(config.scanId)) {
      return results;
    }
    
    const urlBatch = httpsUrls.slice(i, i + urlBatchSize);
    
    // Her batch'ten önce kısa bir bekleme ekle - rate limiting'i önlemek için
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      // Paralel HTTP istekleri yap
      const urlPromises = urlBatch.map(url => processUrl(url, domain, config));
      const batchResults = await Promise.all(urlPromises);
      
      // Başarılı sonuçları filtrele ve ekle
      for (const result of batchResults) {
        if (result) {
          results.push(result);
          
          try {
            // Sonucu veritabanına kaydet
            await addScanResult(config.scanId, result);
          } catch (err) {
            console.error(`Sonuç kaydedilirken hata: ${err}. Sonuç: ${result.url}`);
            // Hata olsa bile devam et, sonuç zaten ana listeye eklendi
          }
        }
      }
    } catch (error) {
      console.error(`URL batch işleme hatası (domain: ${domain}):`, error);
      // Batch işleme hatası olsa bile devam et
    }

    // Her 20 URL'de bir job durumunu kontrol et
    if (i > 0 && i % 20 === 0) {
      try {
        // Taramanın hala running durumunda olup olmadığını kontrol et
        const scan = await getScan(config.scanId);
        if (!scan || scan.status !== 'running') {
          console.log(`Tarama artık running durumunda değil: ${config.scanId}, durduruluyor`);
          stoppedScans.add(config.scanId);
          return results;
        }
      } catch (err) {
        console.warn(`URL işleme sırasında durum kontrolünde hata: ${err}`);
        // Hata olsa bile devam et
      }
    }
  }
  
  return results;
}

// Tek bir URL'yi işle
async function processUrl(
  url: string,
  domain: string,
  config: ScanJobData
): Promise<ScanResult | null> {
  // HTTP isteği yapılandırması
  const axiosOptions = {
    timeout: config.timeout || 20000, // Varsayılan 20 saniye
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; TaraBot/1.0; +https://tarabot.com)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    },
    validateStatus: () => true, // Tüm durum kodlarını kabul et
    maxRedirects: 3,            // Maksimum 3 yönlendirme takip et
    decompress: true,           // Sıkıştırılmış yanıtları aç
  };
  
  let retryCount = 0;
  // Varsayılan değerleri uygula ve undefined kontrolü yap
  const maxRetries = typeof config.retries === 'number' ? config.retries : 3;
  const waitBetweenRetries = typeof config.waitBetweenRetries === 'number' ? config.waitBetweenRetries : 3000;
  
  // İlk olarak HTTPS deneme
  while (retryCount <= maxRetries) {
    try {
      // Tarama durdurulduysa, işlemi sonlandır
      if (stoppedScans.has(config.scanId)) {
        return null;
      }
      
      // HTTP isteği yap
      const response = await axios.get(url, axiosOptions);
      
      // Yaygın hata durumlarını logla
      if (response.status >= 400) {
        console.log(`URL hata durumu: ${url}, Durum: ${response.status}`);
        // 404 gibi yaygın hatalarda yeniden deneme
        if (response.status >= 500 || response.status === 429) {
          throw new Error(`HTTP ${response.status} hatası: ${url}`);
        }
      }
      
      // Yanıt içeriği HTML değilse, es geç
      if (typeof response.data !== 'string') {
        return null;
      }
      
      // Arama terimlerini kontrol et
      const foundTerms: string[] = [];
      config.searchTerms.forEach(term => {
        if (response.data.includes(term)) {
          foundTerms.push(term);
        }
      });
      
      // Eğer eşleşme varsa, sonuç oluştur
      if (foundTerms.length > 0) {
        return {
          url,
          domain,
          path: url.split(domain)[1] || '/',
          subdomain: url.includes('//') && url.split('//')[1].split('.')[0] !== domain.split('.')[0]
            ? url.split('//')[1].split('.')[0]
            : undefined,
          searchTerms: config.searchTerms,
          foundTerms,
          statusCode: response.status,
          timestamp: new Date(),
        };
      }
      
      // Eşleşme yoksa null döndür
      return null;
    } catch (error) {
      retryCount++;
      // Daha detaylı hata loglaması
      const errorMsg = (error as any)?.message || 'Bilinmeyen hata';
      const isTimeoutError = errorMsg.includes('timeout') || errorMsg.includes('ECONNABORTED');
      const isNetworkError = errorMsg.includes('ECONNREFUSED') || errorMsg.includes('ENOTFOUND');
      
      const errorType = isTimeoutError ? 'TIMEOUT' : 
                       isNetworkError ? 'NETWORK' : 'OTHER';
      
      if (retryCount <= maxRetries) {
        console.log(`URL işleme hatası (${errorType}), Yeniden deneniyor (${retryCount}/${maxRetries}): ${url}`);
        // Yeniden denemeden önce bekle (artan bekleme süresi)
        const waitTime = waitBetweenRetries * retryCount;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else if (url.startsWith('https://')) {
        // HTTPS başarısız oldu, HTTP dene
        console.log(`HTTPS bağlantısı başarısız oldu, HTTP deneniyor: ${url}`);
        const httpUrl = url.replace('https://', 'http://');
        
        try {
          const httpResponse = await axios.get(httpUrl, axiosOptions);
          
          // HTTP yanıtı başarılı mı kontrol et
          if (httpResponse.status < 400 && typeof httpResponse.data === 'string') {
            // Arama terimlerini kontrol et
            const httpFoundTerms: string[] = [];
            config.searchTerms.forEach(term => {
              if (httpResponse.data.includes(term)) {
                httpFoundTerms.push(term);
              }
            });
            
            // Eğer eşleşme varsa, sonuç oluştur
            if (httpFoundTerms.length > 0) {
              return {
                url: httpUrl,
                domain,
                path: httpUrl.split(domain)[1] || '/',
                subdomain: httpUrl.includes('//') && httpUrl.split('//')[1].split('.')[0] !== domain.split('.')[0]
                  ? httpUrl.split('//')[1].split('.')[0]
                  : undefined,
                searchTerms: config.searchTerms,
                foundTerms: httpFoundTerms,
                statusCode: httpResponse.status,
                timestamp: new Date(),
              };
            }
          } else {
            console.log(`HTTP da başarısız oldu: ${httpUrl}, Durum: ${httpResponse.status}`);
          }
        } catch (httpError) {
          console.error(`HTTP denemesi de başarısız oldu: ${httpUrl} - ${(httpError as any)?.message || 'Bilinmeyen hata'}`);
        }
        
        return null;
      } else {
        console.error(`URL işleme başarısız (${errorType}): ${url} - ${errorMsg}`);
        return null;
      }
    }
  }
  
  return null;
}

// Taramayı kaldığı yerden devam ettir
export async function resumeScan(scanId: string): Promise<boolean> {
  try {
    console.log(`Tarama devam ettirme isteği alındı, scanId: ${scanId}`);
    
    // Redis'teki durdurma kaydını sil
    await redisClient.del(`stop:${scanId}`);
    
    // Tarama bilgilerini al
    const scan = await getScan(scanId);
    if (!scan) {
      throw new Error(`Tarama bulunamadı: ${scanId}`);
    }
    
    // Tarama durumunu kontrol et
    console.log(`Tarama durumu: ${scan.status}, mevcut indeks: ${scan.config.currentIndex}`);
    
    // Duraklatma bayrağını kaldır
    stoppedScans.delete(scanId);
    
    // Mevcut tüm işleri temizle - daha önceki işleri silmek için önemli
    await cleanupExistingJobs(scanId);
    
    // Domain listesini al
    const domainList = await getDomainList(scan.config.domainListId);
    if (!domainList) {
      throw new Error(`Domain listesi bulunamadı: ${scan.config.domainListId}`);
    }
    
    // Başlangıç indeksini kontrol et ve doğrula
    let startIndex = scan.config.currentIndex;
    
    // Geçersiz indeks kontrolu
    if (startIndex === undefined || startIndex < 0) {
      console.warn(`Geçersiz currentIndex değeri: ${startIndex}, başlangıç indeksine ayarlanıyor: ${scan.config.startIndex}`);
      startIndex = scan.config.startIndex;
    }
    
    // Bitiş indeksi kontrolü - işlenecek domain kalmadıysa, taramayı tamamla
    if (startIndex >= domainList.domains.length) {
      console.warn(`Tüm domainler zaten tarandı. Başlangıç indeksi (${startIndex}) > Domain sayısı (${domainList.domains.length})`);
      await updateScanStatus(scanId, 'completed');
      return true;
    }
    
    console.log(`Tarama kaldığı yerden devam edecek, başlangıç indeksi: ${startIndex}/${domainList.domains.length}`);
    
    // Varsayılan değerler
    const batchSize = scan.config.batchSize || config.scanner.batchSize;
    const urlBatchSize = scan.config.urlBatchSize || config.scanner.urlBatchSize;
    const retries = scan.config.retries || config.scanner.retries;
    const timeout = scan.config.timeout || config.scanner.timeout;
    
    // Yeni job oluştur ve kuyruğa ekle
    const job = await scanQueue.add({
      scanId: scan.id,
      domains: domainList.domains,
      startIndex: startIndex,
      includeSubdomains: scan.config.includeSubdomains,
      subdomains: scan.config.subdomains,
      paths: scan.config.paths,
      searchTerms: scan.config.searchTerms,
      concurrency: scan.config.concurrency || config.scanner.concurrency,
      timeout: timeout,
      batchSize: batchSize,
      urlBatchSize: urlBatchSize,
      retries: retries,
      waitBetweenRetries: 3000,
    }, {
      priority: 10,                // Yüksek öncelik
      attempts: 3,                 // Başarısız olursa 3 kez dene
      timeout: Math.max(60000, timeout) * 10, // Tarama timeout'unun 10 katı
      removeOnComplete: true,      // Tamamlanınca sil
      removeOnFail: { count: 3 },  // Başarısız olursa 3 tanesini sakla
    });
    
    console.log(`Tarama kaldığı yerden devam ediyor, JobID: ${job.id}, ScanID: ${scanId}`);
    
    // Tarama durumunu running olarak güncelle
    await updateScanStatus(scan.id, 'running');
    
    return true;
  } catch (error) {
    console.error(`Tarama devam ettirme hatası:`, error);
    return false;
  }
}

// Tarama işi veri yapısı
interface ScanJobData {
  scanId: string;
  domains: Domain[];
  startIndex: number;
  includeSubdomains: boolean;
  subdomains: string[];
  paths: string[];
  searchTerms: string[];
  // Performans ayarları
  concurrency?: number;
  timeout?: number;
  batchSize?: number;
  urlBatchSize?: number;
  retries?: number;
  waitBetweenRetries?: number;
}

// Taramanın durdurulup durdurulmadığını kontrol et
function isScanStopped(scanId: string): boolean {
  return stoppedScans.has(scanId);
}

// Mevcut işleri temizle
async function cleanupExistingJobs(scanId: string): Promise<void> {
  try {
    // Tüm job türlerini al
    const activeJobs = await scanQueue.getActive();
    const waitingJobs = await scanQueue.getWaiting();
    const delayedJobs = await scanQueue.getDelayed();
    
    console.log(`Mevcut job sayıları: aktif=${activeJobs.length}, bekleyen=${waitingJobs.length}, gecikmeli=${delayedJobs.length}`);
    
    // Aktif jobları temizle
    for (const job of activeJobs) {
      const data = job.data as any;
      if (data && data.scanId === scanId) {
        try {
          await job.moveToFailed(new Error('Tarama yeniden başlatıldı'), true);
          await job.remove();
          console.log(`Aktif job durduruldu ve silindi: ${job.id}`);
        } catch (err) {
          console.warn(`Aktif job silme hatası: ${job.id}`, err);
        }
      }
    }
    
    // Bekleyen ve gecikmeli jobları temizle
    let removedJobs = 0;
    for (const job of [...waitingJobs, ...delayedJobs]) {
      const data = job.data as any;
      if (data && data.scanId === scanId) {
        try {
          await job.remove();
          removedJobs++;
        } catch (err) {
          console.warn(`Bekleyen/gecikmeli job silme hatası: ${job.id}`, err);
        }
      }
    }
    
    console.log(`Toplam ${removedJobs} bekleyen/gecikmeli job silindi`);
  } catch (error) {
    console.error(`Job temizleme hatası:`, error);
  }
}

// Kuyruğu durdur
export async function pauseQueue(): Promise<boolean> {
  try {
    console.log('Tarama kuyruğu durduruluyor...');
    await scanQueue.pause(true); // true - global olarak durdur
    console.log('Tarama kuyruğu durduruldu');
    return true;
  } catch (error) {
    console.error('Kuyruk durdurma hatası:', error);
    return false;
  }
}

// Kuyruğu başlat
export async function resumeQueue(): Promise<boolean> {
  try {
    console.log('Tarama kuyruğu başlatılıyor...');
    await scanQueue.resume(true); // true - global olarak başlat
    console.log('Tarama kuyruğu başlatıldı');
    return true;
  } catch (error) {
    console.error('Kuyruk başlatma hatası:', error);
    return false;
  }
}

// Kuyruk durumunu al
export async function getQueueStatus(): Promise<any> {
  try {
    const counts = await scanQueue.getJobCounts();
    const isPaused = await scanQueue.isPaused();
    return {
      counts,
      isPaused,
    };
  } catch (error) {
    console.error('Kuyruk durumu alma hatası:', error);
    return { error: 'Kuyruk durumu alınamadı' };
  }
}

// Kuyruğu temizle
export async function cleanQueue(): Promise<boolean> {
  try {
    console.log('Tarama kuyruğu temizleniyor...');
    
    // Önce kuyruğu durdur
    await scanQueue.pause();
    
    // Tüm işleri al
    const allJobs = await scanQueue.getJobs(['active', 'waiting', 'delayed', 'failed', 'completed']);
    console.log(`Toplam ${allJobs.length} iş temizlenecek`);
    
    // Tüm işleri sil
    for (const job of allJobs) {
      try {
        if (await job.isActive()) {
          await job.moveToFailed(new Error('Kuyruk temizleniyor'), true);
        }
        await job.remove();
      } catch (error) {
        console.warn(`İş silinirken hata: ${job.id}`, error);
      }
    }
    
    // Kuyruğu yeniden başlat
    await scanQueue.resume();
    
    console.log('Tarama kuyruğu temizlendi');
    return true;
  } catch (error) {
    console.error('Kuyruk temizleme hatası:', error);
    try {
      await scanQueue.resume();
    } catch {}
    return false;
  }
}

// Olay dinleyiciler
scanQueue.on('active', job => {
  const data = job.data as ScanJobData;
  console.log(`İş çalışmaya başladı: ${job.id}, ScanID: ${data.scanId}`);
});

scanQueue.on('completed', (job, result) => {
  const data = job.data as ScanJobData;
  console.log(`İş tamamlandı: ${job.id}, ScanID: ${data.scanId}, Toplam: ${result.totalScanned}, Bulunan: ${result.totalFound}`);
});

scanQueue.on('failed', (job, error) => {
  const data = job.data as ScanJobData;
  console.error(`İş başarısız: ${job.id}, ScanID: ${data.scanId}`, error);
});

scanQueue.on('progress', (job, progress) => {
  const data = job.data as ScanJobData;
  console.log(`İş ilerlemesi: ${job.id}, ScanID: ${data.scanId}, İlerleme: %${progress}`);
});

scanQueue.on('stalled', (job) => {
  const data = job.data as ScanJobData;
  console.warn(`İş takıldı: ${job.id}, ScanID: ${data.scanId}`);
});

// İş takibi için daha güçlü bir yaklaşım - check-in job yerine Redis'te veri saklama
async function updateJobStatus(
  job: any, 
  scanId: string, 
  currentIndex: number
): Promise<void> {
  try {
    // Redis'e durum kaydı ekle
    await redisClient.set(
      `job-status:${scanId}:${job.id}`, 
      JSON.stringify({
        id: job.id,
        scanId: scanId,
        currentIndex: currentIndex,
        lastChecked: new Date().toISOString()
      }),
      'EX', // Expiry option
      86400 // 24 saat boyunca sakla
    );
    
    // Her 10 check-in'de bir Redis üzerindeki eski kontrol kayıtlarını temizle
    if (currentIndex % (10 * (job.data.batchSize || 10)) === 0) {
      try {
        // Sadece bu tarama için eski check-in kayıtlarını bul
        const checkInKeys = await redisClient.keys(`job-status:${scanId}:*`);
        
        // En son check-in dışındaki eski kayıtları sil
        if (checkInKeys.length > 1) {
          const keyToKeep = `job-status:${scanId}:${job.id}`;
          for (const key of checkInKeys) {
            if (key !== keyToKeep) {
              await redisClient.del(key);
            }
          }
        }
      } catch (err) {
        console.warn(`Eski job check-in kayıtları temizlenirken hata: ${err}`);
      }
    }
  } catch (err) {
    console.warn(`Job durum güncellemesi yapılırken hata: ${err}`);
  }
} 