import { v4 as uuidv4 } from 'uuid';
import { redisClient } from '../redisClient';
import { scanQueue, stopScan, resumeScan, pauseQueue, resumeQueue } from '../queues/scanQueue';
import { Scan, ScanStatus, ScanConfig, ScanResult } from '../../models/Scan';
import { getDomainList } from './domainService';
import { config } from '../config';
import { Job, Queue } from 'bullmq';

// Redis anahtarları için ön ek
const SCAN_KEY_PREFIX = 'scan:';
const SCAN_RESULT_KEY_PREFIX = 'scan_results:';

// Tarama oluştur
export async function createScan(configData: Omit<ScanConfig, 'id' | 'createdAt' | 'updatedAt' | 'currentIndex'>): Promise<Scan> {
  const now = new Date();
  const scanId = uuidv4();
  
  // Tarama konfigürasyonu oluştur
  const scanConfig: ScanConfig = {
    id: uuidv4(),
    ...configData,
    currentIndex: configData.startIndex,
    createdAt: now,
    updatedAt: now,
  };
  
  // Tarama nesnesi oluştur
  const scan: Scan = {
    id: scanId,
    config: scanConfig,
    status: 'pending',
    results: [],
    startedAt: now,
    updatedAt: now,
    progress: {
      totalDomains: 0, // Domain listesi yüklendiğinde güncellenecek
      scannedDomains: 0,
      foundResults: 0,
    },
  };
  
  // Redis'e kaydet
  await redisClient.set(SCAN_KEY_PREFIX + scanId, JSON.stringify(scan));
  
  return scan;
}

// Tarama durumunu güncelle
export async function updateScanStatus(scanId: string, status: ScanStatus): Promise<Scan> {
  const scan = await getScan(scanId);
  if (!scan) throw new Error('Tarama bulunamadı');
  
  // Tarama durumunu güncelle
  const updatedScan: Scan = {
    ...scan,
    status,
    updatedAt: new Date(),
  };
  
  // Özel durum güncellemeleri
  if (status === 'completed') {
    updatedScan.completedAt = new Date();
  } else if (status === 'paused') {
    updatedScan.pausedAt = new Date();
  } else if (status === 'running' && scan.status === 'pending') {
    updatedScan.startedAt = new Date();
  }
  
  // Redis'e kaydet
  await redisClient.set(SCAN_KEY_PREFIX + scanId, JSON.stringify(updatedScan));
  
  return updatedScan;
}

// Tarama başlat
export async function startScan(scanId: string): Promise<Scan> {
  const scan = await getScan(scanId);
  if (!scan) throw new Error('Tarama bulunamadı');
  
  // Sadece pending veya paused durumundaki taramalar başlatılabilir
  if (scan.status !== 'pending' && scan.status !== 'paused') {
    throw new Error(`Bu tarama şu anda ${scan.status} durumunda, başlatılamaz`);
  }
  
  try {
    // Kuyruğun çalıştığından emin ol
    await resumeQueue();
    
    // Eğer duraklatılmış bir tarama ise, kaldığı yerden devam ettir
    if (scan.status === 'paused') {
      console.log(`Duraklatılmış tarama kaldığı yerden devam ediyor: ${scanId}, index: ${scan.config.currentIndex}`);
      
      // Mevcut indeks doğru mu kontrol et
      if (scan.config.currentIndex < scan.config.startIndex) {
        console.warn(`Geçersiz currentIndex değeri: ${scan.config.currentIndex}, startIndex'e geri dönülüyor: ${scan.config.startIndex}`);
        
        // Tarama konfigürasyonunu güncelle
        const updatedScan: Scan = {
          ...scan,
          config: {
            ...scan.config,
            currentIndex: scan.config.startIndex,
            updatedAt: new Date(),
          },
          updatedAt: new Date(),
        };
        
        // Redis'e kaydet
        await redisClient.set(SCAN_KEY_PREFIX + scanId, JSON.stringify(updatedScan));
        
        // Güncellenmiş taramayı getir
        const refreshedScan = await getScan(scanId);
        if (!refreshedScan) throw new Error('Tarama bulunamadı');
        
        // Devam et
        await resumeScan(scanId);
      } else {
        // Normal devam et
        await resumeScan(scanId);
      }
      
      // Tarama durumunu running olarak güncelle
      const updatedScan = await updateScanStatus(scanId, 'running');
      return updatedScan;
    }
    
    // Domain listesini al
    const domainList = await getDomainList(scan.config.domainListId);
    if (!domainList) throw new Error('Domain listesi bulunamadı');
    
    // Taramayı kuyruğa ekle
    await scanQueue.add({
      scanId: scan.id,
      domains: domainList.domains,
      startIndex: scan.config.currentIndex, // Kaldığı yerden devam et
      includeSubdomains: scan.config.includeSubdomains,
      subdomains: scan.config.subdomains,
      paths: scan.config.paths,
      searchTerms: scan.config.searchTerms,
      // Performans ayarları (varsa)
      concurrency: scan.config.concurrency,
      timeout: scan.config.timeout,
      batchSize: scan.config.batchSize,
      urlBatchSize: scan.config.urlBatchSize,
      retries: scan.config.retries,
    }, {
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 10 },
      attempts: 3,
      priority: 5 // Orta düzey öncelik
    });
    
    // Tarama durumunu running olarak güncelle
    const updatedScan = await updateScanStatus(scanId, 'running');
    
    console.log(`Tarama başlatıldı: ${scanId}, başlangıç indeksi: ${scan.config.currentIndex}`);
    return updatedScan;
  } catch (error) {
    console.error(`Tarama başlatma hatası (${scanId}):`, error);
    throw error;
  }
}

// Taramayı durdur
export async function pauseScan(scanId: string): Promise<Scan> {
  try {
    // Tarama bilgilerini al
    const scan = await getScan(scanId);
    if (!scan) throw new Error('Tarama bulunamadı');
    
    // Sadece running durumundaki taramalar durdurulabilir
    if (scan.status !== 'running') {
      throw new Error(`Bu tarama şu anda ${scan.status} durumunda, durdurulamaz`);
    }
    
    console.log(`Tarama durduruluyor: ${scanId}`);
    
    // İşlemi önce duruma "pausing" olarak ayarla (gecikmeli durum güncellemesi)
    const pausingStatus: ScanStatus = 'paused';
    await updateScanStatus(scanId, pausingStatus);
    
    // Durdurma bayrağını ayarla
    const stopped = await stopScan(scanId);
    
    if (!stopped) {
      console.warn(`Tarama durdurma işleminde sorun oluştu, buna rağmen tarama durumu paused olarak işaretleniyor: ${scanId}`);
    }
    
    // Durdurma işlemi gerçekleşene kadar kısa bir süre bekle
    // Önemli: Bu, büyük veri kümelerinde işlemi daha güvenilir hale getirir
    await new Promise((resolve) => setTimeout(resolve, 3000));
    
    // Taramayı tekrar kontrol et
    const updatedScan = await getScan(scanId);
    if (!updatedScan) throw new Error('Tarama bulunamadı');
    
    console.log(`Tarama durduruldu: ${scanId}, mevcut indeks: ${updatedScan.config.currentIndex}`);
    return updatedScan;
  } catch (error) {
    console.error(`Tarama duraklatma hatası (${scanId}):`, error);
    
    // Hata olsa bile durumu güncellemeye çalış
    try {
      const scan = await getScan(scanId);
      if (scan && scan.status === 'running') {
        console.log(`Hata oluştu ancak tarama durumu paused olarak işaretleniyor: ${scanId}`);
        const updatedScan = await updateScanStatus(scanId, 'paused');
        return updatedScan;
      } else if (scan) {
        // Zaten güncellenmiş olabilir, mevcut scan'i döndür
        return scan;
      }
    } catch (innerError) {
      console.error(`Tarama durum güncelleme hatası (${scanId}):`, innerError);
    }
    
    // Hala bir değer döndürülmediyse, orijinal hatayı fırlat
    throw error;
  }
}

// Taramayı iptal et
export async function cancelScan(scanId: string): Promise<Scan> {
  try {
    // Tarama bilgilerini al
    const scan = await getScan(scanId);
    if (!scan) throw new Error('Tarama bulunamadı');
    
    console.log(`Tarama iptal ediliyor: ${scanId}, mevcut durum: ${scan.status}`);
    
    // Durum kontrolü - tamamlanmış tarama iptal edilemez
    if (scan.status === 'completed') {
      throw new Error('Tamamlanmış taramalar iptal edilemez');
    }
    
    // İlk olarak durumu iptal ediliyor olarak işaretle
    await updateScanStatus(scanId, 'canceled');
    
    // Durdurma bayrağını ayarla - redis'e de kaydedecek 
    const stopped = await stopScan(scanId);
    
    if (!stopped) {
      console.warn(`Tarama durdurma işleminde sorun oluştu, buna rağmen tarama durumu canceled olarak işaretlendi: ${scanId}`);
    }
    
    // İptal işlemi için kısa bir bekleme
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Son durumu kontrol et
    const updatedScan = await getScan(scanId);
    if (!updatedScan) throw new Error('Tarama bulunamadı');
    
    console.log(`Tarama iptal edildi: ${scanId}`);
    
    // Redis'teki sonuçları korumak isteyip istemediğimize karar ver
    // İsterseniz Redis'teki scan:* ve scan_results:* önekli anahtarları burada temizleyebilirsiniz
    
    return updatedScan;
  } catch (error) {
    console.error(`Tarama iptal hatası (${scanId}):`, error);
    
    // Hata durumunda kontrol
    try {
      const scan = await getScan(scanId);
      if (scan) {
        // Tarama hala var, güncel hali döndür
        return scan;
      }
    } catch {}
    
    // Hala bir değer döndürülmediyse, orijinal hatayı fırlat
    throw error;
  }
}

// Tarama sonucunu ekle
export async function addScanResult(scanId: string, result: ScanResult): Promise<void> {
  const scan = await getScan(scanId);
  if (!scan) throw new Error('Tarama bulunamadı');
  
  // Sonucu Redis listesine ekle (en yeni sonuçlar başta olacak şekilde)
  await redisClient.lpush(SCAN_RESULT_KEY_PREFIX + scanId, JSON.stringify(result));
  
  // Tarama ilerlemesini güncelle
  const updatedScan: Scan = {
    ...scan,
    progress: {
      ...scan.progress,
      foundResults: (scan.progress.foundResults || 0) + 1,
    },
    updatedAt: new Date(),
  };
  
  await redisClient.set(SCAN_KEY_PREFIX + scanId, JSON.stringify(updatedScan));
}

// Taranan domain sayısını ve mevcut indeksi güncelle
export async function updateScannedDomains(scanId: string, currentIndex: number): Promise<void> {
  const scan = await getScan(scanId);
  if (!scan) throw new Error('Tarama bulunamadı');
  
  const updatedScan: Scan = {
    ...scan,
    config: {
        ...scan.config,
        currentIndex: currentIndex
    },
    progress: {
      ...scan.progress,
      scannedDomains: (scan.progress.scannedDomains || 0) + 1,
    },
    updatedAt: new Date(),
  };
  
  await redisClient.set(SCAN_KEY_PREFIX + scanId, JSON.stringify(updatedScan));
}

// Tüm taramaları getir
export async function getAllScans(): Promise<Scan[]> {
  const keys = await redisClient.keys(SCAN_KEY_PREFIX + '*');
  const scans: Scan[] = [];
  if (keys.length === 0) return scans;

  const pipeline = redisClient.pipeline();
  keys.forEach(key => pipeline.get(key));
  const results = await pipeline.exec() as [Error | null, string | null][]; // Tip belirlemesi

  results.forEach((result: [Error | null, string | null]) => { // Tip belirlemesi
    if (result && result[1]) { // Hata kontrolü ve veri varlığı kontrolü
        try {
            scans.push(JSON.parse(result[1]) as Scan);
        } catch (e) {
            console.error(`Redis'ten tarama verisi parse edilemedi: ${result[1]}`, e);
        }
    }
  });
  
  return scans.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

// Belirli bir taramayı getir
export async function getScan(scanId: string): Promise<Scan | null> {
  const data = await redisClient.get(SCAN_KEY_PREFIX + scanId);
  if (!data) return null;
  try {
    return JSON.parse(data) as Scan;
  } catch (e) {
    console.error(`Redis'ten tarama verisi parse edilemedi (ID: ${scanId}): ${data}`, e);
    return null;
  }
}

// Belirli bir taramanın sonuçlarını getir (sayfalandırılmış)
export async function getScanResults(scanId: string, page = 0, limit = 20): Promise<ScanResult[]> {
  const start = page * limit;
  const end = start + limit - 1;
  const resultData = await redisClient.lrange(SCAN_RESULT_KEY_PREFIX + scanId, start, end);
  if (!resultData || resultData.length === 0) return [];
  
  return resultData.map((data: string) => JSON.parse(data) as ScanResult); // data: string
}

// Redis bellek optimizasyonu
export async function optimizeRedisMemory(): Promise<void> {
  console.log('Redis bellek optimizasyonu başlatılıyor...');
  const allScanKeys = await redisClient.keys(SCAN_KEY_PREFIX + '*');
  let totalOptimizedScans = 0;
  let totalOrphanedResultKeys = 0;

  for (const scanKey of allScanKeys) {
    const scanData = await redisClient.get(scanKey);
    if (scanData) {
      try {
        const scan = JSON.parse(scanData) as Scan;
        // Belirli bir süredir güncellenmemiş ve tamamlanmış/iptal edilmiş/başarısız olmuş taramalar için
        const optimizationThreshold = new Date(Date.now() - (config.scanner.resultTTL || 7) * 24 * 60 * 60 * 1000); // Varsayılan 7 gün
        
        if ((scan.status === 'completed' || scan.status === 'canceled' || scan.status === 'failed') && 
            new Date(scan.updatedAt) < optimizationThreshold) {
          
          // Sonuçları özetle (örneğin sadece ilk 1000 sonucu tut)
          const resultsKey = SCAN_RESULT_KEY_PREFIX + scan.id;
          const currentResultsCount = await redisClient.llen(resultsKey);
          const maxResultsToKeep = config.scanner.maxResultsToKeepAfterOptimization || 1000;

          if (currentResultsCount > maxResultsToKeep) {
            console.log(`Tarama ${scan.id} için sonuçlar optimize ediliyor. Mevcut: ${currentResultsCount}, Tutulacak: ${maxResultsToKeep}`);
            await redisClient.ltrim(resultsKey, 0, maxResultsToKeep - 1); 
          }
          totalOptimizedScans++;
        }
      } catch (e) {
        console.error(`Tarama verisi (${scanKey}) işlenirken hata:`, e);
      }
    }
  }
  if (totalOptimizedScans > 0) {
    console.log(`${totalOptimizedScans} taramanın sonuçları optimize edildi.`);
  }

  // Sahipsiz (orphaned) sonuç anahtarlarını bul ve sil
  const allResultKeys = await redisClient.keys(SCAN_RESULT_KEY_PREFIX + '*');
  for (const resultKey of allResultKeys) {
    const scanId = resultKey.replace(SCAN_RESULT_KEY_PREFIX, '');
    const correspondingScanKey = SCAN_KEY_PREFIX + scanId;
    if (!(await redisClient.exists(correspondingScanKey))) {
      console.log(`Sahipsiz sonuç anahtarı bulundu ve siliniyor: ${resultKey}`);
      await redisClient.del(resultKey);
      totalOrphanedResultKeys++;
    }
  }
  if (totalOrphanedResultKeys > 0) {
    console.log(`${totalOrphanedResultKeys} sahipsiz sonuç anahtarı silindi.`);
  }
  console.log('Redis bellek optimizasyonu tamamlandı.');
}

// Tarama sil
export async function deleteScan(scanId: string): Promise<boolean> {
  const scan = await getScan(scanId);
  if (!scan) {
    console.warn(`Silinecek tarama bulunamadı: ${scanId}`);
    return false;
  }

  // Eğer tarama aktifse veya duraklatılmışsa, önce iptal etmeye çalış
  if (scan.status === 'running' || scan.status === 'pending' || scan.status === 'paused') {
    try {
      console.log(`Aktif/bekleyen/duraklatılmış tarama (${scanId}) silinmeden önce iptal ediliyor...`);
      await cancelScan(scanId);
      // Kısa bir bekleme, iptal işleminin tamamlanması için
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (cancelError) {
      console.error(`Tarama (${scanId}) silinirken iptal etme hatası:`, cancelError);
      // Yine de silmeye devam et
    }
  }

  // Redis'ten tarama ve sonuçlarını sil
  const deletedScanCount = await redisClient.del(SCAN_KEY_PREFIX + scanId);
  const deletedResultsCount = await redisClient.del(SCAN_RESULT_KEY_PREFIX + scanId);

  if (deletedScanCount > 0) {
    console.log(`Tarama başarıyla silindi: ${scanId}`);
    return true;
  } else {
    console.warn(`Tarama (${scanId}) Redis'ten silinemedi veya zaten yoktu.`);
    return false;
  }
} 