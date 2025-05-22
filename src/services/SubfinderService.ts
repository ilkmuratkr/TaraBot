import { API_BASE_URL } from '../config';

// SubFinder taraması için seçenekler (Backend ile uyumlu hale getirildi)
export interface SubfinderOptions {
  timeout?: number;         // İstek zaman aşımı (saniye)
  threads?: number;         // Eşzamanlı işlem sayısı (Subfinder -t parametresi)
  resolvers?: string[];     // DNS sunucuları
  outputFormat?: 'json' | 'text'; // Çıktı formatı
  onlyActive?: boolean;     // Sadece aktif subdomainleri göster (-nW)
  usePassive?: boolean;      // Sadece pasif kaynakları kullan (-passive)
  useActiveNetwork?: boolean; // Aktif ağ kontrolleri yap
  useAllSources?: boolean;   // Tüm kaynakları kullan (-all)
  verbose?: boolean;        // Detaylı çıktı
  usePermutations?: boolean; // Alt domain permütasyonlarını kullan
  useRecursive?: boolean;   // Alt domainler için özyinelemeli tarama yap
  deepDnsSearch?: boolean;  // Derinlemesine DNS kayıtlarını araştır
  useWaybackMachine?: boolean; // Wayback Machine arşivlerini kullan
  permutationMode?: 'short' | 'full'; // Permütasyon modu
}

// SubFinder taraması (Tekil)
export interface SubfinderScan {
  id: string;
  domain: string;
  createdAt: string; // Tarih string formatında geliyor
  options: SubfinderOptions;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped';
  progress?: {
    total: number;
    current: number;
    percent: number;
  };
  result?: SubfinderResult[]; // Bu genellikle ayrı bir endpoint'ten yüklenir
  error?: string;
  multiJobId?: string; // Hangi çoklu işe ait olduğu (eğer varsa)
}

// SubFinder sonucu
export interface SubfinderResult {
  host: string;
  source?: string[] | string;
  ip?: string;
  input?: string; // Backend'deki SubfinderResult ile eşleşmesi için eklendi
}

// Çoklu SubFinder Tarama İşi Veri Yapısı (Backend'deki MultiSubfinderJobData ile uyumlu)
export interface MultiScanJob {
  id: string;
  name: string;
  domains: string[];
  options: SubfinderOptions; 
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'stopping';
  createdAt: string; // Tarih string formatında
  updatedAt: string; // Tarih string formatında
  currentDomainIndex: number; 
  completedDomainScans: { 
    [domain: string]: {
      scanId: string; 
      resultCount: number;
      status: 'completed' | 'failed'; 
      error?: string; 
    } 
  };
  overallProgress: number;
  totalSubdomainsFound: number;
  bullJobIds?: string[]; 
}

export class SubfinderService {
  // Yeni bir SubFinder taraması oluştur
  public static async createScan(domain: string, options: SubfinderOptions = {}): Promise<SubfinderScan> {
    try {
      const response = await fetch(`${API_BASE_URL}/subfinder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domain, options }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'SubFinder taraması oluşturulurken hata oluştu');
      }
      
      return await response.json();
    } catch (error) {
      console.error('SubFinder taraması oluşturma hatası:', error);
      throw error;
    }
  }
  
  // Tüm SubFinder taramalarını getir
  public static async getAllScans(): Promise<SubfinderScan[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/subfinder`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'SubFinder taramaları alınırken hata oluştu');
      }
      
      return await response.json();
    } catch (error) {
      console.error('SubFinder taramaları alma hatası:', error);
      return []; // Hata durumunda boş dizi dön
    }
  }
  
  // Belirli bir SubFinder taramasını getir
  public static async getScan(id: string): Promise<SubfinderScan | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/subfinder/${id}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null; // 404 durumunda null dön
        }
        const errorData = await response.json();
        throw new Error(errorData.message || 'SubFinder taraması alınırken hata oluştu');
      }
      
      return await response.json();
    } catch (error) {
      console.error('SubFinder taraması alma hatası:', error);
      return null;
    }
  }
  
  // SubFinder taramasını başlat
  public static async startScan(id: string): Promise<SubfinderScan | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/subfinder/${id}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'SubFinder taraması başlatılırken hata oluştu');
      }
      
      return await response.json();
    } catch (error) {
      console.error('SubFinder taraması başlatma hatası:', error);
      return null;
    }
  }
  
  // SubFinder taramasını durdur (Tekil tarama için)
  public static async stopScan(id: string): Promise<SubfinderScan | null> { // Dönen tipi SubfinderScan olarak güncelledim
    try {
      const response = await fetch(`${API_BASE_URL}/subfinder/${id}/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'SubFinder taraması durdurulurken hata oluştu');
      }
      return await response.json(); // Güncellenmiş job datasını dön
    } catch (error) {
      console.error('SubFinder taraması durdurma hatası:', error);
      return null;
    }
  }
  
  // SubFinder tarama sonuçlarını getir
  public static async getScanResults(id: string, page = 0, limit = 100): Promise<SubfinderResult[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/subfinder/${id}/results?page=${page}&limit=${limit}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'SubFinder tarama sonuçları alınırken hata oluştu');
      }
      
      return await response.json();
    } catch (error) {
      console.error('SubFinder tarama sonuçları alma hatası:', error);
      return [];
    }
  }
  
  // SubFinder taramasını sil (Tekil tarama için)
  public static async deleteScan(id: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/subfinder/${id}`, {
        method: 'DELETE'
      });
      return response.ok; // Sadece HTTP status koduna bak
    } catch (error) {
      console.error('SubFinder taraması silme hatası:', error);
      return false;
    }
  }

  // --- Çoklu Tarama Fonksiyonları ---

  public static async startMultiScan(name: string, domains: string[], options: SubfinderOptions): Promise<MultiScanJob> {
    const response = await fetch(`${API_BASE_URL}/multiscans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, domains, options }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Çoklu tarama başlatılamadı');
    }
    return response.json();
  }

  public static async getAllMultiScans(): Promise<MultiScanJob[]> {
    const response = await fetch(`${API_BASE_URL}/multiscans`);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Çoklu taramalar getirilemedi');
    }
    return response.json();
  }

  public static async getMultiScanDetails(id: string): Promise<MultiScanJob | null> {
    const response = await fetch(`${API_BASE_URL}/multiscans/${id}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      const errorData = await response.json();
      throw new Error(errorData.message || 'Çoklu tarama detayı getirilemedi');
    }
    return response.json();
  }

  public static async getMultiScanResults(id: string, page = 0, limit = 100): Promise<SubfinderResult[]> {
    const response = await fetch(`${API_BASE_URL}/multiscans/${id}/results?page=${page}&limit=${limit}`);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Çoklu tarama sonuçları getirilemedi');
    }
    return response.json();
  }

  public static async pauseMultiScan(id: string): Promise<MultiScanJob | null> {
    const response = await fetch(`${API_BASE_URL}/multiscans/${id}/pause`, { method: 'POST' });
    if (!response.ok) {
      if (response.status === 404) return null;
      const errorData = await response.json();
      throw new Error(errorData.message || 'Çoklu tarama duraklatılamadı');
    }
    return response.json();
  }

  public static async resumeMultiScan(id: string): Promise<MultiScanJob | null> {
    const response = await fetch(`${API_BASE_URL}/multiscans/${id}/resume`, { method: 'POST' });
    if (!response.ok) {
      if (response.status === 404) return null;
      const errorData = await response.json();
      throw new Error(errorData.message || 'Çoklu tarama devam ettirilemedi');
    }
    return response.json();
  }

  public static async stopMultiScan(id: string): Promise<MultiScanJob | null> {
    const response = await fetch(`${API_BASE_URL}/multiscans/${id}/stop`, { method: 'POST' });
    if (!response.ok) {
      if (response.status === 404) return null;
      const errorData = await response.json();
      throw new Error(errorData.message || 'Çoklu tarama durdurulamadı');
    }
    return response.json();
  }

  public static async deleteMultiScan(id: string): Promise<boolean> {
    const response = await fetch(`${API_BASE_URL}/multiscans/${id}`, { method: 'DELETE' });
    return response.ok;
  }
} 