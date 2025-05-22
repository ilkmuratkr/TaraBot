import express from 'express';
import { 
  createSubfinderScan, 
  startSubfinderScan, 
  stopSubfinderScan, 
  getAllSubfinderScans, 
  getSubfinderScan, 
  getSubfinderResults,
  deleteSubfinderScan
} from '../services/subfinderService';
import { redisClient } from '../redisClient';

// Redis key önekleri
const SUBFINDER_KEY_PREFIX = 'subfinder:';

const router = express.Router();

// Yeni bir SubFinder taraması oluştur
router.post('/', async (req, res) => {
  try {
    const { domain, options } = req.body;
    
    if (!domain) {
      return res.status(400).json({ error: 'Domain parametresi gereklidir' });
    }
    
    const scan = await createSubfinderScan(domain, options || {});
    res.json(scan);
  } catch (error: any) {
    res.status(500).json({ error: 'SubFinder taraması oluşturulamadı', message: error.message });
  }
});

// Tüm SubFinder taramalarını getir
router.get('/', async (req, res) => {
  try {
    const scans = await getAllSubfinderScans();
    res.json(scans);
  } catch (error: any) {
    res.status(500).json({ error: 'SubFinder taramaları getirilemedi', message: error.message });
  }
});

// Belirli bir SubFinder taramasını getir
router.get('/:id', async (req, res) => {
  try {
    const scan = await getSubfinderScan(req.params.id);
    
    if (!scan) {
      return res.status(404).json({ error: 'SubFinder taraması bulunamadı' });
    }
    
    res.json(scan);
  } catch (error: any) {
    res.status(500).json({ error: 'SubFinder taraması getirilemedi', message: error.message });
  }
});

// SubFinder taramasını başlat
router.post('/:id/start', async (req, res) => {
  try {
    const scan = await startSubfinderScan(req.params.id);
    
    if (!scan) {
      return res.status(404).json({ error: 'SubFinder taraması bulunamadı' });
    }
    
    res.json(scan);
  } catch (error: any) {
    res.status(500).json({ error: 'SubFinder taraması başlatılamadı', message: error.message });
  }
});

// SubFinder taramasını durdur
router.post('/:id/stop', async (req, res) => {
  try {
    const scan = await stopSubfinderScan(req.params.id);
    
    if (!scan) {
      return res.status(404).json({ error: 'SubFinder taraması bulunamadı' });
    }
    
    res.json(scan);
  } catch (error: any) {
    res.status(500).json({ error: 'SubFinder taraması durdurulamadı', message: error.message });
  }
});

// SubFinder tarama sonuçlarını getir
router.get('/:id/results', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 0;
    const limit = parseInt(req.query.limit as string) || 100;
    
    const results = await getSubfinderResults(req.params.id, page, limit);
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: 'SubFinder tarama sonuçları getirilemedi', message: error.message });
  }
});

// SubFinder taramasını sil
router.delete('/:id', async (req, res) => {
  try {
    const success = await deleteSubfinderScan(req.params.id);
    
    if (!success) {
      return res.status(404).json({ error: 'SubFinder taraması bulunamadı veya silinemedi' });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'SubFinder taraması silinemedi', message: error.message });
  }
});

// SubFinder tarama durumunu güncelle
router.post('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status || !['pending', 'running', 'completed', 'failed', 'stopped'].includes(status)) {
      return res.status(400).json({ error: 'Geçersiz durum değeri' });
    }
    
    const scan = await getSubfinderScan(req.params.id);
    
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
    await redisClient.set(SUBFINDER_KEY_PREFIX + req.params.id, JSON.stringify(scan));
    
    res.json(scan);
  } catch (error: any) {
    res.status(500).json({ error: 'SubFinder taraması durumu güncellenemedi', message: error.message });
  }
});

export default router; 