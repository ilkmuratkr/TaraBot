'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { FaSearch, FaDownload, FaEye, FaFilter, FaSync, FaTrash } from 'react-icons/fa';
import { ScanService } from '@/services/ScanService';
import { Scan, ScanResult } from '@/models/Scan';

export default function ScanHistoryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateSort, setDateSort] = useState<'asc' | 'desc'>('desc');
  const [isLoading, setIsLoading] = useState(false);
  const [scanHistory, setScanHistory] = useState<Scan[]>([]);
  
  // Tarama geçmişini getir
  const fetchScanHistory = async () => {
    setIsLoading(true);
    try {
      const scans = await ScanService.getAllScans();
      setScanHistory(scans);
    } catch (error) {
      console.error('Tarama geçmişi alınırken hata oluştu:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchScanHistory();
  }, []);

  // Filtreleme ve sıralama
  const filteredHistory = scanHistory
    .filter((scan) => {
      // Durum filtresi
      if (statusFilter !== 'all' && scan.status !== statusFilter) {
        return false;
      }
      
      // Arama filtresi
      if (
        searchTerm &&
        !scan.config.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !scan.config.domainListName.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      // Tarih sıralaması
      if (dateSort === 'asc') {
        return new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
      } else {
        return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
      }
    });

  // Tarama durumunu metne çevir
  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Tamamlandı';
      case 'running': return 'Devam Ediyor';
      case 'pending': return 'Bekliyor';
      case 'paused': return 'Duraklatıldı';
      case 'failed': return 'Başarısız';
      case 'canceled': return 'İptal Edildi';
      default: return status;
    }
  };

  // Tarama durumuna göre stil sınıfları
  const getStatusClass = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'running': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'paused': return 'bg-orange-100 text-orange-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'canceled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Sonuçları dışa aktar
  const handleExportResults = async (scanId: string) => {
    try {
      setIsLoading(true);
      // Önce tarama bilgilerini al
      const scan = await ScanService.getScan(scanId);
      
      if (!scan) {
        alert('Tarama bulunamadı.');
        return;
      }
      
      console.log("Sonuçları indirme başladı", scan.id, "için");
      console.log("Sonuç sayısı:", scan.results.length);
      
      // Taramada bulgu yoksa bilgi ver
      if (!scan.results || scan.results.length === 0) {
        console.log("Sonuç bulunamadı.");
        alert('İndirilecek sonuç bulunamadı.');
        return;
      }
      
      // TXT formatında indirme
      let txt = '';
      scan.results.forEach((result) => {
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
      document.body.appendChild(link);
      console.log("İndirme linki hazır");
      link.click();
      console.log("Link tıklandı");
      document.body.removeChild(link);
    } catch (error) {
      console.error('Sonuçlar indirilirken hata oluştu:', error);
      alert('Sonuçlar indirilirken bir hata oluştu: ' + error);
    } finally {
      setIsLoading(false);
    }
  };

  // Sadece URL'leri dışa aktar - basit çözüm
  const handleExportURLsOnly = async (scanId: string) => {
    try {
      setIsLoading(true);
      // Önce tarama bilgilerini al
      const scan = await ScanService.getScan(scanId);
      
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
      } catch (downloadError) {
        console.error('URL indirme hatası:', downloadError);
        
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
    } catch (error) {
      console.error('Tarama bilgileri alınırken hata oluştu:', error);
      alert('Sonuçlar alınırken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  // Taramayı sil
  const handleDeleteScan = async (scanId: string) => {
    if (!confirm('Bu taramayı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) {
      return;
    }
    
    try {
      setIsLoading(true);
      const success = await ScanService.deleteScan(scanId);
      
      if (success) {
        // Silme başarılı olduğunda listeden kaldır
        setScanHistory(scanHistory.filter(scan => scan.id !== scanId));
        alert('Tarama başarıyla silindi.');
      } else {
        alert('Tarama silinemedi, lütfen tekrar deneyin.');
      }
    } catch (error) {
      console.error('Tarama silinirken hata oluştu:', error);
      alert('Tarama silinirken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="flex flex-col space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Tarama Geçmişi</h1>
          <p className="text-gray-600">Önceki taramaları görüntüleyin ve sonuçları inceleyin</p>
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between p-4 bg-white rounded-lg shadow-sm gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <FaSearch className="text-gray-400" />
            </div>
            <input
              type="text"
              className="pl-10 input"
              placeholder="Tarama veya liste adı ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            <div className="relative">
              <select
                className="select appearance-none pr-10"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Tüm Durumlar</option>
                <option value="completed">Tamamlandı</option>
                <option value="running">Devam Ediyor</option>
                <option value="pending">Bekliyor</option>
                <option value="paused">Duraklatıldı</option>
                <option value="failed">Başarısız</option>
                <option value="canceled">İptal Edildi</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <FaFilter className="text-gray-400" />
              </div>
            </div>
            
            <button
              className="btn btn-secondary"
              onClick={() => setDateSort(dateSort === 'asc' ? 'desc' : 'asc')}
            >
              Tarih: {dateSort === 'asc' ? 'Eskiden Yeniye' : 'Yeniden Eskiye'}
            </button>
            
            <button
              className="btn btn-primary flex items-center gap-2"
              onClick={fetchScanHistory}
              disabled={isLoading}
            >
              <FaSync className={isLoading ? 'animate-spin' : ''} />
              Yenile
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left bg-gray-50">
                  <th className="px-6 py-3 font-medium">Tarama Adı</th>
                  <th className="px-6 py-3 font-medium">Domain Listesi</th>
                  <th className="px-6 py-3 font-medium">Başlangıç</th>
                  <th className="px-6 py-3 font-medium">İlerleme</th>
                  <th className="px-6 py-3 font-medium">Durum</th>
                  <th className="px-6 py-3 font-medium">Bulgular</th>
                  <th className="px-6 py-3 font-medium text-center">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                      <div className="flex justify-center">
                        <FaSync className="animate-spin w-5 h-5 mr-2" />
                        Yükleniyor...
                      </div>
                    </td>
                  </tr>
                ) : filteredHistory.length > 0 ? (
                  filteredHistory.map((scan) => (
                    <tr key={scan.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium">{scan.config.name}</td>
                      <td className="px-6 py-4">{scan.config.domainListName}</td>
                      <td className="px-6 py-4">
                        {new Date(scan.startedAt).toLocaleString('tr-TR')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex-1 h-2 mr-2 bg-gray-200 rounded-full">
                            <div
                              className={`h-full rounded-full ${
                                scan.status === 'failed'
                                  ? 'bg-red-500'
                                  : scan.status === 'completed'
                                  ? 'bg-green-500'
                                  : 'bg-blue-500'
                              }`}
                              style={{ 
                                width: `${
                                  scan.progress.totalDomains > 0 
                                    ? Math.min(100, (scan.progress.scannedDomains / scan.progress.totalDomains) * 100)
                                    : 0
                                }%` 
                              }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-500">
                            {scan.progress.scannedDomains}/{scan.progress.totalDomains}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusClass(scan.status)}`}
                        >
                          {getStatusText(scan.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {scan.progress.foundResults > 0 ? (
                          <span className="font-medium text-yellow-600">{scan.progress.foundResults} bulgu</span>
                        ) : (
                          <span className="text-gray-500">Bulgu yok</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center space-x-2">
                          <Link
                            href={`/tarama-gecmisi/${scan.id}`}
                            className="p-2 text-blue-600 rounded-full hover:bg-blue-50"
                            title="Görüntüle"
                          >
                            <FaEye className="w-4 h-4" />
                          </Link>
                          
                          <button
                            onClick={() => handleDeleteScan(scan.id)}
                            className="p-2 text-red-600 rounded-full hover:bg-red-50"
                            title="Sil"
                          >
                            <FaTrash className="w-4 h-4" />
                          </button>
                          
                          {scan.status === 'completed' && scan.progress.foundResults > 0 && (
                            <div className="relative inline-block text-left">
                              <button
                                className="p-2 text-green-600 rounded-full hover:bg-green-50"
                                title="Raporu İndir"
                                onClick={() => {
                                  const dropdown = document.getElementById(`download-options-${scan.id}`);
                                  if (dropdown) {
                                    dropdown.classList.toggle('hidden');
                                  }
                                }}
                              >
                                <FaDownload className="w-4 h-4" />
                              </button>
                              
                              <div 
                                id={`download-options-${scan.id}`}
                                className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none hidden z-10"
                              >
                                <div className="py-1">
                                  <button
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    onClick={async () => {
                                      const dropdown = document.getElementById(`download-options-${scan.id}`);
                                      if (dropdown) {
                                        dropdown.classList.add('hidden');
                                      }
                                      
                                      // Tarama verilerini al
                                      const scanData = await ScanService.getScan(scan.id);
                                      if (!scanData || !scanData.results || scanData.results.length === 0) {
                                        alert('İndirilecek sonuç bulunamadı.');
                                        return;
                                      }
                                      
                                      // TXT formatında indirme
                                      let txt = '';
                                      scanData.results.forEach((result) => {
                                        txt += `URL: ${result.url}\n`;
                                        txt += `Domain: ${result.domain}\n`;
                                        txt += `Path: ${result.path}\n`;
                                        if (result.subdomain) txt += `Subdomain: ${result.subdomain}\n`;
                                        txt += `Bulunan Terimler: ${result.foundTerms.join(', ')}\n`;
                                        txt += `HTTP Kodu: ${result.statusCode}\n`;
                                        txt += `Tarih: ${new Date(result.timestamp).toLocaleString('tr-TR')}\n`;
                                        txt += '----------------------------------------\n\n';
                                      });
                                      
                                      // İndirme işlemi
                                      const success = ScanService.downloadTextAsFile(
                                        txt,
                                        `tarama-sonuclari-${scanData.config.name}-${new Date().toISOString().slice(0,10)}.txt`
                                      );
                                      
                                      if (!success) {
                                        alert('Rapor indirilemedi!');
                                      }
                                    }}
                                  >
                                    Tüm Raporu İndir
                                  </button>
                                  <button
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    onClick={async () => {
                                      const dropdown = document.getElementById(`download-options-${scan.id}`);
                                      if (dropdown) {
                                        dropdown.classList.add('hidden');
                                      }
                                      
                                      // Tarama verilerini al
                                      const scanData = await ScanService.getScan(scan.id);
                                      if (!scanData || !scanData.results || scanData.results.length === 0) {
                                        alert('İndirilecek sonuç bulunamadı.');
                                        return;
                                      }
                                      
                                      // Sadece URL'leri al
                                      const urls = scanData.results.map(result => result.url).join('\n');
                                      
                                      // İndirme işlemi
                                      const success = ScanService.downloadTextAsFile(
                                        urls,
                                        `urls-${scanData.config.name}-${new Date().toISOString().slice(0,10)}.txt`
                                      );
                                      
                                      if (!success) {
                                        try {
                                          await ScanService.copyToClipboard(urls);
                                          alert('URL\'ler indirilemedi ama panoya kopyalandı');
                                        } catch (err) {
                                          alert('URL\'ler indirilemedi ve kopyalanamadı!');
                                        }
                                      }
                                    }}
                                  >
                                    Sadece URL'leri İndir
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                      Sonuç bulunamadı
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
} 