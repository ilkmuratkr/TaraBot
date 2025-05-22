'use client';

import { DomainList } from '@/models/DomainList';

/**
 * IndexedDB kullanarak büyük domain listelerini depolamaya yardımcı olan servis
 */
export class StorageService {
  private static readonly DB_NAME = 'TaraBotDB';
  private static readonly STORE_NAME = 'domainLists';
  private static readonly DB_VERSION = 1;

  /**
   * IndexedDB bağlantısını başlatır
   */
  private static openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('Tarayıcınız IndexedDB desteklemiyor.'));
        return;
      }

      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = (event) => {
        reject(new Error('IndexedDB açılırken hata oluştu.'));
      };

      request.onsuccess = (event) => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }

  /**
   * LocalStorage'dan bir değeri getirir
   */
  public static async getItem(key: string): Promise<any> {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error(`LocalStorage getItem hatası (${key}):`, error);
      return null;
    }
  }

  /**
   * LocalStorage'a bir değer kaydeder
   */
  public static async setItem(key: string, value: any): Promise<boolean> {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`LocalStorage setItem hatası (${key}):`, error);
      return false;
    }
  }

  /**
   * LocalStorage'dan bir değeri siler
   */
  public static async removeItem(key: string): Promise<boolean> {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`LocalStorage removeItem hatası (${key}):`, error);
      return false;
    }
  }

  /**
   * Tüm domain listelerini getirir
   */
  public static async getAllLists(): Promise<DomainList[]> {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.STORE_NAME, 'readonly');
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
          const lists = request.result as DomainList[];
          // Tarihleri string'den Date'e dönüştür
          resolve(lists.map(list => ({
            ...list,
            createdAt: new Date(list.createdAt),
            updatedAt: new Date(list.updatedAt),
          })));
        };

        request.onerror = () => {
          reject(new Error('Domain listeleri getirilirken hata oluştu.'));
        };
      });
    } catch (error) {
      console.error('IndexedDB getAll hatası:', error);
      return [];
    }
  }

  /**
   * Belirli bir domain listesini ID'ye göre getirir
   */
  public static async getListById(id: string): Promise<DomainList | null> {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.STORE_NAME, 'readonly');
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => {
          const list = request.result as DomainList;
          if (!list) {
            resolve(null);
            return;
          }
          // Tarihleri string'den Date'e dönüştür
          resolve({
            ...list,
            createdAt: new Date(list.createdAt),
            updatedAt: new Date(list.updatedAt),
          });
        };

        request.onerror = () => {
          reject(new Error('Domain listesi getirilirken hata oluştu.'));
        };
      });
    } catch (error) {
      console.error('IndexedDB getById hatası:', error);
      return null;
    }
  }

  /**
   * Bir domain listesini kaydeder veya günceller
   */
  public static async saveList(list: DomainList): Promise<boolean> {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.STORE_NAME, 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.put(list);

        request.onsuccess = () => {
          resolve(true);
        };

        request.onerror = () => {
          reject(new Error('Domain listesi kaydedilirken hata oluştu.'));
        };
      });
    } catch (error) {
      console.error('IndexedDB save hatası:', error);
      return false;
    }
  }

  /**
   * Bir domain listesini siler
   */
  public static async deleteList(id: string): Promise<boolean> {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.STORE_NAME, 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => {
          resolve(true);
        };

        request.onerror = () => {
          reject(new Error('Domain listesi silinirken hata oluştu.'));
        };
      });
    } catch (error) {
      console.error('IndexedDB delete hatası:', error);
      return false;
    }
  }

  /**
   * Tüm listeleri siler (temizleme)
   */
  public static async clearAllLists(): Promise<boolean> {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.STORE_NAME, 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => {
          resolve(true);
        };

        request.onerror = () => {
          reject(new Error('Domain listeleri temizlenirken hata oluştu.'));
        };
      });
    } catch (error) {
      console.error('IndexedDB clear hatası:', error);
      return false;
    }
  }
} 