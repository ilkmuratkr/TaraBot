'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { FaSearch, FaDownload, FaEye, FaTrash, FaSync, FaStop, FaPlay } from 'react-icons/fa';
import { ReverseIPService, ReverseIPScan } from '@/services/ReverseIPService';
import { useRouter } from 'next/navigation';

export default function ReverseIPPage() {
  const router = useRouter();
  const [scans, setScans] = useState<ReverseIPScan[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [ip, setIp] = useState<string>('');
  const [showNewScanForm, setShowNewScanForm] = useState<boolean>(false);
  
  // Form hataları
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  useEffect(() => {
    loadScans();
  }, []);

  const loadScans = async () => {
    setIsLoading(true);
    try {
      const data = await ReverseIPService.getAllScans();
      // Taramaları tarihe göre ters sırala (en yeni en üstte)
      const sortedData = data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setScans(sortedData);
    } catch (error) {
      console.error('Reverse IP taramaları yüklenirken hata oluştu:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewScan = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Form doğrulama
    const newErrors: {[key: string]: string} = {};
    if (!ip) {
      newErrors.ip = 'IP adresi zorunludur';
    } else {
      // IP adresi formatını kontrol et
      const ipPattern = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipPattern.test(ip)) {
        newErrors.ip = 'Geçerli bir IP adresi giriniz (örn: 8.8.8.8)';
      }
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    setErrors({});
    setIsLoading(true);
    
    try {
      // Yeni tarama oluştur
      const newScan = await ReverseIPService.createScan(ip);
      
      // Taramayı hemen başlat
      await ReverseIPService.startScan(newScan.id);

      // Detay sayfasına yönlendir
      router.push(`/reverseip/${newScan.id}`);
      
      // Formu sıfırla
      setIp('');
      setShowNewScanForm(false);
      
      // Taramaları yeniden yükle
      await loadScans();
    } catch (error) {
      console.error('Tarama oluşturulurken hata:', error);
      setErrors({ submit: 'Tarama oluşturulurken bir hata oluştu.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartScan = async (id: string) => {
    if (confirm('Taramayı başlatmak istediğinize emin misiniz?')) {
      setIsLoading(true);
      try {
        await ReverseIPService.startScan(id);
        await loadScans();
      } catch (error) {
        console.error('Tarama başlatılırken hata:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleStopScan = async (id: string) => {
    if (confirm('Taramayı durdurmak istediğinize emin misiniz?')) {
      setIsLoading(true);
      try {
        await ReverseIPService.stopScan(id);
        await loadScans();
      } catch (error) {
        console.error('Tarama durdurulurken hata:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleDeleteScan = async (id: string) => {
    if (confirm('Bu taramayı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) {
      setIsLoading(true);
      try {
        await ReverseIPService.deleteScan(id);
        setScans(scans.filter(scan => scan.id !== id));
      } catch (error) {
        console.error('Tarama silinirken hata:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('tr-TR');
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'stopped':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'running':
        return 'Çalışıyor';
      case 'completed':
        return 'Tamamlandı';
      case 'failed':
        return 'Başarısız';
      case 'stopped':
        return 'Durduruldu';
      case 'pending':
        return 'Bekliyor';
      default:
        return status;
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Reverse IP Lookup</h1>
          <div className="flex space-x-2">
            <button
              className="btn-primary flex items-center"
              onClick={() => setShowNewScanForm(!showNewScanForm)}
            >
              <FaSearch className="mr-2" />
              Yeni Tarama
            </button>
            <button
              className="btn-secondary flex items-center"
              onClick={loadScans}
              disabled={isLoading}
            >
              <FaSync className={`mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Yenile
            </button>
          </div>
        </div>
        
        {showNewScanForm && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
              <h2 className="text-lg font-semibold mb-4">Yeni Reverse IP Taraması</h2>
              <form onSubmit={handleNewScan}>
                <div className="mb-4">
                  <label htmlFor="ip" className="block text-sm font-medium text-gray-700 mb-1">IP Adresi</label>
                  <input
                    type="text"
                    id="ip"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="8.8.8.8"
                    value={ip}
                    onChange={(e) => setIp(e.target.value)}
                    required
                  />
                  {errors.ip && <p className="mt-1 text-sm text-red-600">{errors.ip}</p>}
                </div>
                
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    onClick={() => setShowNewScanForm(false)}
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    disabled={isLoading}
                  >
                    {isLoading ? 'İşleniyor...' : 'Taramayı Başlat'}
                  </button>
                </div>
                {errors.submit && <p className="mt-2 text-sm text-red-600">{errors.submit}</p>}
              </form>
            </div>
          </div>
        )}
        
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-medium text-gray-800">Tarama Geçmişi</h2>
          </div>
          
          {isLoading && (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              <p className="mt-2 text-gray-500">Yükleniyor...</p>
            </div>
          )}
          
          {!isLoading && scans.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-gray-500">Henüz bir tarama yapılmamış.</p>
            </div>
          )}
          
          {!isLoading && scans.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Adresi</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domain Sayısı</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarih</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {scans.map((scan) => (
                    <tr key={scan.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{scan.ip}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(scan.status)}`}>
                          {getStatusText(scan.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{scan.count}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(scan.createdAt)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          {scan.status === 'completed' && (
                            <Link
                              href={`/reverseip/${scan.id}`}
                              className="text-indigo-600 hover:text-indigo-900"
                              title="Görüntüle"
                            >
                              <FaEye />
                            </Link>
                          )}
                          
                          {(scan.status === 'pending' || scan.status === 'failed' || scan.status === 'stopped') && (
                            <button
                              onClick={() => handleStartScan(scan.id)}
                              className="text-green-600 hover:text-green-900"
                              title="Başlat"
                            >
                              <FaPlay />
                            </button>
                          )}
                          
                          {scan.status === 'running' && (
                            <button
                              onClick={() => handleStopScan(scan.id)}
                              className="text-yellow-600 hover:text-yellow-900"
                              title="Durdur"
                            >
                              <FaStop />
                            </button>
                          )}
                          
                          <button
                            onClick={() => handleDeleteScan(scan.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Sil"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
} 