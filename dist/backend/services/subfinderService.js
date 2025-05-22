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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSubfinderScan = exports.getSubfinderResults = exports.getSubfinderScan = exports.getAllSubfinderScans = exports.stopSubfinderScan = exports.startSubfinderScan = exports.createSubfinderScan = exports.SUBFINDER_RESULT_KEY_PREFIX = exports.SUBFINDER_KEY_PREFIX = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const uuid_1 = require("uuid");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const server_1 = require("../server");
const node_fetch_1 = __importDefault(require("node-fetch"));
const dns_1 = __importDefault(require("dns"));
const multiSubfinderService = __importStar(require("./multiSubfinderService")); // Çoklu tarama servisini import et
const execAsync = (0, util_1.promisify)(child_process_1.exec);
// Redis key önekleri (Export ediliyor)
exports.SUBFINDER_KEY_PREFIX = 'subfinder:';
exports.SUBFINDER_RESULT_KEY_PREFIX = 'subfinder:result:';
// Yeni Redis key önekleri (Çoklu Tarama için) - Bunlar multiSubfinderService.ts'de kalmalı
// const MULTI_SUBFINDER_JOB_KEY_PREFIX = 'multiSubfinder:job:'; 
// const MULTI_SUBFINDER_RESULTS_KEY_PREFIX = 'multiSubfinder:results:';
// Varsayılan değerler
const DEFAULT_TIMEOUT_SUBFINDER_MAIN = 300; // 5 dakika
const DEFAULT_THREADS = 10;
const DEFAULT_RESOLVERS = ['1.1.1.1', '8.8.8.8', '9.9.9.9'];
const DEFAULT_TIMEOUT_PERMUTATION = 120; // 2 dakika
const DEFAULT_TIMEOUT_DNS_DEEP_DIVE = 600; // 10 dakika
// SubFinder'ın kurulu olup olmadığını kontrol et
function isSubfinderInstalled() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield execAsync('subfinder -version'); // which subfinder yerine -version daha iyi bir kontrol olabilir
            return true;
        }
        catch (error) {
            console.error("Subfinder kurulu değil veya PATH'de bulunamıyor.", error);
            return false;
        }
    });
}
// Yeni bir SubFinder taraması oluştur
function createSubfinderScan(domain, options = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        const id = (0, uuid_1.v4)();
        const job = {
            id,
            domain,
            createdAt: new Date(),
            options: Object.assign({ timeout: options.timeout || DEFAULT_TIMEOUT_SUBFINDER_MAIN, threads: options.threads || DEFAULT_THREADS, resolvers: options.resolvers || [...DEFAULT_RESOLVERS] }, options),
            status: 'pending',
            multiJobId: options.multiJobId // multiJobId'yi options'dan al
        };
        yield server_1.redisClient.set(exports.SUBFINDER_KEY_PREFIX + id, JSON.stringify(job));
        return job;
    });
}
exports.createSubfinderScan = createSubfinderScan;
// SubFinder taramasını başlat
function startSubfinderScan(id) {
    return __awaiter(this, void 0, void 0, function* () {
        const jobData = yield getSubfinderScan(id);
        if (!jobData) {
            console.error(`startSubfinderScan: Başlatılacak iş bulunamadı: ${id}`);
            return null;
        }
        if (jobData.status === 'running') {
            console.warn(`startSubfinderScan: İş zaten çalışıyor: ${id}`);
            return jobData;
        }
        jobData.status = 'running';
        yield server_1.redisClient.set(exports.SUBFINDER_KEY_PREFIX + id, JSON.stringify(jobData));
        // Taramayı asenkron olarak başlat, multiJobId'yi ve domain bilgisini de geçir
        runSubfinderScan(id, jobData).catch((error) => __awaiter(this, void 0, void 0, function* () {
            console.error(`SubFinder taraması (${id}) çalıştırılırken hata:`, error);
            const updatedJob = yield getSubfinderScan(id);
            if (updatedJob) {
                updatedJob.status = 'failed';
                updatedJob.error = error instanceof Error ? error.message : String(error);
                yield server_1.redisClient.set(exports.SUBFINDER_KEY_PREFIX + id, JSON.stringify(updatedJob));
                // Eğer çoklu tarama işinin bir parçasıysa, ana işi de güncelle
                if (updatedJob.multiJobId && updatedJob.options.targetDomainForMultiJob) {
                    yield multiSubfinderService.updateMultiJobWithSingleScanResult(updatedJob.multiJobId, updatedJob.options.targetDomainForMultiJob, id, 'failed', updatedJob.error);
                }
            }
        }));
        return jobData;
    });
}
exports.startSubfinderScan = startSubfinderScan;
// SubFinder taramasını durdur
function stopSubfinderScan(id) {
    return __awaiter(this, void 0, void 0, function* () {
        const jobData = yield getSubfinderScan(id);
        if (!jobData)
            return null;
        if (jobData.status !== 'running') {
            return jobData;
        }
        // Tarama durumunu güncelle
        jobData.status = 'stopped';
        yield server_1.redisClient.set(exports.SUBFINDER_KEY_PREFIX + id, JSON.stringify(jobData));
        // Bu noktada taramayı durduracak bir işlem yapılabilir
        // Şu anda tarama zaten tamamlanmış veya hata vermiş olabilir
        return jobData;
    });
}
exports.stopSubfinderScan = stopSubfinderScan;
// Tüm SubFinder taramalarını getir
function getAllSubfinderScans() {
    return __awaiter(this, void 0, void 0, function* () {
        const keys = yield server_1.redisClient.keys(exports.SUBFINDER_KEY_PREFIX + '*');
        const jobKeys = keys.filter(key => !key.startsWith(exports.SUBFINDER_RESULT_KEY_PREFIX)); // Sadece iş anahtarlarını al, sonuç anahtarlarını dışla
        const scans = [];
        for (const key of jobKeys) { // jobKeys olarak düzeltildi
            const data = yield server_1.redisClient.get(key);
            if (data) {
                const scanJob = JSON.parse(data);
                // Sadece multiJobId'si olmayan (yani bağımsız tekil taramalar) işleri listeye ekle
                if (!scanJob.multiJobId) {
                    scans.push(scanJob);
                }
            }
        }
        return scans.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    });
}
exports.getAllSubfinderScans = getAllSubfinderScans;
// Belirli bir SubFinder taramasını getir
function getSubfinderScan(id) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield server_1.redisClient.get(exports.SUBFINDER_KEY_PREFIX + id);
        return data ? JSON.parse(data) : null;
    });
}
exports.getSubfinderScan = getSubfinderScan;
// SubFinder tarama sonuçlarını getir
function getSubfinderResults(id, page = 0, limit = 100) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`getSubfinderResults çağrıldı (${id}) - Redis'ten okumadan ÖNCE`);
        const data = yield server_1.redisClient.get(exports.SUBFINDER_RESULT_KEY_PREFIX + id);
        console.log(`getSubfinderResults (${id}) - Redis'ten okuduktan SONRA. Dönen veri: ${data ? 'VERİ VAR' : 'VERİ YOK (nil)'}, İçerik: ${data}`);
        if (data) {
            const results = JSON.parse(data);
            const startIndex = page * limit;
            return results.slice(startIndex, startIndex + limit);
        }
        // Redis'te yoksa dosyadan okumayı dene
        try {
            const outputFile = path_1.default.join(process.cwd(), 'temp', `subfinder-${id}.json`);
            const fileExists = yield promises_1.default.stat(outputFile).catch(() => false);
            if (fileExists) {
                console.log(`Redis'te sonuç bulunamadı, dosyadan okunuyor: ${outputFile}`);
                const resultData = yield promises_1.default.readFile(outputFile, 'utf-8');
                if (resultData && resultData.trim()) {
                    const results = resultData
                        .split('\n')
                        .filter(line => line.trim() !== '')
                        .map(line => {
                        try {
                            return JSON.parse(line);
                        }
                        catch (e) {
                            console.error(`JSON parse hatası (${id}, satır): ${line}`, e);
                            return null;
                        }
                    })
                        .filter((item) => item !== null);
                    // Sonuçları Redis'e kaydet
                    yield server_1.redisClient.set(exports.SUBFINDER_RESULT_KEY_PREFIX + id, JSON.stringify(results));
                    // İstenen sayfayı döndür
                    const startIndex = page * limit;
                    return results.slice(startIndex, startIndex + limit);
                }
            }
        }
        catch (error) {
            console.error(`Dosyadan sonuçları okuma hatası (${id}):`, error);
        }
        // Hiçbir yerden sonuç alınamadıysa boş dizi döndür
        return [];
    });
}
exports.getSubfinderResults = getSubfinderResults;
// Belirli bir SubFinder taramasını sil
function deleteSubfinderScan(id) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const scan = yield getSubfinderScan(id);
            if (!scan)
                throw new Error('SubFinder taraması bulunamadı');
            console.log(`SubFinder taraması siliniyor: ${id}`);
            // Önce taramayı durdur (eğer hala çalışıyorsa)
            if (scan.status === 'running') {
                yield stopSubfinderScan(id);
                // Kısa bir bekleme ekle
                yield new Promise(resolve => setTimeout(resolve, 1000));
            }
            // Redis'ten tarama verilerini sil
            const redisKeys = [
                exports.SUBFINDER_KEY_PREFIX + id, // Ana tarama verisi
                exports.SUBFINDER_RESULT_KEY_PREFIX + id, // Tarama sonuçları
            ];
            // Tüm tarama ile ilgili redis anahtarlarını sil
            for (const key of redisKeys) {
                yield server_1.redisClient.del(key);
            }
            return true;
        }
        catch (error) {
            console.error(`SubFinder taraması silinirken hata (${id}):`, error);
            return false;
        }
    });
}
exports.deleteSubfinderScan = deleteSubfinderScan;
// DNS kayıtlarını derinlemesine inceleme
function performDeepDnsSearch(domain, parentScanId, timeout) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`[${parentScanId}] Derinlemesine DNS araştırması başlıyor: ${domain}`);
        const additionalDomains = new Set();
        const recordTypes = ['MX', 'TXT', 'CNAME', 'SRV', 'NS'];
        for (const type of recordTypes) {
            try {
                // Zaman aşımı ile dig komutu
                const { stdout } = yield Promise.race([
                    execAsync(`dig ${type} ${domain} +short +time=${Math.floor(timeout / recordTypes.length)} +retry=1`),
                    new Promise((_, reject) => setTimeout(() => reject(new Error(`Dig ${type} timeout for ${domain}`)), timeout * 1000 / recordTypes.length))
                ]);
                const lines = stdout.split('\n').filter(line => line.trim() !== '');
                lines.forEach(line => {
                    // Basit domain çıkarma (daha sofistike olabilir)
                    const found = line.match(/([a-zA-Z0-9\-_]+\.)+[a-zA-Z]{2,}/g);
                    if (found) {
                        found.forEach(f => {
                            if (f.endsWith('.'))
                                f = f.slice(0, -1);
                            if (f !== domain && f.includes('.'))
                                additionalDomains.add(f);
                        });
                    }
                });
            }
            catch (error) {
                console.warn(`[${parentScanId}] ${type} kaydı alınamadı (${domain}): ${error.message}`);
            }
        }
        console.log(`[${parentScanId}] Derinlemesine DNS tamamlandı, ${additionalDomains.size} potansiyel domain.`);
        return Array.from(additionalDomains);
    });
}
// Wayback Machine'den tarihsel subdomain'leri çıkar
function getWaybackDomains(domain, parentScanId) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`[${parentScanId}] Wayback Machine ve CommonCrawl taraması başlıyor: ${domain}`);
        const subdomains = new Set();
        const urlsToFetch = [
            `http://web.archive.org/cdx/search/cdx?url=*.${domain}/*&output=json&fl=original&collapse=urlkey&limit=10000`,
            `https://index.commoncrawl.org/CC-MAIN-2023-50-index?url=*.${domain}&output=json&limit=5000` // Örnek bir CommonCrawl index
        ];
        for (const apiUrl of urlsToFetch) {
            try {
                // node-fetch için timeout'u RequestInit içinde signal ile sağlıyoruz.
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 saniye timeout
                const response = yield (0, node_fetch_1.default)(apiUrl, { signal: controller.signal });
                clearTimeout(timeoutId);
                if (!response.ok) {
                    console.warn(`[${parentScanId}] Arşiv API hatası (${apiUrl}): ${response.status} ${response.statusText}`);
                    continue;
                }
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const data = yield response.json();
                    if (apiUrl.includes('web.archive.org')) {
                        // İlk satır başlık olabilir, kontrol et
                        const startIndex = Array.isArray(data[0]) && data[0][0] === 'original' ? 1 : 0;
                        for (let i = startIndex; i < data.length; i++) {
                            if (Array.isArray(data[i]) && data[i][0]) {
                                try {
                                    new URL(data[i][0]);
                                    subdomains.add(new URL(data[i][0]).hostname);
                                }
                                catch (_a) { }
                            }
                        }
                    }
                }
                else {
                    const textData = yield response.text();
                    const lines = textData.split('\n');
                    lines.forEach(line => {
                        try {
                            if (apiUrl.includes('commoncrawl.org')) {
                                const jsonLine = JSON.parse(line);
                                if (jsonLine.url) {
                                    try {
                                        new URL(jsonLine.url);
                                        subdomains.add(new URL(jsonLine.url).hostname);
                                    }
                                    catch (_a) { }
                                }
                            }
                        }
                        catch (_b) { }
                    });
                }
            }
            catch (error) {
                console.error(`[${parentScanId}] Arşiv API genel hata (${apiUrl}):`, error.message);
            }
        }
        const finalSubdomains = new Set();
        subdomains.forEach(h => {
            if (h.endsWith(`.${domain}`) && h !== domain) {
                finalSubdomains.add(h);
            }
        });
        console.log(`[${parentScanId}] Arşiv taraması tamamlandı, ${finalSubdomains.size} benzersiz subdomain.`);
        return Array.from(finalSubdomains);
    });
}
// SubFinder taramasını çalıştır
function runSubfinderScan(id, jobData) {
    return __awaiter(this, void 0, void 0, function* () {
        let results = [];
        const { domain, options, multiJobId } = jobData; // multiJobId'yi buradan al
        const targetDomainForMultiJob = options.targetDomainForMultiJob;
        const outputDir = path_1.default.join(process.cwd(), 'temp');
        const tempOutputFile = path_1.default.join(outputDir, `subfinder-${id}.json`);
        let scanError = undefined;
        let finalStatus = 'failed'; // Varsayılan olarak failed
        try {
            console.log(`[${id}] runSubfinderScan başladı. Domain: ${domain}`);
            const isInstalled = yield isSubfinderInstalled();
            if (!isInstalled) {
                throw new Error('SubFinder kurulu değil. Lütfen önce SubFinder\'ı yükleyin.');
            }
            try {
                yield promises_1.default.access(outputDir);
            }
            catch (_a) {
                yield promises_1.default.mkdir(outputDir, { recursive: true });
            }
            yield promises_1.default.writeFile(tempOutputFile, ''); // Mevcut dosyayı temizle
            const subfinderCmdParts = constructSubfinderCommand(domain, tempOutputFile, options);
            const subfinderCmd = 'subfinder';
            console.log(`[${id}] SubFinder komutu çalıştırılacak: ${subfinderCmd} ${subfinderCmdParts.join(' ')}`);
            let execResult;
            try {
                execResult = yield execAsync(`${subfinderCmd} ${subfinderCmdParts.join(' ')}`, { timeout: (options.timeout || DEFAULT_TIMEOUT_SUBFINDER_MAIN) * 1000 + 10000 } // Komut zaman aşımına biraz pay ekle
                );
            }
            catch (execError) {
                console.error(`[${id}] execAsync HATASI:`, execError);
                if (execError.stdout)
                    console.error(`[${id}] execAsync Hata stdout: ${execError.stdout}`);
                if (execError.stderr)
                    console.error(`[${id}] execAsync Hata stderr: ${execError.stderr}`);
                throw execError; // Hatayı tekrar fırlat ki ana catch bloğu yakalasın
            }
            const { stdout, stderr } = execResult;
            console.log(`[${id}] SubFinder komutu tamamlandı. stdout: ${stdout ? stdout.substring(0, 100) : 'BOŞ'}, stderr: ${stderr ? stderr.substring(0, 100) : 'BOŞ'}`);
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
            const fileExists = yield promises_1.default.stat(tempOutputFile).catch(() => false);
            if (!fileExists) {
                throw new Error('SubFinder çıktı dosyası oluşturulamadı.');
            }
            const fileContent = yield promises_1.default.readFile(tempOutputFile, 'utf-8');
            if (fileContent && fileContent.trim()) {
                const lines = fileContent.split('\n').filter(line => line.trim() !== '');
                results = lines.map(line => {
                    try {
                        return JSON.parse(line);
                    }
                    catch (e) {
                        console.warn(`SubFinder sonucu ayrıştırılamadı (${id}): ${line}`);
                        return null;
                    }
                }).filter((item) => item !== null);
                console.log(`SubFinder temel tarama sonuçları parse edildi (${id}): ${results.length} adet.`);
            }
            else {
                console.warn(`SubFinder sonuç dosyası boş veya okunamadı (${id}).`);
            }
            // Ek taramalar (Permütasyon, Deep DNS, Wayback)
            // Bu fonksiyonlar artık results dizisini doğrudan değiştirecek ve loglama yapacak.
            if (options.usePermutations && options.permutationMode) {
                const permResults = yield performPermutationScan(domain, options.permutationMode, results.map(r => r.host), options.timeout || DEFAULT_TIMEOUT_PERMUTATION, id);
                results.push(...permResults);
            }
            if (options.deepDnsSearch) {
                const dnsResults = yield performDeepDnsSearch(domain, id, options.timeout || DEFAULT_TIMEOUT_DNS_DEEP_DIVE);
                // Yinelenenleri kontrol ederek ekle
                dnsResults.forEach(dr => { if (!results.some(r => r.host === dr))
                    results.push({ host: dr, source: ['deep-dns'], input: domain }); });
            }
            if (options.useWaybackMachine) {
                const waybackResults = yield getWaybackDomains(domain, id);
                waybackResults.forEach(wr => { if (!results.some(r => r.host === wr))
                    results.push({ host: wr, source: ['archive-search'], input: domain }); });
            }
            finalStatus = 'completed';
            console.log(`SubFinder taraması (${id}) tüm adımlarıyla ${results.length} sonuçla tamamlandı.`);
        }
        catch (error) {
            console.error(`[${id}] runSubfinderScan genel HATA:`, error);
            scanError = error.message || String(error);
            finalStatus = 'failed';
        }
        finally {
            try {
                if (yield promises_1.default.stat(tempOutputFile).catch(() => false)) {
                    yield promises_1.default.unlink(tempOutputFile);
                    // console.log(`Geçici SubFinder çıktı dosyası silindi: ${tempOutputFile}`);
                }
            }
            catch (cleanupError) {
                console.warn(`Geçici SubFinder çıktı dosyası (${tempOutputFile}) silinirken hata:`, cleanupError);
            }
            // Tarama durumunu ve sonuçlarını Redis'e kaydet
            const currentJobData = yield getSubfinderScan(id);
            if (currentJobData) {
                currentJobData.status = finalStatus;
                currentJobData.error = scanError;
                // currentJobData.result = results; // Sonuçları doğrudan buraya yazmak yerine ayrı bir key'de tutuyoruz
                yield server_1.redisClient.set(exports.SUBFINDER_KEY_PREFIX + id, JSON.stringify(currentJobData));
                // Sonuçları ayrı bir anahtara kaydet
                yield server_1.redisClient.set(exports.SUBFINDER_RESULT_KEY_PREFIX + id, JSON.stringify(results));
                console.log(`Tekil tarama (${id}) durumu: ${finalStatus}, Sonuç sayısı: ${results.length}, Hata: ${scanError || 'Yok'}`);
                // Eğer çoklu tarama işinin bir parçasıysa, ana işi güncelle
                if (multiJobId && targetDomainForMultiJob) {
                    console.log(`[${id}] Multi-job güncellemesi tetikleniyor (finally bloğunda): multiJobId=${multiJobId}, domain=${targetDomainForMultiJob}, status=${finalStatus}`);
                    try { // updateMultiJobWithSingleScanResult etrafına try-catch ekle
                        yield multiSubfinderService.updateMultiJobWithSingleScanResult(multiJobId, targetDomainForMultiJob, id, // singleScanId
                        finalStatus, scanError, finalStatus === 'completed' ? results.length : 0);
                    }
                    catch (updateError) {
                        console.error(`[${id}] updateMultiJobWithSingleScanResult çağrılırken HATA:`, updateError);
                    }
                }
            }
            else {
                console.warn(`runSubfinderScan: Tarama durumu güncellenemedi, iş bulunamadı: ${id}`);
            }
        }
    });
}
function constructSubfinderCommand(domain, outputPath, options) {
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
    }
    else {
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
function performPermutationScan(mainDomain, mode, existingSubdomains, timeout, parentScanId) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`[${parentScanId}] Permütasyon taraması başlıyor: ${mainDomain}, Mod: ${mode}`);
        const results = [];
        const wordlistFilename = mode === 'full' ? 'subdomains_full.txt' : 'subdomains_short.txt';
        const wordlistPath = path_1.default.join(process.cwd(), 'wordlists', wordlistFilename);
        try {
            const wordlistContent = yield promises_1.default.readFile(wordlistPath, 'utf-8');
            const prefixes = wordlistContent.split('\n').filter(line => line.trim() !== '');
            const dnsPromises = dns_1.default.promises;
            const limitedPrefixes = prefixes.slice(0, mode === 'short' ? 20 : prefixes.length); // Kısa modda ilk 20
            for (const prefix of limitedPrefixes) {
                const potentialSubdomain = `${prefix}.${mainDomain}`;
                if (existingSubdomains.includes(potentialSubdomain) || results.some(r => r.host === potentialSubdomain)) {
                    continue;
                }
                try {
                    // Zaman aşımı ile DNS lookup
                    const address = yield Promise.race([
                        dnsPromises.lookup(potentialSubdomain),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('DNS lookup timeout')), timeout * 1000 / limitedPrefixes.length)) // Her birine düşen süre
                    ]);
                    if (address && address.address) {
                        results.push({ host: potentialSubdomain, source: ['permutation'], ip: address.address, input: mainDomain });
                        // console.log(`[${parentScanId}] Permütasyonla bulundu: ${potentialSubdomain}`);
                    }
                }
                catch (dnsError) {
                    // console.log(`[${parentScanId}] Permütasyon DNS hatası (${potentialSubdomain}): ${dnsError.message}`);
                }
            }
        }
        catch (error) {
            console.error(`[${parentScanId}] Permütasyon wordlist okuma hatası (${wordlistPath}):`, error);
        }
        console.log(`[${parentScanId}] Permütasyon taraması tamamlandı, ${results.length} yeni sonuç.`);
        return results;
    });
}
//# sourceMappingURL=subfinderService.js.map