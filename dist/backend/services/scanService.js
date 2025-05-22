"use strict";
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
exports.deleteScan = exports.optimizeRedisMemory = exports.getScanResults = exports.getScan = exports.getAllScans = exports.updateScannedDomains = exports.addScanResult = exports.cancelScan = exports.pauseScan = exports.startScan = exports.updateScanStatus = exports.createScan = void 0;
const uuid_1 = require("uuid");
const redisClient_1 = require("../redisClient");
const scanQueue_1 = require("../queues/scanQueue");
const domainService_1 = require("./domainService");
const config_1 = require("../config");
// Redis anahtarları için ön ek
const SCAN_KEY_PREFIX = 'scan:';
const SCAN_RESULT_KEY_PREFIX = 'scan_results:';
// Tarama oluştur
function createScan(configData) {
    return __awaiter(this, void 0, void 0, function* () {
        const now = new Date();
        const scanId = (0, uuid_1.v4)();
        // Tarama konfigürasyonu oluştur
        const scanConfig = Object.assign(Object.assign({ id: (0, uuid_1.v4)() }, configData), { currentIndex: configData.startIndex, createdAt: now, updatedAt: now });
        // Tarama nesnesi oluştur
        const scan = {
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
        yield redisClient_1.redisClient.set(SCAN_KEY_PREFIX + scanId, JSON.stringify(scan));
        return scan;
    });
}
exports.createScan = createScan;
// Tarama durumunu güncelle
function updateScanStatus(scanId, status) {
    return __awaiter(this, void 0, void 0, function* () {
        const scan = yield getScan(scanId);
        if (!scan)
            throw new Error('Tarama bulunamadı');
        // Tarama durumunu güncelle
        const updatedScan = Object.assign(Object.assign({}, scan), { status, updatedAt: new Date() });
        // Özel durum güncellemeleri
        if (status === 'completed') {
            updatedScan.completedAt = new Date();
        }
        else if (status === 'paused') {
            updatedScan.pausedAt = new Date();
        }
        else if (status === 'running' && scan.status === 'pending') {
            updatedScan.startedAt = new Date();
        }
        // Redis'e kaydet
        yield redisClient_1.redisClient.set(SCAN_KEY_PREFIX + scanId, JSON.stringify(updatedScan));
        return updatedScan;
    });
}
exports.updateScanStatus = updateScanStatus;
// Tarama başlat
function startScan(scanId) {
    return __awaiter(this, void 0, void 0, function* () {
        const scan = yield getScan(scanId);
        if (!scan)
            throw new Error('Tarama bulunamadı');
        // Sadece pending veya paused durumundaki taramalar başlatılabilir
        if (scan.status !== 'pending' && scan.status !== 'paused') {
            throw new Error(`Bu tarama şu anda ${scan.status} durumunda, başlatılamaz`);
        }
        try {
            // Kuyruğun çalıştığından emin ol
            yield (0, scanQueue_1.resumeQueue)();
            // Eğer duraklatılmış bir tarama ise, kaldığı yerden devam ettir
            if (scan.status === 'paused') {
                console.log(`Duraklatılmış tarama kaldığı yerden devam ediyor: ${scanId}, index: ${scan.config.currentIndex}`);
                // Mevcut indeks doğru mu kontrol et
                if (scan.config.currentIndex < scan.config.startIndex) {
                    console.warn(`Geçersiz currentIndex değeri: ${scan.config.currentIndex}, startIndex'e geri dönülüyor: ${scan.config.startIndex}`);
                    // Tarama konfigürasyonunu güncelle
                    const updatedScan = Object.assign(Object.assign({}, scan), { config: Object.assign(Object.assign({}, scan.config), { currentIndex: scan.config.startIndex, updatedAt: new Date() }), updatedAt: new Date() });
                    // Redis'e kaydet
                    yield redisClient_1.redisClient.set(SCAN_KEY_PREFIX + scanId, JSON.stringify(updatedScan));
                    // Güncellenmiş taramayı getir
                    const refreshedScan = yield getScan(scanId);
                    if (!refreshedScan)
                        throw new Error('Tarama bulunamadı');
                    // Devam et
                    yield (0, scanQueue_1.resumeScan)(scanId);
                }
                else {
                    // Normal devam et
                    yield (0, scanQueue_1.resumeScan)(scanId);
                }
                // Tarama durumunu running olarak güncelle
                const updatedScan = yield updateScanStatus(scanId, 'running');
                return updatedScan;
            }
            // Domain listesini al
            const domainList = yield (0, domainService_1.getDomainList)(scan.config.domainListId);
            if (!domainList)
                throw new Error('Domain listesi bulunamadı');
            // Taramayı kuyruğa ekle
            yield scanQueue_1.scanQueue.add({
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
            const updatedScan = yield updateScanStatus(scanId, 'running');
            console.log(`Tarama başlatıldı: ${scanId}, başlangıç indeksi: ${scan.config.currentIndex}`);
            return updatedScan;
        }
        catch (error) {
            console.error(`Tarama başlatma hatası (${scanId}):`, error);
            throw error;
        }
    });
}
exports.startScan = startScan;
// Taramayı durdur
function pauseScan(scanId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Tarama bilgilerini al
            const scan = yield getScan(scanId);
            if (!scan)
                throw new Error('Tarama bulunamadı');
            // Sadece running durumundaki taramalar durdurulabilir
            if (scan.status !== 'running') {
                throw new Error(`Bu tarama şu anda ${scan.status} durumunda, durdurulamaz`);
            }
            console.log(`Tarama durduruluyor: ${scanId}`);
            // İşlemi önce duruma "pausing" olarak ayarla (gecikmeli durum güncellemesi)
            const pausingStatus = 'paused';
            yield updateScanStatus(scanId, pausingStatus);
            // Durdurma bayrağını ayarla
            const stopped = yield (0, scanQueue_1.stopScan)(scanId);
            if (!stopped) {
                console.warn(`Tarama durdurma işleminde sorun oluştu, buna rağmen tarama durumu paused olarak işaretleniyor: ${scanId}`);
            }
            // Durdurma işlemi gerçekleşene kadar kısa bir süre bekle
            // Önemli: Bu, büyük veri kümelerinde işlemi daha güvenilir hale getirir
            yield new Promise((resolve) => setTimeout(resolve, 3000));
            // Taramayı tekrar kontrol et
            const updatedScan = yield getScan(scanId);
            if (!updatedScan)
                throw new Error('Tarama bulunamadı');
            console.log(`Tarama durduruldu: ${scanId}, mevcut indeks: ${updatedScan.config.currentIndex}`);
            return updatedScan;
        }
        catch (error) {
            console.error(`Tarama duraklatma hatası (${scanId}):`, error);
            // Hata olsa bile durumu güncellemeye çalış
            try {
                const scan = yield getScan(scanId);
                if (scan && scan.status === 'running') {
                    console.log(`Hata oluştu ancak tarama durumu paused olarak işaretleniyor: ${scanId}`);
                    const updatedScan = yield updateScanStatus(scanId, 'paused');
                    return updatedScan;
                }
                else if (scan) {
                    // Zaten güncellenmiş olabilir, mevcut scan'i döndür
                    return scan;
                }
            }
            catch (innerError) {
                console.error(`Tarama durum güncelleme hatası (${scanId}):`, innerError);
            }
            // Hala bir değer döndürülmediyse, orijinal hatayı fırlat
            throw error;
        }
    });
}
exports.pauseScan = pauseScan;
// Taramayı iptal et
function cancelScan(scanId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Tarama bilgilerini al
            const scan = yield getScan(scanId);
            if (!scan)
                throw new Error('Tarama bulunamadı');
            console.log(`Tarama iptal ediliyor: ${scanId}, mevcut durum: ${scan.status}`);
            // Durum kontrolü - tamamlanmış tarama iptal edilemez
            if (scan.status === 'completed') {
                throw new Error('Tamamlanmış taramalar iptal edilemez');
            }
            // İlk olarak durumu iptal ediliyor olarak işaretle
            yield updateScanStatus(scanId, 'canceled');
            // Durdurma bayrağını ayarla - redis'e de kaydedecek 
            const stopped = yield (0, scanQueue_1.stopScan)(scanId);
            if (!stopped) {
                console.warn(`Tarama durdurma işleminde sorun oluştu, buna rağmen tarama durumu canceled olarak işaretlendi: ${scanId}`);
            }
            // İptal işlemi için kısa bir bekleme
            yield new Promise(resolve => setTimeout(resolve, 1000));
            // Son durumu kontrol et
            const updatedScan = yield getScan(scanId);
            if (!updatedScan)
                throw new Error('Tarama bulunamadı');
            console.log(`Tarama iptal edildi: ${scanId}`);
            // Redis'teki sonuçları korumak isteyip istemediğimize karar ver
            // İsterseniz Redis'teki scan:* ve scan_results:* önekli anahtarları burada temizleyebilirsiniz
            return updatedScan;
        }
        catch (error) {
            console.error(`Tarama iptal hatası (${scanId}):`, error);
            // Hata durumunda kontrol
            try {
                const scan = yield getScan(scanId);
                if (scan) {
                    // Tarama hala var, güncel hali döndür
                    return scan;
                }
            }
            catch (_a) { }
            // Hala bir değer döndürülmediyse, orijinal hatayı fırlat
            throw error;
        }
    });
}
exports.cancelScan = cancelScan;
// Tarama sonucunu ekle
function addScanResult(scanId, result) {
    return __awaiter(this, void 0, void 0, function* () {
        const scan = yield getScan(scanId);
        if (!scan)
            throw new Error('Tarama bulunamadı');
        // Sonucu Redis listesine ekle (en yeni sonuçlar başta olacak şekilde)
        yield redisClient_1.redisClient.lpush(SCAN_RESULT_KEY_PREFIX + scanId, JSON.stringify(result));
        // Tarama ilerlemesini güncelle
        const updatedScan = Object.assign(Object.assign({}, scan), { progress: Object.assign(Object.assign({}, scan.progress), { foundResults: (scan.progress.foundResults || 0) + 1 }), updatedAt: new Date() });
        yield redisClient_1.redisClient.set(SCAN_KEY_PREFIX + scanId, JSON.stringify(updatedScan));
    });
}
exports.addScanResult = addScanResult;
// Taranan domain sayısını ve mevcut indeksi güncelle
function updateScannedDomains(scanId, currentIndex) {
    return __awaiter(this, void 0, void 0, function* () {
        const scan = yield getScan(scanId);
        if (!scan)
            throw new Error('Tarama bulunamadı');
        const updatedScan = Object.assign(Object.assign({}, scan), { config: Object.assign(Object.assign({}, scan.config), { currentIndex: currentIndex }), progress: Object.assign(Object.assign({}, scan.progress), { scannedDomains: (scan.progress.scannedDomains || 0) + 1 }), updatedAt: new Date() });
        yield redisClient_1.redisClient.set(SCAN_KEY_PREFIX + scanId, JSON.stringify(updatedScan));
    });
}
exports.updateScannedDomains = updateScannedDomains;
// Tüm taramaları getir
function getAllScans() {
    return __awaiter(this, void 0, void 0, function* () {
        const keys = yield redisClient_1.redisClient.keys(SCAN_KEY_PREFIX + '*');
        const scans = [];
        if (keys.length === 0)
            return scans;
        const pipeline = redisClient_1.redisClient.pipeline();
        keys.forEach(key => pipeline.get(key));
        const results = yield pipeline.exec(); // Tip belirlemesi
        results.forEach((result) => {
            if (result && result[1]) { // Hata kontrolü ve veri varlığı kontrolü
                try {
                    scans.push(JSON.parse(result[1]));
                }
                catch (e) {
                    console.error(`Redis'ten tarama verisi parse edilemedi: ${result[1]}`, e);
                }
            }
        });
        return scans.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    });
}
exports.getAllScans = getAllScans;
// Belirli bir taramayı getir
function getScan(scanId) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield redisClient_1.redisClient.get(SCAN_KEY_PREFIX + scanId);
        if (!data)
            return null;
        try {
            return JSON.parse(data);
        }
        catch (e) {
            console.error(`Redis'ten tarama verisi parse edilemedi (ID: ${scanId}): ${data}`, e);
            return null;
        }
    });
}
exports.getScan = getScan;
// Belirli bir taramanın sonuçlarını getir (sayfalandırılmış)
function getScanResults(scanId, page = 0, limit = 20) {
    return __awaiter(this, void 0, void 0, function* () {
        const start = page * limit;
        const end = start + limit - 1;
        const resultData = yield redisClient_1.redisClient.lrange(SCAN_RESULT_KEY_PREFIX + scanId, start, end);
        if (!resultData || resultData.length === 0)
            return [];
        return resultData.map((data) => JSON.parse(data)); // data: string
    });
}
exports.getScanResults = getScanResults;
// Redis bellek optimizasyonu
function optimizeRedisMemory() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Redis bellek optimizasyonu başlatılıyor...');
        const allScanKeys = yield redisClient_1.redisClient.keys(SCAN_KEY_PREFIX + '*');
        let totalOptimizedScans = 0;
        let totalOrphanedResultKeys = 0;
        for (const scanKey of allScanKeys) {
            const scanData = yield redisClient_1.redisClient.get(scanKey);
            if (scanData) {
                try {
                    const scan = JSON.parse(scanData);
                    // Belirli bir süredir güncellenmemiş ve tamamlanmış/iptal edilmiş/başarısız olmuş taramalar için
                    const optimizationThreshold = new Date(Date.now() - (config_1.config.scanner.resultTTL || 7) * 24 * 60 * 60 * 1000); // Varsayılan 7 gün
                    if ((scan.status === 'completed' || scan.status === 'canceled' || scan.status === 'failed') &&
                        new Date(scan.updatedAt) < optimizationThreshold) {
                        // Sonuçları özetle (örneğin sadece ilk 1000 sonucu tut)
                        const resultsKey = SCAN_RESULT_KEY_PREFIX + scan.id;
                        const currentResultsCount = yield redisClient_1.redisClient.llen(resultsKey);
                        const maxResultsToKeep = config_1.config.scanner.maxResultsToKeepAfterOptimization || 1000;
                        if (currentResultsCount > maxResultsToKeep) {
                            console.log(`Tarama ${scan.id} için sonuçlar optimize ediliyor. Mevcut: ${currentResultsCount}, Tutulacak: ${maxResultsToKeep}`);
                            yield redisClient_1.redisClient.ltrim(resultsKey, 0, maxResultsToKeep - 1);
                        }
                        totalOptimizedScans++;
                    }
                }
                catch (e) {
                    console.error(`Tarama verisi (${scanKey}) işlenirken hata:`, e);
                }
            }
        }
        if (totalOptimizedScans > 0) {
            console.log(`${totalOptimizedScans} taramanın sonuçları optimize edildi.`);
        }
        // Sahipsiz (orphaned) sonuç anahtarlarını bul ve sil
        const allResultKeys = yield redisClient_1.redisClient.keys(SCAN_RESULT_KEY_PREFIX + '*');
        for (const resultKey of allResultKeys) {
            const scanId = resultKey.replace(SCAN_RESULT_KEY_PREFIX, '');
            const correspondingScanKey = SCAN_KEY_PREFIX + scanId;
            if (!(yield redisClient_1.redisClient.exists(correspondingScanKey))) {
                console.log(`Sahipsiz sonuç anahtarı bulundu ve siliniyor: ${resultKey}`);
                yield redisClient_1.redisClient.del(resultKey);
                totalOrphanedResultKeys++;
            }
        }
        if (totalOrphanedResultKeys > 0) {
            console.log(`${totalOrphanedResultKeys} sahipsiz sonuç anahtarı silindi.`);
        }
        console.log('Redis bellek optimizasyonu tamamlandı.');
    });
}
exports.optimizeRedisMemory = optimizeRedisMemory;
// Tarama sil
function deleteScan(scanId) {
    return __awaiter(this, void 0, void 0, function* () {
        const scan = yield getScan(scanId);
        if (!scan) {
            console.warn(`Silinecek tarama bulunamadı: ${scanId}`);
            return false;
        }
        // Eğer tarama aktifse veya duraklatılmışsa, önce iptal etmeye çalış
        if (scan.status === 'running' || scan.status === 'pending' || scan.status === 'paused') {
            try {
                console.log(`Aktif/bekleyen/duraklatılmış tarama (${scanId}) silinmeden önce iptal ediliyor...`);
                yield cancelScan(scanId);
                // Kısa bir bekleme, iptal işleminin tamamlanması için
                yield new Promise(resolve => setTimeout(resolve, 1500));
            }
            catch (cancelError) {
                console.error(`Tarama (${scanId}) silinirken iptal etme hatası:`, cancelError);
                // Yine de silmeye devam et
            }
        }
        // Redis'ten tarama ve sonuçlarını sil
        const deletedScanCount = yield redisClient_1.redisClient.del(SCAN_KEY_PREFIX + scanId);
        const deletedResultsCount = yield redisClient_1.redisClient.del(SCAN_RESULT_KEY_PREFIX + scanId);
        if (deletedScanCount > 0) {
            console.log(`Tarama başarıyla silindi: ${scanId}`);
            return true;
        }
        else {
            console.warn(`Tarama (${scanId}) Redis'ten silinemedi veya zaten yoktu.`);
            return false;
        }
    });
}
exports.deleteScan = deleteScan;
//# sourceMappingURL=scanService.js.map