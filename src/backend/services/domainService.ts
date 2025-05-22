import { v4 as uuidv4 } from 'uuid';
import { redisClient } from '../redisClient';
import { Domain, DomainList } from '../../models/DomainList';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import path from 'path';

// Redis anahtarları için ön ek
const DOMAIN_LIST_KEY_PREFIX = 'domain_list:';
const DOMAIN_KEY_PREFIX = 'domains:';

// Domain listesi oluştur
export async function createDomainList(name: string, source: string): Promise<DomainList> {
  const now = new Date();
  const id = uuidv4();
  
  const list: DomainList = {
    id,
    name,
    source,
    createdAt: now,
    updatedAt: now,
    domains: []
  };
  
  // Redis'e kaydet
  await redisClient.set(DOMAIN_LIST_KEY_PREFIX + id, JSON.stringify(list));
  
  return list;
}

// Domain listesini güncelle
export async function updateDomainList(
  listId: string, 
  data: { name?: string, source?: string, domains?: Domain[] }
): Promise<DomainList | null> {
  // Mevcut listeyi kontrol et
  const list = await getDomainList(listId);
  if (!list) return null;
  
  // Listeyi güncelle
  const updatedList: DomainList = {
    ...list,
    ...data,
    updatedAt: new Date()
  };
  
  // Redis'e güncellenmiş listeyi kaydet
  await redisClient.set(DOMAIN_LIST_KEY_PREFIX + listId, JSON.stringify(updatedList));
  
  // Domainler güncellenecekse
  if (data.domains) {
    // Mevcut domainleri temizle
    await redisClient.del(DOMAIN_KEY_PREFIX + listId);
    
    // Yeni domainleri ekle
    for (const domain of data.domains) {
      await redisClient.lpush(DOMAIN_KEY_PREFIX + listId, JSON.stringify({
        id: domain.id || uuidv4(),
        domain: domain.domain,
        rank: domain.rank
      }));
    }
  }
  
  // Güncellenmiş listeyi döndür
  return getDomainList(listId);
}

// Domain listesine domain ekle
export async function addDomainToList(listId: string, domain: string): Promise<Domain> {
  const list = await getDomainList(listId);
  if (!list) throw new Error('Domain listesi bulunamadı');
  
  const newDomain: Domain = {
    id: uuidv4(),
    domain
  };
  
  // Domain'i Redis'e ekle
  await redisClient.lpush(DOMAIN_KEY_PREFIX + listId, JSON.stringify(newDomain));
  
  return newDomain;
}

// CSV dosyasından domainleri yükle
export async function importDomainsFromCsv(listId: string, filePath: string, delimiter = ','): Promise<{ total: number, added: number }> {
  const list = await getDomainList(listId);
  if (!list) throw new Error('Domain listesi bulunamadı');
  
  // CSV dosyasını oku
  const fileContent = fs.readFileSync(filePath, { encoding: 'utf-8' });
  
  // CSV'yi ayrıştır
  const records = parse(fileContent, { 
    columns: true, 
    skip_empty_lines: true,
    delimiter 
  });
  
  let added = 0;
  const domainColumn = records.length > 0 && records[0].domain ? 'domain' : 'Domain';
  
  // Her kayıt için domain oluştur ve Redis'e ekle
  for (const record of records) {
    if (record[domainColumn]) {
      const domain = record[domainColumn].trim().toLowerCase();
      if (domain) {
        const newDomain: Domain = {
          id: uuidv4(),
          domain
        };
        
        await redisClient.lpush(DOMAIN_KEY_PREFIX + listId, JSON.stringify(newDomain));
        added++;
      }
    }
  }
  
  // Liste metadatasını güncelle
  list.updatedAt = new Date();
  await redisClient.set(DOMAIN_LIST_KEY_PREFIX + listId, JSON.stringify(list));
  
  return { total: records.length, added };
}

// Domain listesi sil
export async function deleteDomainList(listId: string): Promise<boolean> {
  const exists = await redisClient.exists(DOMAIN_LIST_KEY_PREFIX + listId);
  
  if (!exists) return false;
  
  // Liste ve domainleri sil
  await redisClient.del(DOMAIN_LIST_KEY_PREFIX + listId);
  await redisClient.del(DOMAIN_KEY_PREFIX + listId);
  
  return true;
}

// Tüm domain listelerini getir
export async function getAllDomainLists(): Promise<DomainList[]> {
  // Tüm liste anahtarlarını bul
  const keys = await redisClient.keys(DOMAIN_LIST_KEY_PREFIX + '*');
  
  if (keys.length === 0) return [];
  
  // Her listeyi getir
  const lists: DomainList[] = [];
  
  for (const key of keys) {
    const listData = await redisClient.get(key);
    if (listData) {
      try {
        const list = JSON.parse(listData) as DomainList;
        
        // Tarihleri düzgün formata dönüştür
        list.createdAt = new Date(list.createdAt);
        list.updatedAt = new Date(list.updatedAt);
        
        // Domain sayısını getir
        const domainCount = await redisClient.llen(DOMAIN_KEY_PREFIX + list.id);
        
        // Domain sayısını doğru şekilde döndür
        const domainPlaceholders = Array(domainCount).fill({ id: "", domain: "" });
        
        lists.push({
          ...list,
          domains: domainPlaceholders // Boş içerikli ama doğru sayıda domain dizisi döndür
        });
      } catch (error) {
        console.error('Liste verisi ayrıştırılamadı:', error);
      }
    }
  }
  
  // Tarih sırasına göre sırala (en yeni en üstte)
  return lists.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

// Belirli bir domain listesini getir
export async function getDomainList(listId: string): Promise<DomainList | null> {
  const listData = await redisClient.get(DOMAIN_LIST_KEY_PREFIX + listId);
  
  if (!listData) return null;
  
  try {
    const list = JSON.parse(listData) as DomainList;
    
    // Tarihleri düzgün formata dönüştür
    list.createdAt = new Date(list.createdAt);
    list.updatedAt = new Date(list.updatedAt);
    
    // Domainleri getir
    const domainCount = await redisClient.llen(DOMAIN_KEY_PREFIX + listId);
    
    if (domainCount > 0) {
      const domainData = await redisClient.lrange(DOMAIN_KEY_PREFIX + listId, 0, domainCount - 1);
      list.domains = domainData.map((data: string) => JSON.parse(data) as Domain);
    } else {
      list.domains = [];
    }
    
    return list;
  } catch (error) {
    console.error('Liste verisi ayrıştırılamadı:', error);
    return null;
  }
}

// Domain listesinin domainlerini getir (sayfalama ile)
export async function getDomainListDomains(listId: string, page = 0, limit = 100): Promise<Domain[]> {
  const start = page * limit;
  const end = start + limit - 1;
  
  const domainData = await redisClient.lrange(DOMAIN_KEY_PREFIX + listId, start, end);
  
  return domainData.map((data: string) => JSON.parse(data) as Domain);
} 