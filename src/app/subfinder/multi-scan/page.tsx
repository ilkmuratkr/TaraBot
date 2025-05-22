'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SubfinderOptions, MultiScanJob } from '@/services/SubfinderService'; // MultiScanJob tipini import ediyorum
import * as SubfinderService from '@/services/SubfinderService'; // Assuming this path is correct
// import styles from '../subfinder.module.css'; // Reusing styles
import Layout from '@/components/Layout'; // Layout bileşenini import et
import Link from 'next/link';
import { FaEye, FaTrash } from 'react-icons/fa';

export default function NewMultiScanPage() {
  const router = useRouter();
  const [scanName, setScanName] = useState('');
  const [domains, setDomains] = useState(''); // Textarea for domain list
  const [options, setOptions] = useState<SubfinderOptions>({
    timeout: 300, // 5 minutes default
    threads: 10,  // Default threads
    onlyActive: false,
    usePermutations: false,
    permutationMode: 'short',
    useRecursive: false,
    deepDnsSearch: false,
    useWaybackMachine: false,
    useAllSources: true, // Default to all sources for better coverage
    // resolvers and other options can be added if needed
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [multiScans, setMultiScans] = useState<MultiScanJob[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Çoklu taramaları yükle
  useEffect(() => {
    const loadMultiScans = async () => {
      setIsLoadingHistory(true);
      try {
        const scans = await SubfinderService.SubfinderService.getAllMultiScans();
        setMultiScans(scans);
      } catch (err) {
        console.error('Çoklu tarama geçmişi yüklenirken hata:', err);
      } finally {
        setIsLoadingHistory(false);
      }
    };
    
    loadMultiScans();
  }, []);
  
  // Helper function to format date strings
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'medium' });
    } catch (e) {
      return 'Geçersiz Tarih';
    }
  };

  // Helper function to get status class
  const getStatusClass = (status: string) => {
    switch (status) {
      case 'running': return 'bg-blue-500 text-white';
      case 'completed': return 'bg-green-500 text-white';
      case 'failed': return 'bg-red-600 text-white';
      case 'paused': return 'bg-yellow-500 text-gray-800';
      case 'stopping': return 'bg-orange-500 text-white';
      case 'pending': return 'bg-gray-400 text-gray-800';
      default: return 'bg-gray-300 text-gray-700';
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setOptions(prev => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
      setOptions(prev => ({ ...prev, [name]: parseInt(value, 10) || 0 }));
    } else {
      setOptions(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleStartMultiScan = async () => {
    if (!scanName.trim()) {
      setError('Lütfen tarama için bir isim girin.');
      return;
    }
    const domainList = domains.split('\n').map(d => d.trim()).filter(d => d.length > 0);
    if (domainList.length === 0) {
      setError('Lütfen taranacak en az bir domain girin.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const newMultiScanJob = await SubfinderService.SubfinderService.startMultiScan(scanName, domainList, options);
      router.push(`/subfinder/multi-scan/${newMultiScanJob.id}`);
    } catch (err: any) {
      console.error('Çoklu tarama başlatılırken hata:', err);
      setError(err.message || 'Tarama başlatılamadı.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDeleteMultiScan = async (id: string) => {
    if (!confirm('Bu çoklu taramayı silmek istediğinizden emin misiniz?')) return;
    
    try {
      await SubfinderService.SubfinderService.deleteMultiScan(id);
      // Silme işlemi başarılı olduysa, listeden kaldır
      setMultiScans(prev => prev.filter(scan => scan.id !== id));
    } catch (err) {
      console.error('Çoklu tarama silinirken hata:', err);
      alert('Tarama silinirken bir hata oluştu');
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">Çoklu SubFinder Taramaları</h1>
        </div>
        
        {/* Geçmiş Çoklu Taramalar */}
        <div className="bg-white shadow-xl rounded-lg p-6 md:p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">Çoklu Tarama Geçmişi</h2>
          
          {isLoadingHistory ? (
            <p className="text-center py-6 text-gray-500">Tarama geçmişi yükleniyor...</p>
          ) : multiScans.length === 0 ? (
            <p className="text-center py-6 text-gray-500">Henüz bir çoklu tarama gerçekleştirilmemiş.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarama Adı</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domain Sayısı</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bulunan Alt Domain</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Başlangıç</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Son Güncelleme</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {multiScans.map((scan) => (
                    <tr key={scan.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <Link href={`/subfinder/multi-scan/${scan.id}`} className="hover:text-blue-600 hover:underline">
                          {scan.name}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusClass(scan.status)}`}>
                          {scan.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {scan.domains?.length || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {scan.totalSubdomainsFound || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(scan.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(scan.updatedAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 flex justify-center space-x-2">
                        <Link href={`/subfinder/multi-scan/${scan.id}`} 
                              className="text-blue-600 hover:text-blue-800 p-1">
                          <FaEye title="Detaylar" />
                        </Link>
                        <button onClick={() => handleDeleteMultiScan(scan.id)} 
                                className="text-red-600 hover:text-red-800 p-1">
                          <FaTrash title="Sil" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Yeni Çoklu SubFinder Taraması</h1>
        
        {error && <p className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{error}</p>}

        <div className="bg-white shadow-xl rounded-lg p-6 md:p-8">
          <div className="mb-6">
            <label htmlFor="scanName" className="block text-gray-700 text-sm font-semibold mb-2">Tarama Adı:</label>
            <input
              type="text"
              id="scanName"
              name="scanName"
              className="shadow-sm appearance-none border rounded w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={scanName}
              onChange={(e) => setScanName(e.target.value)}
              placeholder="Örn: Proje X Domainleri Mart Ayı Taraması"
              disabled={isLoading}
            />
          </div>

          <div className="mb-6">
            <label htmlFor="domains" className="block text-gray-700 text-sm font-semibold mb-2">Domain Listesi (Her satıra bir domain):</label>
            <textarea
              id="domains"
              name="domains"
              className="shadow-sm appearance-none border rounded w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent h-40"
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
              placeholder="example.com\nsub.example.org\nanotherdomain.net"
              rows={10}
              disabled={isLoading}
            />
          </div>

          <h2 className="text-2xl font-semibold text-gray-700 mb-4 mt-8 border-t pt-6">Tarama Seçenekleri</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label htmlFor="timeout" className="block text-gray-700 text-sm font-semibold mb-2">Zaman Aşımı (saniye):</label>
              <input
                type="number"
                id="timeout"
                name="timeout"
                className="shadow-sm appearance-none border rounded w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={options.timeout}
                onChange={handleInputChange}
                disabled={isLoading}
                min="10"
              />
            </div>
            <div>
              <label htmlFor="threads" className="block text-gray-700 text-sm font-semibold mb-2">Thread Sayısı:</label>
              <input
                type="number"
                id="threads"
                name="threads"
                className="shadow-sm appearance-none border rounded w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={options.threads}
                onChange={handleInputChange}
                disabled={isLoading}
                min="1"
                max="100"
              />
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <div className="flex items-center p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors duration-150">
              <input
                type="checkbox"
                id="useAllSources"
                name="useAllSources"
                className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                checked={options.useAllSources}
                onChange={handleInputChange}
                disabled={isLoading}
              />
              <label htmlFor="useAllSources" className="ml-3 block text-sm font-medium text-gray-800 cursor-pointer">
                Tüm Kaynakları Kullan (Önerilen)
                <span className="block text-xs text-gray-500">Daha kapsamlı sonuçlar için tüm SubFinder kaynaklarını aktif eder.</span>
              </label>
            </div>
            
            <div className="flex items-center p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors duration-150">
              <input
                type="checkbox"
                id="onlyActive"
                name="onlyActive"
                className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                checked={options.onlyActive}
                onChange={handleInputChange}
                disabled={isLoading}
              />
              <label htmlFor="onlyActive" className="ml-3 block text-sm font-medium text-gray-800 cursor-pointer">
                Sadece Aktif Subdomainleri Göster
                <span className="block text-xs text-gray-500">Yalnızca çözümlenebilen (aktif) alt alan adlarını listeler.</span>
              </label>
            </div>

            <div className="p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors duration-150">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="usePermutations"
                  name="usePermutations"
                  className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                  checked={options.usePermutations}
                  onChange={handleInputChange}
                  disabled={isLoading}
                />
                <label htmlFor="usePermutations" className="ml-3 block text-sm font-medium text-gray-800 cursor-pointer">
                  Permütasyon Tabanlı Keşif
                  <span className="block text-xs text-gray-500">Kelime listesi kullanarak olası alt alan adlarını tahmin eder.</span>
                </label>
              </div>
              {options.usePermutations && (
                <div className="mt-3 ml-8 pl-4 border-l-2 border-blue-200">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Permütasyon Modu:</label>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <input 
                        type="radio" 
                        id="permutationModeShort" 
                        name="permutationMode" 
                        value="short" 
                        className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                        checked={options.permutationMode === 'short'} 
                        onChange={handleInputChange} 
                        disabled={isLoading}
                      />
                      <label htmlFor="permutationModeShort" className="ml-2 text-sm text-gray-700 cursor-pointer">Hızlı (Önerilen)</label>
                    </div>
                    <div className="flex items-center">
                      <input 
                        type="radio" 
                        id="permutationModeFull" 
                        name="permutationMode" 
                        value="full" 
                        className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                        checked={options.permutationMode === 'full'} 
                        onChange={handleInputChange} 
                        disabled={isLoading}
                      />
                      <label htmlFor="permutationModeFull" className="ml-2 text-sm text-gray-700 cursor-pointer">Detaylı (Daha Kapsamlı, Yavaş)</label>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors duration-150">
              <input
                type="checkbox"
                id="deepDnsSearch"
                name="deepDnsSearch"
                className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                checked={options.deepDnsSearch}
                onChange={handleInputChange}
                disabled={isLoading}
              />
              <label htmlFor="deepDnsSearch" className="ml-3 block text-sm font-medium text-gray-800 cursor-pointer">
                Derinlemesine DNS Kayıtlarını Ara
                <span className="block text-xs text-gray-500">CNAME ve diğer DNS kayıtlarını takip ederek daha fazla sonuç bulmaya çalışır.</span>
              </label>
            </div>

            <div className="flex items-center p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors duration-150">
              <input
                type="checkbox"
                id="useWaybackMachine"
                name="useWaybackMachine"
                className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                checked={options.useWaybackMachine}
                onChange={handleInputChange}
                disabled={isLoading}
              />
              <label htmlFor="useWaybackMachine" className="ml-3 block text-sm font-medium text-gray-800 cursor-pointer">
                Wayback Machine Arşivlerini Kullan
                <span className="block text-xs text-gray-500">Internet Archive Wayback Machine üzerinden geçmiş verileri tarar.</span>
              </label>
            </div>
          </div>

          <button 
            onClick={handleStartMultiScan} 
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-300 transition-all duration-150 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed" 
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Tarama Başlatılıyor...
              </div>
            ) : 'Çoklu Taramayı Başlat'}
          </button>
        </div>
      </div>
    </Layout>
  );
} 