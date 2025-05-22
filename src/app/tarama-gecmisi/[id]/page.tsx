'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { ScanService } from '@/services/ScanService';
import { Scan, ScanStatus, ScanResult } from '@/models/Scan';
import { FaPlay, FaPause, FaStop, FaDownload, FaExclamationTriangle, FaSync } from 'react-icons/fa';

// Durum etiketleri için renk sınıfları ve metinleri
const statusClasses: Record<ScanStatus, string> = {
  pending: 'bg-gray-100 text-gray-800',
  running: 'bg-blue-100 text-blue-800',
  paused: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  canceled: 'bg-gray-100 text-gray-800',
};

const statusTexts: Record<ScanStatus, string> = {
  pending: 'Bekliyor',
  running: 'Devam Ediyor',
  paused: 'Duraklatıldı',
  completed: 'Tamamlandı',
  failed: 'Başarısız',
  canceled: 'İptal Edildi',
};

export default function ScanDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [scan, setScan] = useState<Scan | null>(null);
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'results'>('overview');
  
  // Tarama detaylarını yükle
  useEffect(() => {
    const fetchScanDetails = async () => {
      try {
        setLoading(true);
        const scanData = await ScanService.getScan(params.id);
        
        if (!scanData) {
          setError('Tarama bulunamadı');
        } else {
          setScan(scanData);
          
          // Sonuçları ayrıca getir
          const results = await ScanService.getScanResults(params.id, 0, 100);
          setScanResults(results);
          
          // Eğer tarama devam ediyorsa, her 3 saniyede bir yenile
          if (scanData.status === 'running') {
            const interval = setInterval(async () => {
              try {
                const updatedScan = await ScanService.getScan(params.id);
                if (updatedScan) {
                  setScan(updatedScan);
                  
                  // Sonuçları da güncelle
                  const updatedResults = await ScanService.getScanResults(params.id, 0, 100);
                  setScanResults(updatedResults);
                  
                  // Tarama durmuşsa interval'ı durdur
                  if (updatedScan.status !== 'running') {
                    clearInterval(interval);
                  }
                }
              } catch (err) {
                console.error('Tarama güncellenirken hata:', err);
              }
            }, 3000);
            
            // Component unmount olduğunda interval'ı temizle
            return () => clearInterval(interval);
          }
        }
      } catch (err) {
        setError('Tarama detayları yüklenirken hata oluştu');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchScanDetails();
  }, [params.id]);
  
  // Taramayı başlat
  const handleStartScan = async () => {
    try {
      if (!scan) return;
      
      const updatedScan = await ScanService.startScan(scan.id);
      setScan(updatedScan);
      
      // Sayfayı yenile
      router.refresh();
    } catch (err) {
      console.error('Tarama başlatılırken hata:', err);
      alert('Tarama başlatılamadı');
    }
  };
  
  // Taramayı durdur
  const handlePauseScan = async () => {
    try {
      if (!scan) return;
      
      const updatedScan = await ScanService.pauseScan(scan.id);
      setScan(updatedScan);
      
      // Sayfayı yenile
      router.refresh();
    } catch (err) {
      console.error('Tarama durdurulurken hata:', err);
      
      // Kullanıcıya daha anlaşılır hata mesajı göster
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'Tarama durdurulamadı. Lütfen daha sonra tekrar deneyiniz.';
        
      alert(errorMessage);
    }
  };
  
  // Taramayı iptal et
  const handleCancelScan = async () => {
    try {
      if (!scan) return;
      
      if (confirm('Taramayı iptal etmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) {
        const updatedScan = await ScanService.cancelScan(scan.id);
        setScan(updatedScan);
        
        // Sayfayı yenile
        router.refresh();
      }
    } catch (err) {
      console.error('Tarama iptal edilirken hata:', err);
      
      // Kullanıcıya daha anlaşılır hata mesajı göster
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'Tarama iptal edilemedi. Lütfen daha sonra tekrar deneyiniz.';
        
      alert(errorMessage);
    }
  };
  
  // Sonuçları dışa aktar
  const handleExportResults = async () => {
    if (!scan) return;
    
    try {
      setLoading(true);
      
      // Taramada bulgu yoksa bilgi ver
      if (scan.progress.foundResults === 0) {
        alert('İndirilecek sonuç bulunamadı.');
        return;
      }
      
      // Tüm sonuçları toplamak için dizi
      let allResults: ScanResult[] = [];
      
      // Sayfalama ile tüm sonuçları al
      const pageSize = 100; // Her sayfada kaç sonuç alınacak
      const totalPages = Math.ceil(scan.progress.foundResults / pageSize);
      
      for (let page = 0; page < totalPages; page++) {
        const results = await ScanService.getScanResults(scan.id, page, pageSize);
        allResults = [...allResults, ...results];
      }
      
      if (allResults.length === 0) {
        alert('İndirilecek sonuç bulunamadı.');
        return;
      }
      
      // TXT formatında indirme
      let txt = '';
      allResults.forEach((result) => {
        txt += `URL: ${result.url}\n`;
        txt += `Domain: ${result.domain}\n`;
        txt += `Path: ${result.path}\n`;
        if (result.subdomain) txt += `Subdomain: ${result.subdomain}\n`;
        txt += `Bulunan Terimler: ${result.foundTerms.join(', ')}\n`;
        txt += `HTTP Kodu: ${result.statusCode}\n`;
        txt += `Tarih: ${new Date(result.timestamp).toLocaleString('tr-TR')}\n`;
        txt += '----------------------------------------\n\n';
      });
      
      // Dosyayı indir
      const blob = new Blob([txt], { type: 'text/plain;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `tarama-sonuclari-${scan.config.name}-${new Date().toISOString().slice(0,10)}.txt`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Sonuçlar indirilirken hata oluştu:', error);
      alert('Sonuçlar indirilirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };
  
  // Sadece URL'leri dışa aktar - basit çözüm
  const handleExportURLsOnly = () => {
    if (!scan || !scan.results || scan.results.length === 0) {
      alert('İndirilecek sonuç bulunamadı.');
      return;
    }
    
    // URL'leri ayıkla
    const urls = scan.results.map(result => result.url);
    const urlsText = urls.join('\n');
    
    try {
      // Eski tarayıcılarda çalışan indirme yöntemi
      const blob = new Blob([urlsText], { type: 'text/plain' });
      const elem = window.document.createElement('a');
      elem.href = window.URL.createObjectURL(blob);
      elem.download = `urls-${scan.config.name}.txt`;
      document.body.appendChild(elem);
      elem.click();
      document.body.removeChild(elem);
      
      console.log('İndirme tamamlandı');
    } catch (error) {
      console.error('URL indirme hatası:', error);
      
      // İndirme başarısız olursa kopyalama yapalım
      try {
        navigator.clipboard.writeText(urlsText);
        alert('URL\'ler indirilemedi ama panoya kopyalandı');
      } catch (copyError) {
        // En kötü durumda kullanıcıya URL'leri gösterelim
        alert('URL\'leri indirme ve kopyalama başarısız oldu. Konsola yazıldı.');
        console.log('URL Listesi:\n' + urlsText);
      }
    }
  };
  
  // Yükleme durumu
  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center p-8">
          <div className="inline-block w-6 h-6 mr-2 border-2 border-t-2 border-gray-200 border-t-primary-600 rounded-full animate-spin"></div>
          <span>Tarama detayları yükleniyor...</span>
        </div>
      </Layout>
    );
  }
  
  // Hata durumu
  if (error || !scan) {
    return (
      <Layout>
        <div className="p-8 text-center">
          <FaExclamationTriangle className="mx-auto mb-4 text-4xl text-red-500" />
          <h2 className="mb-2 text-xl font-bold text-gray-800">{error || 'Tarama bulunamadı'}</h2>
          <p className="mb-4 text-gray-600">
            Bu tarama silinmiş veya erişim izniniz olmayabilir.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => router.push('/tarama-gecmisi')}
          >
            Tarama Geçmişine Dön
          </button>
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout>
      <div className="space-y-6">
        {/* Tarama başlığı ve eylemler */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{scan.config.name}</h1>
            <p className="text-gray-600">
              {scan.config.domainListName} ({scan.progress.totalDomains.toLocaleString('tr-TR')} domain)
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {/* Durum etiketi */}
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${statusClasses[scan.status]}`}>
              {statusTexts[scan.status]}
            </span>
            
            {/* Eylem butonları */}
            <div className="flex gap-2">
              {/* Devam Et / Durdur butonları */}
              {(scan.status === 'paused' || scan.status === 'pending') && (
                <button
                  type="button"
                  onClick={handleStartScan}
                  className="flex items-center px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                >
                  <FaPlay className="mr-1" /> Başlat
                </button>
              )}
              
              {scan.status === 'running' && (
                <button
                  type="button"
                  onClick={handlePauseScan}
                  className="flex items-center px-3 py-2 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700"
                >
                  <FaPause className="mr-1" /> Durdur
                </button>
              )}
              
              {/* İptal butonu */}
              {['running', 'paused', 'pending'].includes(scan.status) && (
                <button
                  type="button"
                  onClick={handleCancelScan}
                  className="flex items-center px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                >
                  <FaStop className="mr-1" /> İptal
                </button>
              )}
              
              {/* Dışa Aktar butonu */}
              {scan.results.length > 0 && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleExportResults}
                    className="flex items-center px-3 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700"
                  >
                    <FaDownload className="mr-1" /> Tüm Raporu İndir
                  </button>
                  <button
                    type="button"
                    onClick={handleExportURLsOnly}
                    className="flex items-center px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                  >
                    <FaDownload className="mr-1" /> Sadece URL'leri İndir
                  </button>
                </div>
              )}
              
              {/* Sayfayı Yenile butonu */}
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex items-center mt-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                <FaSync className="mr-1" /> Sayfayı Yenile
              </button>
            </div>
          </div>
        </div>
        
        {/* Sekmeler */}
        <div className="flex border-b border-gray-200">
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'overview'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('overview')}
          >
            Genel Bakış
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'results'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('results')}
          >
            Sonuçlar {scan.results && scan.results.length > 0 && `(${scan.results.length})`}
          </button>
        </div>
        
        {/* Sekme içeriği */}
        {activeTab === 'overview' ? (
          <div className="space-y-6">
            {/* İlerleme kartı */}
            <div className="p-6 bg-white rounded-lg shadow-sm">
              <h2 className="mb-4 text-lg font-medium text-gray-800">Tarama İlerlemesi</h2>
              
              <div className="mb-2 flex justify-between items-center">
                <span className="text-sm text-gray-600">
                  {scan.progress?.scannedDomains?.toLocaleString('tr-TR') || 0} / {scan.progress?.totalDomains?.toLocaleString('tr-TR') || 0} domain
                </span>
                <span className="text-sm font-medium text-gray-800">
                  {scan.progress?.totalDomains > 0
                    ? Math.floor((scan.progress.scannedDomains / scan.progress.totalDomains) * 100)
                    : 0}%
                </span>
              </div>
              
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-600"
                  style={{
                    width: `${
                      scan.progress?.totalDomains > 0
                        ? Math.floor((scan.progress.scannedDomains / scan.progress.totalDomains) * 100)
                        : 0
                    }%`,
                  }}
                ></div>
              </div>
              
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-primary-600">
                    {scan.progress?.scannedDomains?.toLocaleString('tr-TR') || 0}
                  </div>
                  <div className="text-sm text-gray-500">Taranan Domain</div>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-primary-600">
                    {scan.progress?.foundResults?.toLocaleString('tr-TR') || 0}
                  </div>
                  <div className="text-sm text-gray-500">Bulunan Sonuç</div>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-primary-600">
                    {scan.startedAt
                      ? new Date(scan.startedAt).toLocaleString('tr-TR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '-'}
                  </div>
                  <div className="text-sm text-gray-500">Başlangıç Zamanı</div>
                </div>
              </div>

              {/* Anlık çıktılar - yeni eklenen bölüm */}
              {scan.status === 'running' && scanResults.length > 0 && (
                <div className="mt-6 border-t pt-4">
                  <h3 className="text-md font-medium text-gray-800 mb-2">Anlık Bulunan Sonuçlar</h3>
                  <div className="flex mb-2">
                    <button
                      onClick={() => {
                        const urls = scanResults.map(result => result.url).join('\n');
                        navigator.clipboard.writeText(urls)
                          .then(() => alert('Sonuçlar panoya kopyalandı'))
                          .catch(() => alert('Kopyalama başarısız oldu'));
                      }}
                      className="px-3 py-1 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 mr-2"
                    >
                      Tüm URL'leri Kopyala
                    </button>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-md max-h-96 overflow-y-auto text-sm">
                    {scanResults.map((result, idx) => (
                      <div key={idx} className="mb-1 pb-1 border-b border-gray-100 last:border-0">
                        <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                          {result.url}
                        </a>
                        <span className="ml-2 text-xs text-gray-500">
                          ({result.foundTerms.join(', ')})
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  <h3 className="text-md font-medium text-gray-800 mt-4 mb-2">Kolay Kopyalanabilir URL Listesi</h3>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <textarea 
                      className="w-full h-40 p-2 text-sm bg-white border border-gray-200 rounded-md"
                      readOnly
                      value={scanResults.map(result => result.url).join('\n')}
                      onClick={(e) => {
                        const textarea = e.target as HTMLTextAreaElement;
                        textarea.select();
                        navigator.clipboard.writeText(textarea.value)
                          .then(() => alert('URL\'ler panoya kopyalandı'))
                          .catch(() => {});
                      }}
                    />
                    <p className="mt-1 text-xs text-gray-500">URL'leri kopyalamak için metin alanına tıklayın</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Tarama detayları kartı */}
            <div className="p-6 bg-white rounded-lg shadow-sm">
              <h2 className="mb-4 text-lg font-medium text-gray-800">Tarama Bilgileri</h2>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Domain Listesi</h3>
                    <p>{scan.config.domainListName}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Başlangıç Sırası</h3>
                    <p>{scan.config.startIndex}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Alt Alan Adları</h3>
                    <p>
                      {scan.config.includeSubdomains
                        ? scan.config.subdomains.join(', ') || 'Belirtilmemiş'
                        : 'Dahil Edilmedi'}
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Şu Anki İndeks</h3>
                    <p>{scan.config.currentIndex.toLocaleString('tr-TR')}</p>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Dizinler</h3>
                  <p>{scan.config.paths.join(', ')}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Arama Terimleri</h3>
                  <p>{scan.config.searchTerms.join(', ')}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm">
            {scanResults && scanResults.length > 0 ? (
              <div className="p-4">
                <h3 className="text-lg font-medium text-gray-800 mb-4">URL Listesi</h3>
                <div className="mb-4 flex gap-2">
                  <button
                    onClick={() => {
                      // URL'leri kopyalama
                      const urls = scanResults.map(result => result.url).join('\n');
                      ScanService.copyToClipboard(urls)
                        .then(success => {
                          if (success) {
                            alert('URL\'ler panoya kopyalandı');
                          } else {
                            alert('URL\'ler kopyalanamadı');
                          }
                        });
                    }}
                    className="btn btn-primary"
                  >
                    Tüm URL'leri Kopyala
                  </button>
                  <button
                    onClick={() => {
                      const urls = scanResults.map(result => result.url).join('\n');
                      const success = ScanService.downloadTextAsFile(
                        urls, 
                        `urls-${scan.config.name}-${new Date().toISOString().slice(0,10)}.txt`
                      );
                      
                      if (!success) {
                        alert('URL\'ler indirilemedi. Kopyalamayı deneyin.');
                      }
                    }}
                    className="btn btn-secondary"
                  >
                    URL'leri İndir
                  </button>
                </div>
                
                <div className="mt-4 bg-gray-50 p-4 rounded-md">
                  <pre className="whitespace-pre-wrap break-all text-sm text-gray-800">
                    {scanResults.map(result => result.url).join('\n')}
                  </pre>
                </div>
                
                <h3 className="text-lg font-medium text-gray-800 mt-8 mb-4">Detaylı Sonuçlar</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left bg-gray-50">
                        <th className="px-6 py-3 font-medium">URL</th>
                        <th className="px-6 py-3 font-medium">Bulunan Terimler</th>
                        <th className="px-6 py-3 font-medium">Durum Kodu</th>
                        <th className="px-6 py-3 font-medium">Tarih</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {scanResults.map((result, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-left whitespace-normal break-all">
                            <a
                              href={result.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary-600 hover:underline"
                            >
                              {result.url}
                            </a>
                          </td>
                          <td className="px-6 py-4">
                            {result.foundTerms.map((term, i) => (
                              <span
                                key={i}
                                className="inline-block px-2 py-1 mr-1 mb-1 text-xs bg-primary-100 text-primary-800 rounded"
                              >
                                {term}
                              </span>
                            ))}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2 py-1 text-xs rounded ${
                                result.statusCode >= 200 && result.statusCode < 300
                                  ? 'bg-green-100 text-green-800'
                                  : result.statusCode >= 400
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {result.statusCode}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {new Date(result.timestamp).toLocaleString('tr-TR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center">
                <p className="text-gray-500">Henüz sonuç bulunamadı.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
} 