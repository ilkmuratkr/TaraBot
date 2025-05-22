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
const express_1 = __importDefault(require("express"));
const multiSubfinderService = __importStar(require("../services/multiSubfinderService"));
const router = express_1.default.Router();
// Yeni bir çoklu tarama başlat
router.post('/', (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, domains, options } = req.body;
        if (!name || !domains || !Array.isArray(domains) || domains.length === 0) {
            return res.status(400).json({ error: 'İsim ve geçerli bir domain listesi gereklidir.' });
        }
        const job = yield multiSubfinderService.createMultiScanJob(name, domains, options);
        res.status(201).json(job);
    }
    catch (error) {
        next(error);
    }
}));
// Tüm çoklu taramaları listele
router.get('/', (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const jobs = yield multiSubfinderService.getAllMultiScanJobs();
        res.json(jobs);
    }
    catch (error) {
        next(error);
    }
}));
// Belirli bir çoklu taramanın detaylarını getir
router.get('/:id', (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const job = yield multiSubfinderService.getMultiScanJob(req.params.id);
        if (!job) {
            return res.status(404).json({ error: 'Çoklu tarama işi bulunamadı.' });
        }
        res.json(job);
    }
    catch (error) {
        next(error);
    }
}));
// Belirli bir çoklu taramanın birleştirilmiş sonuçlarını getir
router.get('/:id/results', (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const page = parseInt(req.query.page || '0', 10);
        const limit = parseInt(req.query.limit || '100', 10);
        const results = yield multiSubfinderService.getMultiScanResults(req.params.id, page, limit);
        // Henüz sonuç yoksa veya iş bulunamadıysa bile boş bir dizi dönebilir.
        res.json(results);
    }
    catch (error) {
        next(error);
    }
}));
// Belirli bir çoklu taramayı duraklat
router.post('/:id/pause', (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const job = yield multiSubfinderService.pauseMultiScanJob(req.params.id);
        if (!job) {
            return res.status(404).json({ error: 'Duraklatılacak çoklu tarama işi bulunamadı veya uygun durumda değil.' });
        }
        res.json(job);
    }
    catch (error) {
        next(error);
    }
}));
// Duraklatılmış bir çoklu taramayı devam ettir
router.post('/:id/resume', (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const job = yield multiSubfinderService.resumeMultiScanJob(req.params.id);
        if (!job) {
            return res.status(404).json({ error: 'Devam ettirilecek çoklu tarama işi bulunamadı veya uygun durumda değil.' });
        }
        res.json(job);
    }
    catch (error) {
        next(error);
    }
}));
// Belirli bir çoklu taramayı iptal et (durdur)
router.post('/:id/stop', (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const job = yield multiSubfinderService.stopMultiScanJob(req.params.id);
        if (!job) {
            return res.status(404).json({ error: 'Durdurulacak çoklu tarama işi bulunamadı veya uygun durumda değil.' });
        }
        res.json(job);
    }
    catch (error) {
        next(error);
    }
}));
// Belirli bir çoklu taramayı ve sonuçlarını sil
router.delete('/:id', (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const success = yield multiSubfinderService.deleteMultiScanJob(req.params.id);
        if (!success) {
            return res.status(404).json({ error: 'Silinecek çoklu tarama işi bulunamadı veya silinemedi.' });
        }
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
}));
exports.default = router;
//# sourceMappingURL=multiSubfinderRoutes.js.map