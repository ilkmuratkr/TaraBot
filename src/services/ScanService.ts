import { Scan, ScanConfig, ScanStatus, ScanResult } from '@/models/Scan';

// API endpoint'i
const API_BASE_URL = 'http://localhost:3003/api';

export class ScanService {
  // Yeni bir tarama oluştur
  public static async createScan(config: Omit<ScanConfig, 'id' | 'createdAt' | 'updatedAt' | 'currentIndex'>): Promise<Scan> {
    try {
      const response = await fetch(`${API_BASE_URL}/scans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Tarama oluşturulurken hata oluştu');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Tarama oluşturma hatası:', error);
      throw error;
    }
  }
  
  // Taramayı başlat
  public static async startScan(id: string): Promise<Scan> {
    try {
      const response = await fetch(`${API_BASE_URL}/scans/${id}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Tarama başlatılırken hata oluştu');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Tarama başlatma hatası:', error);
      throw error;
    }
  }
  
  // Taramayı durdur
  public static async pauseScan(id: string): Promise<Scan> {
    try {
      const response = await fetch(`${API_BASE_URL}/scans/${id}/pause`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen hata' }));
        console.error('Tarama durdurma API hatası:', errorData);
        throw new Error(errorData.message || 'Tarama duraklatılırken hata oluştu');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Tarama duraklatma hatası:', error);
      
      // Hata mesajını daha anlaşılır hale getir
      let errorMessage = 'Tarama duraklatılırken bir hata oluştu';
      if (error instanceof Error) {
        if (error.message.includes('Could not remove job')) {
          errorMessage = 'Tarama işi durdurulamadı, ancak tarama durumu güncellendi. Lütfen sayfayı yenileyiniz.';
        } else {
          errorMessage = error.message;
        }
      }
      
      throw new Error(errorMessage);
    }
  }
  
  // Taramayı iptal et
  public static async cancelScan(id: string): Promise<Scan> {
    try {
      const response = await fetch(`${API_BASE_URL}/scans/${id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen hata' }));
        console.error('Tarama iptal API hatası:', errorData);
        throw new Error(errorData.message || 'Tarama iptal edilirken hata oluştu');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Tarama iptal hatası:', error);
      
      // Hata mesajını daha anlaşılır hale getir
      let errorMessage = 'Tarama iptal edilirken bir hata oluştu';
      if (error instanceof Error) {
        if (error.message.includes('Could not remove job')) {
          errorMessage = 'Tarama işi iptal edilemedi, ancak tarama durumu güncellendi. Lütfen sayfayı yenileyiniz.';
        } else {
          errorMessage = error.message;
        }
      }
      
      throw new Error(errorMessage);
    }
  }
  
  // Tüm taramaları getir
  public static async getAllScans(): Promise<Scan[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/scans`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Taramalar alınırken hata oluştu');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Taramaları getirme hatası:', error);
      return [];
    }
  }
  
  // Tarama getir
  public static async getScan(id: string): Promise<Scan | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/scans/${id}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        const errorData = await response.json();
        throw new Error(errorData.message || 'Tarama alınırken hata oluştu');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Tarama getirme hatası:', error);
      return null;
    }
  }
  
  // Tarama sonuçlarını getir
  public static async getScanResults(id: string, page = 0, limit = 20): Promise<ScanResult[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/scans/${id}/results?page=${page}&limit=${limit}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Tarama sonuçları alınırken hata oluştu');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Tarama sonuçları getirme hatası:', error);
      return [];
    }
  }
  
  // İndirme ve Kopyalama sorunlarını gidermek için yardımcı fonksiyon
  public static downloadTextAsFile(text: string, filename: string): boolean {
    try {
      const blob = new Blob([text], { type: 'text/plain' });
      const elem = document.createElement('a');
      elem.href = URL.createObjectURL(blob);
      elem.download = filename;
      document.body.appendChild(elem);
      elem.click();
      document.body.removeChild(elem);
      return true;
    } catch (error) {
      console.error('İndirme hatası:', error);
      return false;
    }
  }
  
  public static async copyToClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error('Kopyalama hatası:', error);
      return false;
    }
  }
  
  // Taramayı sil
  public static async deleteScan(id: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/scans/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Tarama silinirken hata oluştu');
      }
      
      const result = await response.json();
      return result.success === true;
    } catch (error) {
      console.error('Tarama silme hatası:', error);
      throw error;
    }
  }
} 