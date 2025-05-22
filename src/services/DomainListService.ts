'use client';

import { DomainList, Domain } from '@/models/DomainList';

// API endpoint'i
const API_BASE_URL = 'http://localhost:3003/api';

export class DomainListService {
  // Tüm domain listelerini getir
  public static async getAll(): Promise<DomainList[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/domains`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Domain listeleri alınırken hata oluştu');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Domain listelerini getirme hatası:', error);
      return [];
    }
  }

  // ID'ye göre domain listesi getir
  public static async getById(id: string): Promise<DomainList | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/domains/${id}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        const errorData = await response.json();
        throw new Error(errorData.message || 'Domain listesi alınırken hata oluştu');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Domain listesi getirme hatası:', error);
      return null;
    }
  }

  // Yeni domain listesi oluştur
  public static async create(name: string, source: string, domains: Domain[] = []): Promise<DomainList> {
    try {
      const response = await fetch(`${API_BASE_URL}/domains`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, source }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Domain listesi oluşturulurken hata oluştu');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Domain listesi oluşturma hatası:', error);
      throw error;
    }
  }

  // Domain listesini güncelle
  public static async update(id: string, data: {name?: string, source?: string, domains?: Domain[]}): Promise<DomainList> {
    try {
      const response = await fetch(`${API_BASE_URL}/domains/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Domain listesi güncellenirken hata oluştu');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Domain listesi güncelleme hatası:', error);
      throw error;
    }
  }

  // Domain listesini sil
  public static async delete(id: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/domains/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Domain listesi silinirken hata oluştu');
      }
      
      return true;
    } catch (error) {
      console.error('Domain listesi silme hatası:', error);
      return false;
    }
  }

  // CSV dosyasından domain listesi içe aktar
  public static async importFromCSV(name: string, source: string, csvContent: string): Promise<DomainList> {
    try {
      const response = await fetch(`${API_BASE_URL}/domains/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, source, csvContent }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'CSV dosyası içe aktarılırken hata oluştu');
      }
      
      return await response.json();
    } catch (error) {
      console.error('CSV içe aktarma hatası:', error);
      throw error;
    }
  }

  // Önceden tanımlanmış listeleri içe aktar
  public static async importPresetLists(): Promise<DomainList[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/domains/presets/import`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Hazır listeler içe aktarılırken hata oluştu');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Hazır listeleri içe aktarma hatası:', error);
      throw error;
    }
  }

  // Domain listesindeki domainleri getir (sayfalama ile)
  public static async getDomainListDomains(listId: string, page = 0, limit = 100): Promise<Domain[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/domains/${listId}/domains?page=${page}&limit=${limit}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Domain listesi domainleri alınırken hata oluştu');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Domain listesi domainleri getirme hatası:', error);
      return [];
    }
  }
} 