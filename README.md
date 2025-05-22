# TaraBot - Web Tarama Botu

TaraBot, büyük domain listelerini otomatik olarak tarayarak belirtilen dizinlerde anahtar kelimeleri arayan güçlü bir web tarama botudur.

## Özellikler

- **Büyük Domain Listesi Desteği**: Milyonlarca domain içeren listelerle çalışabilir
- **Alt Alan Adı Tarama**: Domain'lerin alt alan adlarını da tarama imkanı
- **Özelleştirilebilir Dizinler**: İstediğiniz dizinleri ve yolları belirleyebilme
- **Anahtar Kelime Arama**: Belirtilen dizinlerde anahtar kelime ve ifadeleri tarama
- **Durdurup Devam Edebilme**: Taramayı istediğiniz noktada durdurup, daha sonra kaldığınız yerden devam edebilme
- **Yüksek Performans**: Çoklu iş parçacığı desteği ile hızlı tarama kapasitesi

## Teknolojiler

### Frontend
- **Next.js 14**: React tabanlı, SSR destekli, hızlı ve SEO dostu web framework
- **TypeScript**: Tip güvenliği ve daha az hata için
- **Tailwind CSS**: Hızlı UI geliştirme için utility-first CSS framework
- **React Query**: Veri yönetimi ve API istekleri için
- **Dexie.js**: IndexedDB'yi kolay kullanmak için wrapper kütüphanesi

### Backend
- **Node.js**: Yüksek performanslı ve ölçeklenebilir sunucu ortamı
- **Express**: Hızlı API geliştirme için minimalist web framework
- **Bull**: Redis-tabanlı dayanıklı kuyruk sistemi
- **Cheerio**: Sunucu tarafında HTML ayrıştırma için
- **Axios**: HTTP istekleri için
- **Redis**: Önbellek ve kuyruk yönetimi için

## Gereksinimler

- Node.js 18 veya üstü
- Redis 6 veya üstü

## Kurulum

### 1. Bağımlılıkları Yükleyin

```bash
# Repository'yi klonlayın
git clone https://github.com/username/tarabot.git
cd tarabot

# Bağımlılıkları yükleyin
npm install
```

### 2. Redis Kurulumu

#### macOS (Homebrew ile):

```bash
brew install redis
brew services start redis
```

#### Linux (Ubuntu/Debian):

```bash
sudo apt update
sudo apt install redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

#### Windows:

Windows için Redis'in resmi olmayan sürümünü [buradan](https://github.com/microsoftarchive/redis/releases) indirebilirsiniz. Ya da WSL (Windows Subsystem for Linux) kullanabilirsiniz.

### 3. Çevre Değişkenlerini Yapılandırın

Proje kök dizininde bir `.env` dosyası oluşturun:

```env
# Redis Yapılandırması
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# Server Yapılandırması
PORT=3001
HOST=localhost

# Admin Panel
ADMIN_ENABLED=true
ADMIN_API_KEY=tarabot-admin-key

# Tarama İşlemi Yapılandırması
SCANNER_CONCURRENCY=5
SCANNER_TIMEOUT=10000
SCANNER_RETRIES=2
SCANNER_USER_AGENT=TaraBot Scanner/1.0

# CORS Yapılandırması
CORS_ORIGIN=http://localhost:3000
```

### 4. Uygulamayı Çalıştırın

#### Geliştirme Modu:

```bash
# Frontend (Next.js uygulaması)
npm run dev

# Backend (Express API)
npm run backend
```

#### Üretim Modu:

```bash
# Uygulamayı derleyin
npm run build

# Uygulamayı başlatın
npm start
```

## Kullanım

1. **Domain Listesi Oluşturun/Yükleyin**: 
   - "Domain Listeleri" sayfasından yeni bir liste yükleyin 
   - CSV formatında domain listesi ekleyin

2. **Yeni Tarama Başlatın**:
   - "Yeni Tarama" sayfasından bir tarama adı ve domain listesi seçin
   - Alt alan adlarını, dizinleri ve anahtar kelimeleri belirleyin
   - "Taramayı Başlat" butonuna tıklayın

3. **Tarama İşlemlerini Yönetin**:
   - Devam eden taramaları görebilir ve durdurabilirsiniz
   - Durdurulan taramaları kaldığınız yerden devam ettirebilirsiniz
   - Tamamlanan tarama sonuçlarını görüntüleyebilir ve CSV olarak dışa aktarabilirsiniz

## Kuyruk Yönetim Paneli

Tarama kuyruğunu izlemek ve yönetmek için bir panel mevcuttur:

```
http://localhost:3001/admin/queues
```

Panele erişmek için `x-api-key` başlığıyla API anahtarını göndermeniz gerekir (varsayılan: `tarabot-admin-key`).

## Lisans

MIT 