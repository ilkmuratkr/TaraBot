'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { FaPlus, FaSearch, FaList, FaChartBar, FaSync } from 'react-icons/fa';
import { ScanService } from '@/services/ScanService';
import { Scan } from '@/models/Scan';

export default function Home() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchScans = async () => {
    setIsLoading(true);
    try {
      const allScans = await ScanService.getAllScans();
      setScans(allScans);
    } catch (error) {
      console.error('Taramalar yüklenirken hata oluştu:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchScans();
    
    // Her 30 saniyede bir yenile (devam eden taramalar için)
    const interval = setInterval(() => {
      fetchScans();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

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

  // Son 5 taramayı göster
  const recentScans = scans.slice(0, 5);
  
  // Aktif (devam eden) taramaları filtreleme
  const activeScans = scans.filter(scan => 
    scan.status === 'running' || scan.status === 'pending' || scan.status === 'paused'
  ).slice(0, 5);

  return (
    <Layout>
      <div className="flex flex-col space-y-8">
        <div className="max-w-4xl">
          <h1 className="text-3xl font-bold text-gray-800">Hoş Geldiniz</h1>
          <p className="mt-2 text-gray-600">
            TaraBot ile domain listelerini yönetin, tarama görevleri oluşturun ve sonuçları analiz edin.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Link 
            href="/domain-listeleri/ekle" 
            className="flex flex-col items-center p-6 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-center w-12 h-12 mb-4 text-white bg-primary-600 rounded-full">
              <FaPlus />
            </div>
            <h2 className="mb-2 text-lg font-medium text-gray-800">Domain Listesi Ekle</h2>
            <p className="text-sm text-center text-gray-600">
              Manuel veya dosyadan yeni domain listeleri oluşturun
            </p>
          </Link>

          <Link 
            href="/yeni-tarama" 
            className="flex flex-col items-center p-6 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-center w-12 h-12 mb-4 text-white bg-primary-600 rounded-full">
              <FaSearch />
            </div>
            <h2 className="mb-2 text-lg font-medium text-gray-800">Yeni Tarama Başlat</h2>
            <p className="text-sm text-center text-gray-600">
              Domain listeleri için yeni tarama görevleri oluşturun
            </p>
          </Link>

          <Link 
            href="/domain-listeleri" 
            className="flex flex-col items-center p-6 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-center w-12 h-12 mb-4 text-white bg-primary-600 rounded-full">
              <FaList />
            </div>
            <h2 className="mb-2 text-lg font-medium text-gray-800">Domain Listeleri</h2>
            <p className="text-sm text-center text-gray-600">
              Mevcut domain listelerinizi görüntüleyin ve yönetin
            </p>
          </Link>

          <Link 
            href="/tarama-gecmisi" 
            className="flex flex-col items-center p-6 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-center w-12 h-12 mb-4 text-white bg-primary-600 rounded-full">
              <FaChartBar />
            </div>
            <h2 className="mb-2 text-lg font-medium text-gray-800">Tarama Sonuçları</h2>
            <p className="text-sm text-center text-gray-600">
              Tamamlanan taramaların sonuçlarını görüntüleyin
            </p>
          </Link>
        </div>

        {/* Aktif Taramalar */}
        {activeScans.length > 0 && (
          <div className="p-6 bg-white rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-medium text-gray-800">Devam Eden Taramalar</h2>
              <button 
                className="flex items-center gap-2 text-primary-600 hover:text-primary-800"
                onClick={fetchScans}
                disabled={isLoading}
              >
                <FaSync className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Yenile</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left bg-gray-50">
                    <th className="px-4 py-3 font-medium">Tarama Adı</th>
                    <th className="px-4 py-3 font-medium">Domain Listesi</th>
                    <th className="px-4 py-3 font-medium">Başlangıç</th>
                    <th className="px-4 py-3 font-medium">İlerleme</th>
                    <th className="px-4 py-3 font-medium">Durum</th>
                    <th className="px-4 py-3 font-medium">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-3 text-center text-gray-500">
                        <div className="flex justify-center items-center">
                          <FaSync className="animate-spin w-5 h-5 mr-2" />
                          Yükleniyor...
                        </div>
                      </td>
                    </tr>
                  ) : activeScans.length > 0 ? (
                    activeScans.map((scan) => (
                      <tr key={scan.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{scan.config.name}</td>
                        <td className="px-4 py-3">{scan.config.domainListName}</td>
                        <td className="px-4 py-3">{new Date(scan.startedAt).toLocaleString('tr-TR')}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            <div className="flex-1 h-2 mr-2 bg-gray-200 rounded-full">
                              <div
                                className="h-full bg-blue-500 rounded-full"
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
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusClass(scan.status)}`}>
                            {getStatusText(scan.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/tarama-gecmisi/${scan.id}`} className="text-primary-600 hover:text-primary-800">
                            Görüntüle
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-3 text-center text-gray-500">
                        Devam eden tarama bulunmuyor
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Son Taramalar */}
        <div className="p-6 bg-white rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-medium text-gray-800">Son Taramalar</h2>
            {!activeScans.length && (
              <button 
                className="flex items-center gap-2 text-primary-600 hover:text-primary-800"
                onClick={fetchScans}
                disabled={isLoading}
              >
                <FaSync className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Yenile</span>
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left bg-gray-50">
                  <th className="px-4 py-3 font-medium">Tarama Adı</th>
                  <th className="px-4 py-3 font-medium">Domain Listesi</th>
                  <th className="px-4 py-3 font-medium">Başlangıç</th>
                  <th className="px-4 py-3 font-medium">Durum</th>
                  <th className="px-4 py-3 font-medium">Bulgular</th>
                  <th className="px-4 py-3 font-medium">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-3 text-center text-gray-500">
                      <div className="flex justify-center items-center">
                        <FaSync className="animate-spin w-5 h-5 mr-2" />
                        Yükleniyor...
                      </div>
                    </td>
                  </tr>
                ) : recentScans.length > 0 ? (
                  recentScans.map((scan) => (
                    <tr key={scan.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{scan.config.name}</td>
                      <td className="px-4 py-3">{scan.config.domainListName}</td>
                      <td className="px-4 py-3">{new Date(scan.startedAt).toLocaleString('tr-TR')}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusClass(scan.status)}`}>
                          {getStatusText(scan.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {scan.progress.foundResults > 0 ? (
                          <span className="font-medium text-yellow-600">{scan.progress.foundResults} bulgu</span>
                        ) : (
                          <span className="text-gray-500">Bulgu yok</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/tarama-gecmisi/${scan.id}`} className="text-primary-600 hover:text-primary-800">
                          Görüntüle
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-3 text-center text-gray-500">
                      Henüz tarama yapılmamış
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {recentScans.length > 0 && (
            <div className="mt-4 text-right">
              <Link href="/tarama-gecmisi" className="text-primary-600 hover:text-primary-800">
                Tüm tarama geçmişini görüntüle →
              </Link>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
} 