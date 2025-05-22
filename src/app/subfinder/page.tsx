'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { FaSearch, FaDownload, FaEye, FaTrash, FaSync, FaStop, FaPlay, FaListOl } from 'react-icons/fa';
import { SubfinderService, SubfinderScan, SubfinderOptions } from '@/services/SubfinderService';
import { useRouter } from 'next/navigation';

export default function SubfinderPage() {
  const router = useRouter();
  const [scans, setScans] = useState<SubfinderScan[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [domain, setDomain] = useState<string>('');
  const [showNewScanForm, setShowNewScanForm] = useState<boolean>(false);
  
  // Tarama ayarları
  const [timeout, setTimeout] = useState<number>(30);
  const [threads, setThreads] = useState<number>(10);
  const [onlyActive, setOnlyActive] = useState<boolean>(true);
  const [resolvers, setResolvers] = useState<string>('1.1.1.1,8.8.8.8');
  const [usePermutations, setUsePermutations] = useState<boolean>(false);
  const [useRecursive, setUseRecursive] = useState<boolean>(false);
  const [deepDnsSearch, setDeepDnsSearch] = useState<boolean>(false);
  const [useWaybackMachine, setUseWaybackMachine] = useState<boolean>(false);
  const [permutationMode, setPermutationMode] = useState<'short' | 'full'>('short'); // Varsayılan kısa mod
  
  // Form hataları
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  useEffect(() => {
    loadScans();
  }, []);

  const loadScans = async () => {
    setIsLoading(true);
    try {
      const data = await SubfinderService.getAllScans();
      // Taramaları tarihe göre ters sırala (en yeni en üstte)
      const sortedData = data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setScans(sortedData);
    } catch (error) {
      console.error('SubFinder taramaları yüklenirken hata oluştu:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewScan = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Form doğrulama
    const newErrors: {[key: string]: string} = {};
    if (!domain) {
      newErrors.domain = 'Domain adı zorunludur';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    setErrors({});
    setIsLoading(true);
    
    try {
      const options: SubfinderOptions = {
        timeout,
        threads,
        onlyActive,
        resolvers: resolvers ? resolvers.split(',').map(r => r.trim()) : undefined,
        usePermutations,
        useRecursive,
        deepDnsSearch,
        useWaybackMachine,
        permutationMode: usePermutations ? permutationMode : undefined // Sadece permütasyon açıksa gönder
      };
      
      // Yeni tarama oluştur
      const newScan = await SubfinderService.createScan(domain, options);
      
      // Taramayı hemen başlat
      await SubfinderService.startScan(newScan.id);

      // Detay sayfasına yönlendir
      router.push(`/subfinder/${newScan.id}`);
      
      // Formu sıfırla
      setDomain('');
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
        await SubfinderService.startScan(id);
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
        await SubfinderService.stopScan(id);
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
        await SubfinderService.deleteScan(id);
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
          <h1 className="text-2xl font-bold text-gray-800">SubFinder Alt Alan Adı Taraması</h1>
          <div className="flex space-x-2">
            <button
              className="btn-primary flex items-center"
              onClick={() => setShowNewScanForm(!showNewScanForm)}
            >
              <FaSearch className="mr-2" />
              Yeni Tarama
            </button>
            <button
              className="btn-primary flex items-center"
              onClick={() => router.push('/subfinder/multi-scan')}
            >
              <FaListOl className="mr-2" />
              Çoklu Tarama
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
              <h2 className="text-lg font-semibold mb-4">Yeni SubFinder Taraması</h2>
              <form onSubmit={handleNewScan}>
                <div className="mb-4">
                  <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
                  <input
                    type="text"
                    id="domain"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="example.com"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label htmlFor="timeout" className="block text-sm font-medium text-gray-700 mb-1">Timeout (saniye)</label>
                    <input
                      type="number"
                      id="timeout"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={timeout}
                      onChange={(e) => setTimeout(parseInt(e.target.value))}
                      min={1}
                      max={120}
                    />
                  </div>
                  <div>
                    <label htmlFor="threads" className="block text-sm font-medium text-gray-700 mb-1">Thread Sayısı</label>
                    <input
                      type="number"
                      id="threads"
                      name="threads"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={threads}
                      onChange={(e) => setThreads(parseInt(e.target.value))}
                      min={1}
                      max={50}
                    />
                  </div>
                </div>
                
                <div className="mb-4 grid grid-cols-2 gap-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="onlyActive"
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      checked={onlyActive}
                      onChange={(e) => setOnlyActive(e.target.checked)}
                    />
                    <label htmlFor="onlyActive" className="ml-2 text-sm text-gray-700">Sadece Aktif Subdomainler</label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="usePermutations"
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      checked={usePermutations}
                      onChange={(e) => setUsePermutations(e.target.checked)}
                    />
                    <label htmlFor="usePermutations" className="ml-2 text-sm text-gray-700">Permütasyon Tabanlı Keşif</label>
                  </div>
                </div>
                
                {usePermutations && (
                  <div className="ml-6 mt-2 space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="permutationMode"
                        value="short"
                        checked={permutationMode === 'short'}
                        onChange={() => setPermutationMode('short')}
                        className="form-radio h-4 w-4 text-blue-600 transition duration-150 ease-in-out"
                      />
                      <span className="ml-2 text-sm text-gray-700">Hızlı (Önerilen: İlk 30 ön ek)</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="permutationMode"
                        value="full"
                        checked={permutationMode === 'full'}
                        onChange={() => setPermutationMode('full')}
                        className="form-radio h-4 w-4 text-blue-600 transition duration-150 ease-in-out"
                      />
                      <span className="ml-2 text-sm text-gray-700">Detaylı (Daha Kapsamlı: Tüm ~90 ön ek)</span>
                    </label>
                  </div>
                )}
                
                <div className="mb-4 grid grid-cols-2 gap-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="useRecursive"
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      checked={useRecursive}
                      onChange={(e) => setUseRecursive(e.target.checked)}
                    />
                    <label htmlFor="useRecursive" className="ml-2 text-sm text-gray-700">Özyinelemeli Tarama</label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="deepDnsSearch"
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      checked={deepDnsSearch}
                      onChange={(e) => setDeepDnsSearch(e.target.checked)}
                    />
                    <label htmlFor="deepDnsSearch" className="ml-2 text-sm text-gray-700">Derinlemesine DNS Araştırması</label>
                  </div>
                </div>
                
                <div className="mb-4 grid grid-cols-2 gap-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="useWaybackMachine"
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      checked={useWaybackMachine}
                      onChange={(e) => setUseWaybackMachine(e.target.checked)}
                    />
                    <label htmlFor="useWaybackMachine" className="ml-2 text-sm text-gray-700">Wayback Machine Kullan</label>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    onClick={() => setShowNewScanForm(false)}
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                  >
                    Tara
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Domain
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tarih
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Durum
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sonuç
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      Taramalar yükleniyor...
                    </td>
                  </tr>
                ) : scans.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      Henüz hiç tarama yapılmamış. Yeni bir tarama başlatmak için "Yeni Tarama" butonuna tıklayın.
                    </td>
                  </tr>
                ) : (
                  scans.map((scan) => (
                    <tr key={scan.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{scan.domain}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{formatDate(scan.createdAt)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(scan.status)}`}>
                          {getStatusText(scan.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {scan.result ? scan.result.length : '-'} sonuç
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          {scan.status === 'pending' || scan.status === 'failed' || scan.status === 'stopped' ? (
                            <button
                              onClick={() => handleStartScan(scan.id)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Taramayı Başlat"
                            >
                              <FaPlay />
                            </button>
                          ) : scan.status === 'running' ? (
                            <button
                              onClick={() => handleStopScan(scan.id)}
                              className="text-yellow-600 hover:text-yellow-900"
                              title="Taramayı Durdur"
                            >
                              <FaStop />
                            </button>
                          ) : null}
                          
                          {scan.status === 'completed' && (
                            <Link href={`/subfinder/${scan.id}`} className="text-green-600 hover:text-green-900" title="Sonuçları Görüntüle">
                              <FaEye />
                            </Link>
                          )}
                          
                          <button
                            onClick={() => handleDeleteScan(scan.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Taramayı Sil"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
} 