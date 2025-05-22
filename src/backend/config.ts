// Redis, Express ve diğer servisler için yapılandırma dosyası
export const config = {
  // Redis ayarları
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD || '',
    prefix: 'tarabot:'
  },
  
  // HTTP sunucu ayarları
  server: {
    port: parseInt(process.env.PORT || '3003', 10),
    host: process.env.HOST || 'localhost'
  },
  
  // Admin panel ayarları
  admin: {
    enabled: process.env.ADMIN_ENABLED === 'true',
    apiKey: process.env.ADMIN_API_KEY || 'tarabot-admin-key'
  },
  
  // Tarama işlemi ayarları
  scanner: {
    concurrency: parseInt(process.env.SCANNER_CONCURRENCY || '10', 10), // Aynı anda taranacak domain sayısı - varsayılan 10 (daha verimli tarama için)
    timeout: parseInt(process.env.SCANNER_TIMEOUT || '5000', 10), // Her istek için zaman aşımı (ms) - varsayılan 5 saniye (daha hızlı tarama için)
    retries: parseInt(process.env.SCANNER_RETRIES || '1', 10), // Başarısız istekler için yeniden deneme sayısı - varsayılan 1 (çok deneme yapmadan hızlı ilerlemek için)
    userAgent: process.env.SCANNER_USER_AGENT || 'Mozilla/5.0 (compatible; TaraBot/1.0; +https://example.com/bot)',
    batchSize: parseInt(process.env.SCANNER_BATCH_SIZE || '20', 10), // İşlenecek domain batch boyutu - varsayılan 20 (daha verimli işleme için)
    urlBatchSize: parseInt(process.env.SCANNER_URL_BATCH_SIZE || '5', 10), // Parallel HTTP istekleri - varsayılan 5 (dengeli performans için)
    maxRetryDelay: parseInt(process.env.SCANNER_MAX_RETRY_DELAY || '3000', 10), // Maksimum yeniden deneme gecikmesi (ms) - varsayılan 3 saniye
    waitBetweenRetries: parseInt(process.env.SCANNER_WAIT_BETWEEN_RETRIES || '2000', 10), // Denemeler arası bekleme süresi (ms) - varsayılan 2 saniye
    // Redis bellek optimizasyonu için ekstra ayarlar
    maxResultsPerScan: parseInt(process.env.SCANNER_MAX_RESULTS || '5000', 10), // Bir taramada saklanacak maksimum sonuç sayısı
    cleanupInterval: parseInt(process.env.SCANNER_CLEANUP_INTERVAL || '300000', 10), // Redis temizleme aralığı (ms) - varsayılan 5 dakika
    resultTTL: parseInt(process.env.SCANNER_RESULT_TTL_DAYS || '7', 10), // Sonuçların saklanma süresi (gün) - varsayılan 7 gün
    maxResultsToKeepAfterOptimization: parseInt(process.env.SCANNER_MAX_RESULTS_OPTIMIZED || '1000', 10), // Optimizasyon sonrası tutulacak max sonuç - varsayılan 1000
  },
  
  // CORS ayarları
  cors: {
    origin: process.env.CORS_ORIGIN || '*', // İzin verilen kaynak
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
  },
  
  // JWT token ayarları
  jwt: {
    secret: process.env.JWT_SECRET || 'tarabot-development-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d'
  }
}; 