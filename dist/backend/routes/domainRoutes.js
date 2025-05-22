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
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const domainService_1 = require("../services/domainService");
const router = express_1.default.Router();
// Dosya yükleme için multer yapılandırması
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const uploadsDir = path_1.default.join(__dirname, '../../uploads');
        // Uploads dizinini oluştur (yoksa)
        if (!fs_1.default.existsSync(uploadsDir)) {
            fs_1.default.mkdirSync(uploadsDir, { recursive: true });
        }
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path_1.default.extname(file.originalname));
    }
});
const upload = (0, multer_1.default)({
    storage,
    fileFilter: (req, file, cb) => {
        // Sadece CSV dosyalarına izin ver
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        if (ext !== '.csv') {
            return cb(new Error('Sadece CSV dosyaları yüklenebilir.'));
        }
        cb(null, true);
    }
});
// Tüm domain listelerini getir
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const lists = yield (0, domainService_1.getAllDomainLists)();
        res.json(lists);
    }
    catch (error) {
        res.status(500).json({ error: 'Domain listeleri alınırken hata oluştu', message: error.message });
    }
}));
// Yeni domain listesi oluştur
router.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, source } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Liste adı gereklidir' });
        }
        const list = yield (0, domainService_1.createDomainList)(name, source || 'Manuel oluşturuldu');
        res.status(201).json(list);
    }
    catch (error) {
        res.status(500).json({ error: 'Domain listesi oluşturulurken hata oluştu', message: error.message });
    }
}));
// Belirli bir domain listesini getir
router.get('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const list = yield (0, domainService_1.getDomainList)(req.params.id);
        if (!list) {
            return res.status(404).json({ error: 'Domain listesi bulunamadı' });
        }
        res.json(list);
    }
    catch (error) {
        res.status(500).json({ error: 'Domain listesi alınırken hata oluştu', message: error.message });
    }
}));
// Domain listesini güncelle
router.put('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, source, domains } = req.body;
        const updatedList = yield (0, domainService_1.updateDomainList)(req.params.id, { name, source, domains });
        if (!updatedList) {
            return res.status(404).json({ error: 'Domain listesi bulunamadı' });
        }
        res.json(updatedList);
    }
    catch (error) {
        res.status(500).json({ error: 'Domain listesi güncellenirken hata oluştu', message: error.message });
    }
}));
// Domain listesini sil
router.delete('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const success = yield (0, domainService_1.deleteDomainList)(req.params.id);
        if (!success) {
            return res.status(404).json({ error: 'Domain listesi bulunamadı' });
        }
        res.json({ message: 'Domain listesi başarıyla silindi' });
    }
    catch (error) {
        res.status(500).json({ error: 'Domain listesi silinirken hata oluştu', message: error.message });
    }
}));
// Domain listesi domainlerini getir (sayfalama ile)
router.get('/:id/domains', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const page = parseInt(req.query.page || '0', 10);
        const limit = parseInt(req.query.limit || '100', 10);
        const domains = yield (0, domainService_1.getDomainListDomains)(req.params.id, page, limit);
        res.json(domains);
    }
    catch (error) {
        res.status(500).json({ error: 'Domainler alınırken hata oluştu', message: error.message });
    }
}));
// CSV dosyasından domain listesine domainleri ekle
router.post('/:id/import', upload.single('file'), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Dosya yüklenmedi' });
        }
        const delimiter = req.body.delimiter || ',';
        const result = yield (0, domainService_1.importDomainsFromCsv)(req.params.id, req.file.path, delimiter);
        // Yüklenen dosyayı sil
        fs_1.default.unlinkSync(req.file.path);
        res.status(200).json(Object.assign({ message: `${result.added} domain başarıyla eklendi (toplam: ${result.total})` }, result));
    }
    catch (error) {
        // Hata durumunda, varsa dosyayı temizle
        if (req.file && fs_1.default.existsSync(req.file.path)) {
            fs_1.default.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'CSV dosyası işlenirken hata oluştu', message: error.message });
    }
}));
exports.default = router;
//# sourceMappingURL=domainRoutes.js.map