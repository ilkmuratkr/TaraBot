import Redis from 'ioredis';
import { config } from './config'; // config dosyasını import et

export const redisClient = new Redis(config.redis.url);

// Worker için kullanılacak özel bağlantı da burada tanımlanabilir veya server.ts'de kalabilir.
// Şimdilik sadece ana redisClient'ı buraya taşıyoruz.
export const workerConnection = new Redis(config.redis.url, {
  maxRetriesPerRequest: null,
});

redisClient.on('connect', () => {
  console.log('Ana Redis client bağlandı.');
});

redisClient.on('error', (err) => {
  console.error('Ana Redis client hatası:', err);
});

workerConnection.on('connect', () => {
  console.log('Worker Redis bağlantısı bağlandı.');
});

workerConnection.on('error', (err) => {
  console.error('Worker Redis bağlantı hatası:', err);
}); 