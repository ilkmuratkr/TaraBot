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
const express_1 = __importDefault(require("express"));
const scanService_1 = require("../services/scanService");
const scanQueue_1 = require("../queues/scanQueue");
const router = express_1.default.Router();
// Tüm taramaları listeleme
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const scans = yield (0, scanService_1.getAllScans)();
        res.json(scans);
    }
    catch (error) {
        res.status(500).json({ error: 'Taramalar alınırken hata oluştu', message: error.message });
    }
}));
// Kuyruk durumunu getir - ÖNEMLİ: Dinamik path parametreli route'lardan ÖNCE tanımla
router.get('/queue/status', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const status = yield (0, scanQueue_1.getQueueStatus)();
        res.json(status);
    }
    catch (error) {
        res.status(500).json({ error: 'Kuyruk durumu alınırken hata oluştu', message: error.message });
    }
}));
// Kuyruğu temizle - ÖNEMLİ: Dinamik path parametreli route'lardan ÖNCE tanımla
router.post('/queue/clean', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield (0, scanQueue_1.cleanQueue)();
        res.json({ success: result, message: 'Kuyruk temizlendi' });
    }
    catch (error) {
        res.status(500).json({ error: 'Kuyruk temizlenirken hata oluştu', message: error.message });
    }
}));
// Yeni tarama oluşturma
router.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, domainListId, domainListName, startIndex, includeSubdomains, subdomains, paths, searchTerms } = req.body;
        // Zorunlu alanları kontrol et
        if (!name || !domainListId || !paths || !searchTerms) {
            return res.status(400).json({ error: 'Eksik bilgi. name, domainListId, paths ve searchTerms alanları zorunludur.' });
        }
        const scan = yield (0, scanService_1.createScan)({
            name,
            domainListId,
            domainListName,
            startIndex: startIndex || 0,
            includeSubdomains: includeSubdomains || false,
            subdomains: subdomains || [],
            paths: paths,
            searchTerms: searchTerms,
        });
        res.status(201).json(scan);
    }
    catch (error) {
        res.status(500).json({ error: 'Tarama oluşturulurken hata oluştu', message: error.message });
    }
}));
// Belirli bir taramayı getir
router.get('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const scan = yield (0, scanService_1.getScan)(req.params.id);
        if (!scan) {
            return res.status(404).json({ error: 'Tarama bulunamadı' });
        }
        res.json(scan);
    }
    catch (error) {
        res.status(500).json({ error: 'Tarama alınırken hata oluştu', message: error.message });
    }
}));
// Tarama sonuçlarını getir (sayfalama ile)
router.get('/:id/results', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const page = parseInt(req.query.page || '0', 10);
        const limit = parseInt(req.query.limit || '20', 10);
        const results = yield (0, scanService_1.getScanResults)(req.params.id, page, limit);
        res.json(results);
    }
    catch (error) {
        res.status(500).json({ error: 'Tarama sonuçları alınırken hata oluştu', message: error.message });
    }
}));
// Taramayı başlat
router.post('/:id/start', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const scan = yield (0, scanService_1.startScan)(req.params.id);
        res.json(scan);
    }
    catch (error) {
        res.status(500).json({ error: 'Tarama başlatılırken hata oluştu', message: error.message });
    }
}));
// Taramayı duraklat
router.post('/:id/pause', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const scan = yield (0, scanService_1.pauseScan)(req.params.id);
        res.json(scan);
    }
    catch (error) {
        res.status(500).json({ error: 'Tarama duraklatılırken hata oluştu', message: error.message });
    }
}));
// Taramayı iptal et
router.post('/:id/cancel', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const scan = yield (0, scanService_1.cancelScan)(req.params.id);
        res.json(scan);
    }
    catch (error) {
        res.status(500).json({ error: 'Tarama iptal edilirken hata oluştu', message: error.message });
    }
}));
// Redis bellek optimizasyonu endpoint'i - ÖNEMLİ: Dinamik path parametreli route'lardan ÖNCE tanımla
router.post('/optimize-memory', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield (0, scanService_1.optimizeRedisMemory)();
        res.json({ success: true, message: 'Redis bellek optimizasyonu tamamlandı' });
    }
    catch (error) {
        res.status(500).json({ error: 'Redis bellek optimizasyonu başarısız oldu', message: error.message });
    }
}));
// Taramayı sil
router.delete('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const success = yield (0, scanService_1.deleteScan)(req.params.id);
        if (success) {
            res.json({ success: true, message: 'Tarama başarıyla silindi' });
        }
        else {
            res.status(500).json({ success: false, error: 'Tarama silinemedi' });
        }
    }
    catch (error) {
        res.status(500).json({ error: 'Tarama silinirken hata oluştu', message: error.message });
    }
}));
exports.default = router;
//# sourceMappingURL=scanRoutes.js.map