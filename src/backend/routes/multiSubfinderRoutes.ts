import express, { Request, Response, NextFunction } from 'express';
import * as multiSubfinderService from '../services/multiSubfinderService';
import { SubfinderOptions } from '../services/subfinderService';

const router = express.Router();

// Yeni bir çoklu tarama başlat
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, domains, options } = req.body as { name: string, domains: string[], options: SubfinderOptions };
    if (!name || !domains || !Array.isArray(domains) || domains.length === 0) {
      return res.status(400).json({ error: 'İsim ve geçerli bir domain listesi gereklidir.' });
    }
    const job = await multiSubfinderService.createMultiScanJob(name, domains, options);
    res.status(201).json(job);
  } catch (error) {
    next(error);
  }
});

// Tüm çoklu taramaları listele
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobs = await multiSubfinderService.getAllMultiScanJobs();
    res.json(jobs);
  } catch (error) {
    next(error);
  }
});

// Belirli bir çoklu taramanın detaylarını getir
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await multiSubfinderService.getMultiScanJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Çoklu tarama işi bulunamadı.' });
    }
    res.json(job);
  } catch (error) {
    next(error);
  }
});

// Belirli bir çoklu taramanın birleştirilmiş sonuçlarını getir
router.get('/:id/results', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string || '0', 10);
    const limit = parseInt(req.query.limit as string || '100', 10);
    const results = await multiSubfinderService.getMultiScanResults(req.params.id, page, limit);
    // Henüz sonuç yoksa veya iş bulunamadıysa bile boş bir dizi dönebilir.
    res.json(results);
  } catch (error) {
    next(error);
  }
});

// Belirli bir çoklu taramayı duraklat
router.post('/:id/pause', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await multiSubfinderService.pauseMultiScanJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Duraklatılacak çoklu tarama işi bulunamadı veya uygun durumda değil.' });
    }
    res.json(job);
  } catch (error) {
    next(error);
  }
});

// Duraklatılmış bir çoklu taramayı devam ettir
router.post('/:id/resume', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await multiSubfinderService.resumeMultiScanJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Devam ettirilecek çoklu tarama işi bulunamadı veya uygun durumda değil.' });
    }
    res.json(job);
  } catch (error) {
    next(error);
  }
});

// Belirli bir çoklu taramayı iptal et (durdur)
router.post('/:id/stop', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await multiSubfinderService.stopMultiScanJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Durdurulacak çoklu tarama işi bulunamadı veya uygun durumda değil.' });
    }
    res.json(job);
  } catch (error) {
    next(error);
  }
});

// Belirli bir çoklu taramayı ve sonuçlarını sil
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const success = await multiSubfinderService.deleteMultiScanJob(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Silinecek çoklu tarama işi bulunamadı veya silinemedi.' });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router; 