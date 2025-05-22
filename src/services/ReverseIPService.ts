import { v4 as uuidv4 } from 'uuid';
import { StorageService } from './StorageService';

export interface ReverseIPScan {
  id: string;
  ip: string;
  domains: string[];
  count: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped';
  createdAt: string;
  updatedAt: string;
  errorMessage?: string;
}

export class ReverseIPService {
  private static readonly STORAGE_KEY = 'reverseip_scans';

  /**
   * Tüm Reverse IP taramalarını getir
   */
  static async getAllScans(): Promise<ReverseIPScan[]> {
    return await StorageService.getItem(this.STORAGE_KEY) || [];
  }

  /**
   * ID'ye göre tarama getir
   */
  static async getScanById(id: string): Promise<ReverseIPScan | null> {
    const scans = await this.getAllScans();
    return scans.find(scan => scan.id === id) || null;
  }

  /**
   * Yeni bir Reverse IP taraması oluştur
   */
  static async createScan(ip: string): Promise<ReverseIPScan> {
    const scans = await this.getAllScans();
    
    const newScan: ReverseIPScan = {
      id: uuidv4(),
      ip,
      domains: [],
      count: 0,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    scans.push(newScan);
    await StorageService.setItem(this.STORAGE_KEY, scans);
    
    return newScan;
  }

  /**
   * Taramayı başlat
   */
  static async startScan(id: string): Promise<ReverseIPScan> {
    const scan = await this.getScanById(id);
    if (!scan) {
      throw new Error('Tarama bulunamadı');
    }
    
    if (scan.status === 'running') {
      throw new Error('Tarama zaten çalışıyor');
    }
    
    // Tarama durumunu güncelle
    scan.status = 'running';
    scan.updatedAt = new Date().toISOString();
    await this.updateScan(scan);
    
    try {
      // API çağrısı yaparak tarama başlat
      const response = await fetch(`/api/reverse-ip?ip=${scan.ip}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Tarama sırasında bir hata oluştu');
      }
      
      const data = await response.json();
      
      // Sonuçları kaydet
      scan.domains = data.domains || [];
      scan.count = data.domains ? data.domains.length : 0;
      scan.status = 'completed';
      scan.updatedAt = new Date().toISOString();
      await this.updateScan(scan);
      
      return scan;
    } catch (error) {
      // Hata durumunda
      scan.status = 'failed';
      scan.errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
      scan.updatedAt = new Date().toISOString();
      await this.updateScan(scan);
      throw error;
    }
  }

  /**
   * Taramayı durdur
   */
  static async stopScan(id: string): Promise<ReverseIPScan> {
    const scan = await this.getScanById(id);
    if (!scan) {
      throw new Error('Tarama bulunamadı');
    }
    
    if (scan.status !== 'running') {
      throw new Error('Tarama çalışmıyor');
    }
    
    scan.status = 'stopped';
    scan.updatedAt = new Date().toISOString();
    await this.updateScan(scan);
    
    return scan;
  }

  /**
   * Taramayı sil
   */
  static async deleteScan(id: string): Promise<void> {
    const scans = await this.getAllScans();
    const updatedScans = scans.filter(scan => scan.id !== id);
    await StorageService.setItem(this.STORAGE_KEY, updatedScans);
  }

  /**
   * Taramayı güncelle
   */
  private static async updateScan(updatedScan: ReverseIPScan): Promise<void> {
    const scans = await this.getAllScans();
    const index = scans.findIndex(scan => scan.id === updatedScan.id);
    
    if (index !== -1) {
      scans[index] = updatedScan;
      await StorageService.setItem(this.STORAGE_KEY, scans);
    }
  }
} 