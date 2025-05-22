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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDomainListDomains = exports.getDomainList = exports.getAllDomainLists = exports.deleteDomainList = exports.importDomainsFromCsv = exports.addDomainToList = exports.updateDomainList = exports.createDomainList = void 0;
const uuid_1 = require("uuid");
const redisClient_1 = require("../redisClient");
const fs_1 = __importDefault(require("fs"));
const sync_1 = require("csv-parse/sync");
// Redis anahtarları için ön ek
const DOMAIN_LIST_KEY_PREFIX = 'domain_list:';
const DOMAIN_KEY_PREFIX = 'domains:';
// Domain listesi oluştur
function createDomainList(name, source) {
    return __awaiter(this, void 0, void 0, function* () {
        const now = new Date();
        const id = (0, uuid_1.v4)();
        const list = {
            id,
            name,
            source,
            createdAt: now,
            updatedAt: now,
            domains: []
        };
        // Redis'e kaydet
        yield redisClient_1.redisClient.set(DOMAIN_LIST_KEY_PREFIX + id, JSON.stringify(list));
        return list;
    });
}
exports.createDomainList = createDomainList;
// Domain listesini güncelle
function updateDomainList(listId, data) {
    return __awaiter(this, void 0, void 0, function* () {
        // Mevcut listeyi kontrol et
        const list = yield getDomainList(listId);
        if (!list)
            return null;
        // Listeyi güncelle
        const updatedList = Object.assign(Object.assign(Object.assign({}, list), data), { updatedAt: new Date() });
        // Redis'e güncellenmiş listeyi kaydet
        yield redisClient_1.redisClient.set(DOMAIN_LIST_KEY_PREFIX + listId, JSON.stringify(updatedList));
        // Domainler güncellenecekse
        if (data.domains) {
            // Mevcut domainleri temizle
            yield redisClient_1.redisClient.del(DOMAIN_KEY_PREFIX + listId);
            // Yeni domainleri ekle
            for (const domain of data.domains) {
                yield redisClient_1.redisClient.lpush(DOMAIN_KEY_PREFIX + listId, JSON.stringify({
                    id: domain.id || (0, uuid_1.v4)(),
                    domain: domain.domain,
                    rank: domain.rank
                }));
            }
        }
        // Güncellenmiş listeyi döndür
        return getDomainList(listId);
    });
}
exports.updateDomainList = updateDomainList;
// Domain listesine domain ekle
function addDomainToList(listId, domain) {
    return __awaiter(this, void 0, void 0, function* () {
        const list = yield getDomainList(listId);
        if (!list)
            throw new Error('Domain listesi bulunamadı');
        const newDomain = {
            id: (0, uuid_1.v4)(),
            domain
        };
        // Domain'i Redis'e ekle
        yield redisClient_1.redisClient.lpush(DOMAIN_KEY_PREFIX + listId, JSON.stringify(newDomain));
        return newDomain;
    });
}
exports.addDomainToList = addDomainToList;
// CSV dosyasından domainleri yükle
function importDomainsFromCsv(listId, filePath, delimiter = ',') {
    return __awaiter(this, void 0, void 0, function* () {
        const list = yield getDomainList(listId);
        if (!list)
            throw new Error('Domain listesi bulunamadı');
        // CSV dosyasını oku
        const fileContent = fs_1.default.readFileSync(filePath, { encoding: 'utf-8' });
        // CSV'yi ayrıştır
        const records = (0, sync_1.parse)(fileContent, {
            columns: true,
            skip_empty_lines: true,
            delimiter
        });
        let added = 0;
        const domainColumn = records.length > 0 && records[0].domain ? 'domain' : 'Domain';
        // Her kayıt için domain oluştur ve Redis'e ekle
        for (const record of records) {
            if (record[domainColumn]) {
                const domain = record[domainColumn].trim().toLowerCase();
                if (domain) {
                    const newDomain = {
                        id: (0, uuid_1.v4)(),
                        domain
                    };
                    yield redisClient_1.redisClient.lpush(DOMAIN_KEY_PREFIX + listId, JSON.stringify(newDomain));
                    added++;
                }
            }
        }
        // Liste metadatasını güncelle
        list.updatedAt = new Date();
        yield redisClient_1.redisClient.set(DOMAIN_LIST_KEY_PREFIX + listId, JSON.stringify(list));
        return { total: records.length, added };
    });
}
exports.importDomainsFromCsv = importDomainsFromCsv;
// Domain listesi sil
function deleteDomainList(listId) {
    return __awaiter(this, void 0, void 0, function* () {
        const exists = yield redisClient_1.redisClient.exists(DOMAIN_LIST_KEY_PREFIX + listId);
        if (!exists)
            return false;
        // Liste ve domainleri sil
        yield redisClient_1.redisClient.del(DOMAIN_LIST_KEY_PREFIX + listId);
        yield redisClient_1.redisClient.del(DOMAIN_KEY_PREFIX + listId);
        return true;
    });
}
exports.deleteDomainList = deleteDomainList;
// Tüm domain listelerini getir
function getAllDomainLists() {
    return __awaiter(this, void 0, void 0, function* () {
        // Tüm liste anahtarlarını bul
        const keys = yield redisClient_1.redisClient.keys(DOMAIN_LIST_KEY_PREFIX + '*');
        if (keys.length === 0)
            return [];
        // Her listeyi getir
        const lists = [];
        for (const key of keys) {
            const listData = yield redisClient_1.redisClient.get(key);
            if (listData) {
                try {
                    const list = JSON.parse(listData);
                    // Tarihleri düzgün formata dönüştür
                    list.createdAt = new Date(list.createdAt);
                    list.updatedAt = new Date(list.updatedAt);
                    // Domain sayısını getir
                    const domainCount = yield redisClient_1.redisClient.llen(DOMAIN_KEY_PREFIX + list.id);
                    // Domain sayısını doğru şekilde döndür
                    const domainPlaceholders = Array(domainCount).fill({ id: "", domain: "" });
                    lists.push(Object.assign(Object.assign({}, list), { domains: domainPlaceholders // Boş içerikli ama doğru sayıda domain dizisi döndür
                     }));
                }
                catch (error) {
                    console.error('Liste verisi ayrıştırılamadı:', error);
                }
            }
        }
        // Tarih sırasına göre sırala (en yeni en üstte)
        return lists.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    });
}
exports.getAllDomainLists = getAllDomainLists;
// Belirli bir domain listesini getir
function getDomainList(listId) {
    return __awaiter(this, void 0, void 0, function* () {
        const listData = yield redisClient_1.redisClient.get(DOMAIN_LIST_KEY_PREFIX + listId);
        if (!listData)
            return null;
        try {
            const list = JSON.parse(listData);
            // Tarihleri düzgün formata dönüştür
            list.createdAt = new Date(list.createdAt);
            list.updatedAt = new Date(list.updatedAt);
            // Domainleri getir
            const domainCount = yield redisClient_1.redisClient.llen(DOMAIN_KEY_PREFIX + listId);
            if (domainCount > 0) {
                const domainData = yield redisClient_1.redisClient.lrange(DOMAIN_KEY_PREFIX + listId, 0, domainCount - 1);
                list.domains = domainData.map((data) => JSON.parse(data));
            }
            else {
                list.domains = [];
            }
            return list;
        }
        catch (error) {
            console.error('Liste verisi ayrıştırılamadı:', error);
            return null;
        }
    });
}
exports.getDomainList = getDomainList;
// Domain listesinin domainlerini getir (sayfalama ile)
function getDomainListDomains(listId, page = 0, limit = 100) {
    return __awaiter(this, void 0, void 0, function* () {
        const start = page * limit;
        const end = start + limit - 1;
        const domainData = yield redisClient_1.redisClient.lrange(DOMAIN_KEY_PREFIX + listId, start, end);
        return domainData.map((data) => JSON.parse(data));
    });
}
exports.getDomainListDomains = getDomainListDomains;
//# sourceMappingURL=domainService.js.map