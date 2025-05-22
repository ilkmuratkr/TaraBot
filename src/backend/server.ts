import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullmqAdapter';
import { ExpressAdapter } from '@bull-board/express';
import scanRoutes from './routes/scanRoutes';
import domainRoutes from './routes/domainRoutes';
import subfinderRoutes from './routes/subfinderRoutes';
import multiSubfinderRoutes from './routes/multiSubfinderRoutes';
import { scanQueue } from './queues/scanQueue';
import { config } from './config';
import { optimizeRedisMemory } from './services/scanService';
import { Worker, Job, JobProgress } from 'bullmq';
import * as subfinderService from './services/subfinderService';
import * as multiSubfinderService from './services/multiSubfinderService';
import { MultiScanJobPayload } from './services/multiSubfinderService';
import { redisClient, workerConnection } from './redisClient';

// Express uygulamasını oluştur
const app = express();

// Middleware
app.use(helmet()); // Güvenlik başlıkları
app.use(compression()); // Yanıt sıkıştırma
// CORS Ayarları - Frontend domain'i için
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: true
}));

// JSON isteklerini ayrıştırma - Büyük dosyalar için limit artırıldı
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Bull Board yapılandırması (Kuyruk izleme paneli)
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

const bullBoardQueues: BullMQAdapter[] = [
    new BullMQAdapter(multiSubfinderService.multiScanQueue),
];

const { addQueue, removeQueue, setQueues, replaceQueues } = createBullBoard({
  queues: bullBoardQueues,
  serverAdapter: serverAdapter,
});

// Panoya erişimi korumak için basit bir middleware
app.use('/admin/queues', (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // API anahtarını header veya query string'den al
  const headerApiKey = req.headers['x-api-key'];
  const queryApiKey = req.query.apiKey as string;
  
  // Geliştirme ortamında API anahtarını kontrol et
  if (process.env.NODE_ENV === 'production') {
    if (headerApiKey !== config.admin.apiKey && queryApiKey !== config.admin.apiKey) {
      return res.status(401).json({ error: 'Yetkisiz erişim' });
    }
  }
  
  next();
});

// Bull Board'u uygulamaya ekle
app.use('/admin/queues', serverAdapter.getRouter());

// API rotaları
app.use('/api/scans', scanRoutes);
app.use('/api/domains', domainRoutes);
app.use('/api/subfinder', subfinderRoutes);
app.use('/api/multiscans', multiSubfinderRoutes);

// Sağlık kontrolü
app.get('/health', (req: express.Request, res: express.Response) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// Hata işleyici
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Sunucu hatası:', err);
  res.status(500).json({ error: 'Sunucu hatası', message: err.message });
});

// Sunucuyu başlat
const PORT = config.server.port || 3003;
app.listen(PORT, async () => {
  console.log(`Sunucu başlatıldı: http://localhost:${PORT}`);
  console.log(`Kuyruk paneli: http://localhost:${PORT}/admin/queues`);
  
  // Multi-scan queue worker'ını başlat
  try {
    const multiScanWorker = new Worker<MultiScanJobPayload>(
      multiSubfinderService.multiScanQueueName,
      async (job: Job<MultiScanJobPayload>) => {
        await multiSubfinderService.processSingleDomainForMultiScan(job);
      },
      {
        connection: workerConnection,
        concurrency: 2
      }
    );

    multiScanWorker.on('completed', (job: Job<MultiScanJobPayload>) => {
      console.log(`Multi-scan alt işi ${job.id} tamamlandı.`);
    });

    multiScanWorker.on('failed', (job: Job<MultiScanJobPayload> | undefined, err: Error) => {
      if (job) {
        console.error(`Multi-scan alt işi ${job.id} başarısız oldu: ${err.message}`, err);
      } else {
        console.error(`Multi-scan alt işi (ID'siz) başarısız oldu: ${err.message}`, err);
      }
    });
    console.log('Çoklu tarama worker\'ı başlatıldı.');

  } catch (error) {
    console.error('Çoklu tarama worker başlatılırken hata:', error);
  }

  // Sistemin düzgün başlatılması için kuyruğu başlat
  try {
    const { resumeQueue, cleanQueue } = require('./queues/scanQueue');
    
    // Başlangıçta kuyruğu temizle ve yeniden başlat
    console.log('Sunucu başlatılırken kuyruk temizleniyor...');
    await cleanQueue();
    
    console.log('Kuyruk başlatılıyor...');
    await resumeQueue();
    
    console.log('Tarama sistemi hazır!');
    
    // Redis bellek kullanımını periyodik olarak optimize et
    const OPTIMIZE_INTERVAL = config.scanner.cleanupInterval || 5 * 60 * 1000; // Varsayılan: 5 dakika
    
    console.log(`Redis bellek optimizasyonu periyodu: ${OPTIMIZE_INTERVAL / 60 / 1000} dakika`);
    
    setInterval(async () => {
      try {
        await optimizeRedisMemory();
      } catch (err) {
        console.error('Otomatik Redis bellek optimizasyonu hatası:', err);
      }
    }, OPTIMIZE_INTERVAL);
  } catch (error) {
    console.error('Kuyruk başlatılırken hata:', error);
  }
}); 