import express from 'express';
import { 
  createScan, 
  startScan, 
  pauseScan, 
  cancelScan, 
  getAllScans, 
  getScan, 
  getScanResults,
  optimizeRedisMemory,
  deleteScan
} from '../services/scanService';
import { cleanQueue, getQueueStatus } from '../queues/scanQueue';

const router = express.Router();

// Tüm taramaları listeleme
router.get('/', async (req, res) => {
  try {
    const scans = await getAllScans();
    res.json(scans);
  } catch (error: any) {
    res.status(500).json({ error: 'Taramalar alınırken hata oluştu', message: error.message });
  }
});

// Kuyruk durumunu getir - ÖNEMLİ: Dinamik path parametreli route'lardan ÖNCE tanımla
router.get('/queue/status', async (req, res) => {
  try {
    const status = await getQueueStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: 'Kuyruk durumu alınırken hata oluştu', message: error.message });
  }
});

// Kuyruğu temizle - ÖNEMLİ: Dinamik path parametreli route'lardan ÖNCE tanımla
router.post('/queue/clean', async (req, res) => {
  try {
    const result = await cleanQueue();
    res.json({ success: result, message: 'Kuyruk temizlendi' });
  } catch (error: any) {
    res.status(500).json({ error: 'Kuyruk temizlenirken hata oluştu', message: error.message });
  }
});

// Yeni tarama oluşturma
router.post('/', async (req, res) => {
  try {
    const { name, domainListId, domainListName, startIndex, includeSubdomains, subdomains, paths, searchTerms } = req.body;
    
    // Zorunlu alanları kontrol et
    if (!name || !domainListId || !paths || !searchTerms) {
      return res.status(400).json({ error: 'Eksik bilgi. name, domainListId, paths ve searchTerms alanları zorunludur.' });
    }
    
    const scan = await createScan({
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
  } catch (error: any) {
    res.status(500).json({ error: 'Tarama oluşturulurken hata oluştu', message: error.message });
  }
});

// Belirli bir taramayı getir
router.get('/:id', async (req, res) => {
  try {
    const scan = await getScan(req.params.id);
    
    if (!scan) {
      return res.status(404).json({ error: 'Tarama bulunamadı' });
    }
    
    res.json(scan);
  } catch (error: any) {
    res.status(500).json({ error: 'Tarama alınırken hata oluştu', message: error.message });
  }
});

// Tarama sonuçlarını getir (sayfalama ile)
router.get('/:id/results', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string || '0', 10);
    const limit = parseInt(req.query.limit as string || '20', 10);
    
    const results = await getScanResults(req.params.id, page, limit);
    
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: 'Tarama sonuçları alınırken hata oluştu', message: error.message });
  }
});

// Taramayı başlat
router.post('/:id/start', async (req, res) => {
  try {
    const scan = await startScan(req.params.id);
    res.json(scan);
  } catch (error: any) {
    res.status(500).json({ error: 'Tarama başlatılırken hata oluştu', message: error.message });
  }
});

// Taramayı duraklat
router.post('/:id/pause', async (req, res) => {
  try {
    const scan = await pauseScan(req.params.id);
    res.json(scan);
  } catch (error: any) {
    res.status(500).json({ error: 'Tarama duraklatılırken hata oluştu', message: error.message });
  }
});

// Taramayı iptal et
router.post('/:id/cancel', async (req, res) => {
  try {
    const scan = await cancelScan(req.params.id);
    res.json(scan);
  } catch (error: any) {
    res.status(500).json({ error: 'Tarama iptal edilirken hata oluştu', message: error.message });
  }
});

// Redis bellek optimizasyonu endpoint'i - ÖNEMLİ: Dinamik path parametreli route'lardan ÖNCE tanımla
router.post('/optimize-memory', async (req, res) => {
  try {
    await optimizeRedisMemory();
    res.json({ success: true, message: 'Redis bellek optimizasyonu tamamlandı' });
  } catch (error: any) {
    res.status(500).json({ error: 'Redis bellek optimizasyonu başarısız oldu', message: error.message });
  }
});

// Taramayı sil
router.delete('/:id', async (req, res) => {
  try {
    const success = await deleteScan(req.params.id);
    
    if (success) {
      res.json({ success: true, message: 'Tarama başarıyla silindi' });
    } else {
      res.status(500).json({ success: false, error: 'Tarama silinemedi' });
    }
  } catch (error: any) {
    res.status(500).json({ error: 'Tarama silinirken hata oluştu', message: error.message });
  }
});

export default router; 