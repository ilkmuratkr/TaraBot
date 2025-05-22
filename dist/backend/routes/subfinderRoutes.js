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
const subfinderService_1 = require("../services/subfinderService");
const server_1 = require("../server");
// Redis key önekleri
const SUBFINDER_KEY_PREFIX = 'subfinder:';
const router = express_1.default.Router();
// Yeni bir SubFinder taraması oluştur
router.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { domain, options } = req.body;
        if (!domain) {
            return res.status(400).json({ error: 'Domain parametresi gereklidir' });
        }
        const scan = yield (0, subfinderService_1.createSubfinderScan)(domain, options || {});
        res.json(scan);
    }
    catch (error) {
        res.status(500).json({ error: 'SubFinder taraması oluşturulamadı', message: error.message });
    }
}));
// Tüm SubFinder taramalarını getir
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const scans = yield (0, subfinderService_1.getAllSubfinderScans)();
        res.json(scans);
    }
    catch (error) {
        res.status(500).json({ error: 'SubFinder taramaları getirilemedi', message: error.message });
    }
}));
// Belirli bir SubFinder taramasını getir
router.get('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const scan = yield (0, subfinderService_1.getSubfinderScan)(req.params.id);
        if (!scan) {
            return res.status(404).json({ error: 'SubFinder taraması bulunamadı' });
        }
        res.json(scan);
    }
    catch (error) {
        res.status(500).json({ error: 'SubFinder taraması getirilemedi', message: error.message });
    }
}));
// SubFinder taramasını başlat
router.post('/:id/start', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const scan = yield (0, subfinderService_1.startSubfinderScan)(req.params.id);
        if (!scan) {
            return res.status(404).json({ error: 'SubFinder taraması bulunamadı' });
        }
        res.json(scan);
    }
    catch (error) {
        res.status(500).json({ error: 'SubFinder taraması başlatılamadı', message: error.message });
    }
}));
// SubFinder taramasını durdur
router.post('/:id/stop', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const scan = yield (0, subfinderService_1.stopSubfinderScan)(req.params.id);
        if (!scan) {
            return res.status(404).json({ error: 'SubFinder taraması bulunamadı' });
        }
        res.json(scan);
    }
    catch (error) {
        res.status(500).json({ error: 'SubFinder taraması durdurulamadı', message: error.message });
    }
}));
// SubFinder tarama sonuçlarını getir
router.get('/:id/results', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const page = parseInt(req.query.page) || 0;
        const limit = parseInt(req.query.limit) || 100;
        const results = yield (0, subfinderService_1.getSubfinderResults)(req.params.id, page, limit);
        res.json(results);
    }
    catch (error) {
        res.status(500).json({ error: 'SubFinder tarama sonuçları getirilemedi', message: error.message });
    }
}));
// SubFinder taramasını sil
router.delete('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const success = yield (0, subfinderService_1.deleteSubfinderScan)(req.params.id);
        if (!success) {
            return res.status(404).json({ error: 'SubFinder taraması bulunamadı veya silinemedi' });
        }
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'SubFinder taraması silinemedi', message: error.message });
    }
}));
// SubFinder tarama durumunu güncelle
router.post('/:id/status', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { status } = req.body;
        if (!status || !['pending', 'running', 'completed', 'failed', 'stopped'].includes(status)) {
            return res.status(400).json({ error: 'Geçersiz durum değeri' });
        }
        const scan = yield (0, subfinderService_1.getSubfinderScan)(req.params.id);
        if (!scan) {
            return res.status(404).json({ error: 'SubFinder taraması bulunamadı' });
        }
        // Tarama durumunu güncelle
        scan.status = status;
        // Hata mesajı güncelleme
        if (req.body.error !== undefined) {
            scan.error = req.body.error;
        }
        // Redis'e kaydet
        yield server_1.redisClient.set(SUBFINDER_KEY_PREFIX + req.params.id, JSON.stringify(scan));
        res.json(scan);
    }
    catch (error) {
        res.status(500).json({ error: 'SubFinder taraması durumu güncellenemedi', message: error.message });
    }
}));
exports.default = router;
//# sourceMappingURL=subfinderRoutes.js.map