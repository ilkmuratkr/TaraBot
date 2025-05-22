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
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const api_1 = require("@bull-board/api");
const bullmqAdapter_1 = require("@bull-board/api/bullmqAdapter");
const express_2 = require("@bull-board/express");
const scanRoutes_1 = __importDefault(require("./routes/scanRoutes"));
const domainRoutes_1 = __importDefault(require("./routes/domainRoutes"));
const subfinderRoutes_1 = __importDefault(require("./routes/subfinderRoutes"));
const multiSubfinderRoutes_1 = __importDefault(require("./routes/multiSubfinderRoutes"));
const config_1 = require("./config");
const scanService_1 = require("./services/scanService");
const bullmq_1 = require("bullmq");
const multiSubfinderService = __importStar(require("./services/multiSubfinderService"));
const redisClient_1 = require("./redisClient");
// Express uygulamasını oluştur
const app = (0, express_1.default)();
// Middleware
app.use((0, helmet_1.default)()); // Güvenlik başlıkları
app.use((0, compression_1.default)()); // Yanıt sıkıştırma
// CORS Ayarları - Frontend domain'i için
app.use((0, cors_1.default)({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true
}));
// JSON isteklerini ayrıştırma - Büyük dosyalar için limit artırıldı
app.use(express_1.default.json({ limit: '100mb' }));
app.use(express_1.default.urlencoded({ limit: '100mb', extended: true }));
// Bull Board yapılandırması (Kuyruk izleme paneli)
const serverAdapter = new express_2.ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');
const bullBoardQueues = [
    new bullmqAdapter_1.BullMQAdapter(multiSubfinderService.multiScanQueue),
];
const { addQueue, removeQueue, setQueues, replaceQueues } = (0, api_1.createBullBoard)({
    queues: bullBoardQueues,
    serverAdapter: serverAdapter,
});
// Panoya erişimi korumak için basit bir middleware
app.use('/admin/queues', (req, res, next) => {
    // API anahtarını header veya query string'den al
    const headerApiKey = req.headers['x-api-key'];
    const queryApiKey = req.query.apiKey;
    // Geliştirme ortamında API anahtarını kontrol et
    if (process.env.NODE_ENV === 'production') {
        if (headerApiKey !== config_1.config.admin.apiKey && queryApiKey !== config_1.config.admin.apiKey) {
            return res.status(401).json({ error: 'Yetkisiz erişim' });
        }
    }
    next();
});
// Bull Board'u uygulamaya ekle
app.use('/admin/queues', serverAdapter.getRouter());
// API rotaları
app.use('/api/scans', scanRoutes_1.default);
app.use('/api/domains', domainRoutes_1.default);
app.use('/api/subfinder', subfinderRoutes_1.default);
app.use('/api/multiscans', multiSubfinderRoutes_1.default);
// Sağlık kontrolü
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date() });
});
// Hata işleyici
app.use((err, req, res, next) => {
    console.error('Sunucu hatası:', err);
    res.status(500).json({ error: 'Sunucu hatası', message: err.message });
});
// Sunucuyu başlat
const PORT = config_1.config.server.port || 3003;
app.listen(PORT, () => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`Sunucu başlatıldı: http://localhost:${PORT}`);
    console.log(`Kuyruk paneli: http://localhost:${PORT}/admin/queues`);
    // Multi-scan queue worker'ını başlat
    try {
        const multiScanWorker = new bullmq_1.Worker(multiSubfinderService.multiScanQueueName, (job) => __awaiter(void 0, void 0, void 0, function* () {
            yield multiSubfinderService.processSingleDomainForMultiScan(job);
        }), {
            connection: redisClient_1.workerConnection,
            concurrency: 2
        });
        multiScanWorker.on('completed', (job) => {
            console.log(`Multi-scan alt işi ${job.id} tamamlandı.`);
        });
        multiScanWorker.on('failed', (job, err) => {
            if (job) {
                console.error(`Multi-scan alt işi ${job.id} başarısız oldu: ${err.message}`, err);
            }
            else {
                console.error(`Multi-scan alt işi (ID'siz) başarısız oldu: ${err.message}`, err);
            }
        });
        console.log('Çoklu tarama worker\'ı başlatıldı.');
    }
    catch (error) {
        console.error('Çoklu tarama worker başlatılırken hata:', error);
    }
    // Sistemin düzgün başlatılması için kuyruğu başlat
    try {
        const { resumeQueue, cleanQueue } = require('./queues/scanQueue');
        // Başlangıçta kuyruğu temizle ve yeniden başlat
        console.log('Sunucu başlatılırken kuyruk temizleniyor...');
        yield cleanQueue();
        console.log('Kuyruk başlatılıyor...');
        yield resumeQueue();
        console.log('Tarama sistemi hazır!');
        // Redis bellek kullanımını periyodik olarak optimize et
        const OPTIMIZE_INTERVAL = config_1.config.scanner.cleanupInterval || 5 * 60 * 1000; // Varsayılan: 5 dakika
        console.log(`Redis bellek optimizasyonu periyodu: ${OPTIMIZE_INTERVAL / 60 / 1000} dakika`);
        setInterval(() => __awaiter(void 0, void 0, void 0, function* () {
            try {
                yield (0, scanService_1.optimizeRedisMemory)();
            }
            catch (err) {
                console.error('Otomatik Redis bellek optimizasyonu hatası:', err);
            }
        }), OPTIMIZE_INTERVAL);
    }
    catch (error) {
        console.error('Kuyruk başlatılırken hata:', error);
    }
}));
//# sourceMappingURL=server.js.map