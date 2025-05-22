import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { 
  createDomainList, 
  getDomainList, 
  getAllDomainLists, 
  importDomainsFromCsv, 
  deleteDomainList, 
  getDomainListDomains,
  updateDomainList
} from '../services/domainService';

const router = express.Router();

// Dosya yükleme için multer yapılandırması
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '../../uploads');
    
    // Uploads dizinini oluştur (yoksa)
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    // Sadece CSV dosyalarına izin ver
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.csv') {
      return cb(new Error('Sadece CSV dosyaları yüklenebilir.'));
    }
    cb(null, true);
  }
});

// Tüm domain listelerini getir
router.get('/', async (req, res) => {
  try {
    const lists = await getAllDomainLists();
    res.json(lists);
  } catch (error: any) {
    res.status(500).json({ error: 'Domain listeleri alınırken hata oluştu', message: error.message });
  }
});

// Yeni domain listesi oluştur
router.post('/', async (req, res) => {
  try {
    const { name, source } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Liste adı gereklidir' });
    }
    
    const list = await createDomainList(name, source || 'Manuel oluşturuldu');
    res.status(201).json(list);
  } catch (error: any) {
    res.status(500).json({ error: 'Domain listesi oluşturulurken hata oluştu', message: error.message });
  }
});

// Belirli bir domain listesini getir
router.get('/:id', async (req, res) => {
  try {
    const list = await getDomainList(req.params.id);
    
    if (!list) {
      return res.status(404).json({ error: 'Domain listesi bulunamadı' });
    }
    
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: 'Domain listesi alınırken hata oluştu', message: error.message });
  }
});

// Domain listesini güncelle
router.put('/:id', async (req, res) => {
  try {
    const { name, source, domains } = req.body;
    
    const updatedList = await updateDomainList(req.params.id, { name, source, domains });
    
    if (!updatedList) {
      return res.status(404).json({ error: 'Domain listesi bulunamadı' });
    }
    
    res.json(updatedList);
  } catch (error: any) {
    res.status(500).json({ error: 'Domain listesi güncellenirken hata oluştu', message: error.message });
  }
});

// Domain listesini sil
router.delete('/:id', async (req, res) => {
  try {
    const success = await deleteDomainList(req.params.id);
    
    if (!success) {
      return res.status(404).json({ error: 'Domain listesi bulunamadı' });
    }
    
    res.json({ message: 'Domain listesi başarıyla silindi' });
  } catch (error: any) {
    res.status(500).json({ error: 'Domain listesi silinirken hata oluştu', message: error.message });
  }
});

// Domain listesi domainlerini getir (sayfalama ile)
router.get('/:id/domains', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string || '0', 10);
    const limit = parseInt(req.query.limit as string || '100', 10);
    
    const domains = await getDomainListDomains(req.params.id, page, limit);
    
    res.json(domains);
  } catch (error: any) {
    res.status(500).json({ error: 'Domainler alınırken hata oluştu', message: error.message });
  }
});

// CSV dosyasından domain listesine domainleri ekle
router.post('/:id/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Dosya yüklenmedi' });
    }
    
    const delimiter = req.body.delimiter || ',';
    const result = await importDomainsFromCsv(req.params.id, req.file.path, delimiter);
    
    // Yüklenen dosyayı sil
    fs.unlinkSync(req.file.path);
    
    res.status(200).json({
      message: `${result.added} domain başarıyla eklendi (toplam: ${result.total})`,
      ...result
    });
  } catch (error: any) {
    // Hata durumunda, varsa dosyayı temizle
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: 'CSV dosyası işlenirken hata oluştu', message: error.message });
  }
});

export default router; 