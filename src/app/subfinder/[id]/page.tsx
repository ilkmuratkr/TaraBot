'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { FaArrowLeft, FaDownload, FaSync, FaTrash, FaStop, FaPlay, FaSearch, FaCopy, FaExternalLinkAlt, FaClipboard } from 'react-icons/fa';
import { SubfinderService, SubfinderScan, SubfinderResult } from '@/services/SubfinderService';

export default function SubfinderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [scan, setScan] = useState<SubfinderScan | null>(null);
  const [results, setResults] = useState<SubfinderResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [resultsPerPage] = useState<number>(100);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [showListView, setShowListView] = useState<boolean>(false);
  const [copiedHost, setCopiedHost] = useState<string | null>(null);

  useEffect(() => {
    loadScan();
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, []);
  
  useEffect(() => {
    if (scan?.status === 'running' && !refreshInterval) {
      const interval = setInterval(() => {
        loadScan();
      }, 2000);
      setRefreshInterval(interval);
    } else if (scan?.status !== 'running' && refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [scan?.status]);

  const loadScan = async () => {
    console.log('loadScan çağrıldı');
    setIsLoading(true);
    try {
      const scanId = params.id as string;
      console.log('Tarama ID:', scanId);
      
      const scanData = await SubfinderService.getScan(scanId);
      console.log('Alınan scanData:', scanData);
      
      if (!scanData) {
        console.error('Tarama bulunamadı, ana sayfaya yönlendiriliyor.');
        alert('Tarama bulunamadı veya yüklenirken bir sorun oluştu.');
        router.push('/subfinder');
        return;
      }
      
      setScan(scanData);
      await loadResults();
    } catch (error) {
      console.error('loadScan içinde kritik hata:', error);
      alert('Tarama detayları yüklenirken kritik bir hata oluştu. Lütfen konsolu kontrol edin.');
    } finally {
      setIsLoading(false);
      console.log('loadScan tamamlandı');
    }
  };

  const loadResults = async () => {
    try {
      const scanId = params.id as string;
      const resultsData = await SubfinderService.getScanResults(scanId, currentPage, resultsPerPage);
      setResults(resultsData);
    } catch (error) {
      console.error('Tarama sonuçları yüklenirken hata:', error);
    }
  };

  const handleStartScan = async () => {
    if (!scan) return;
    if (confirm('Taramayı başlatmak istediğinize emin misiniz?')) {
      setIsLoading(true);
      try {
        await SubfinderService.startScan(scan.id);
        await loadScan();
      } catch (error) {
        console.error('Tarama başlatılırken hata:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleStopScan = async () => {
    if (!scan) return;
    if (confirm('Taramayı durdurmak istediğinize emin misiniz?')) {
      setIsLoading(true);
      try {
        await SubfinderService.stopScan(scan.id);
        await loadScan();
      } catch (error) {
        console.error('Tarama durdurulurken hata:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleDeleteScan = async () => {
    if (!scan) return;
    if (confirm('Bu taramayı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) {
      setIsLoading(true);
      try {
        await SubfinderService.deleteScan(scan.id);
        router.push('/subfinder');
      } catch (error) {
        console.error('Tarama silinirken hata:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleDownload = () => {
    if (!results.length) return;
    const headers = ['host', 'ip', 'sources'];
    const csvContent = [
      headers.join(','),
      ...results.map(result => [
        result.host,
        result.ip || '',
        result.source ? (Array.isArray(result.source) ? result.source.join('|') : String(result.source)) : ''
      ].join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `subfinder_${scan?.domain}_results.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  const filteredResults = results
    .filter(result => {
      if (!searchQuery) return true;
      return result.host.toLowerCase().includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => {
      if (sortOrder === 'asc') {
        return a.host.localeCompare(b.host);
      } else {
        return b.host.localeCompare(a.host);
      }
    });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopiedHost(text);
        setTimeout(() => setCopiedHost(null), 2000);
      })
      .catch(err => {
        console.error('Panoya kopyalama hatası:', err);
      });
  };

  const copyAllToClipboard = () => {
    if (!filteredResults.length) return;
    
    const hostsText = filteredResults.map(result => result.host).join('\n');
    navigator.clipboard.writeText(hostsText)
      .then(() => {
        setCopiedHost('Tüm subdomainler');
        setTimeout(() => setCopiedHost(null), 2000);
      })
      .catch(err => {
        console.error('Panoya kopyalama hatası:', err);
      });
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {isLoading && !scan && (
          <div className="text-center py-10">
            <FaSync className="animate-spin text-4xl text-primary-600 mx-auto" />
            <p className="mt-2 text-lg">Tarama detayları yükleniyor...</p>
          </div>
        )}

        {!isLoading && !scan && (
          <div className="text-center py-10">
            <p className="text-xl text-red-600">Tarama bilgileri yüklenemedi.</p>
            <Link href="/subfinder" className="text-primary-600 hover:text-primary-800 mt-4 inline-block">
              <FaArrowLeft className="inline mr-2" />
              SubFinder Taramalarına Geri Dön
            </Link>
          </div>
        )}

        {scan && (
          <>
            {/* Üst Bilgi ve Butonlar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
              <div className="flex items-center mb-4 md:mb-0">
                <Link href="/subfinder" className="text-primary-600 hover:text-primary-800 mr-4">
                  <FaArrowLeft className="inline mr-2" />
                  Geri
                </Link>
                <h1 className="text-2xl font-bold text-gray-800">
                  {scan ? `SubFinder - ${scan.domain}` : 'Tarama Detayları'}
                </h1>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {scan?.status === 'pending' || scan?.status === 'failed' || scan?.status === 'stopped' ? (
                  <button
                    onClick={handleStartScan}
                    className="btn-primary flex items-center"
                    disabled={isLoading}
                  >
                    <FaPlay className="mr-2" />
                    Başlat
                  </button>
                ) : scan?.status === 'running' ? (
                  <button
                    onClick={handleStopScan}
                    className="btn-warning flex items-center"
                    disabled={isLoading}
                  >
                    <FaStop className="mr-2" />
                    Durdur
                  </button>
                ) : null}
                
                <button
                  onClick={loadScan}
                  className="btn-secondary flex items-center"
                  disabled={isLoading}
                >
                  <FaSync className="mr-2" />
                  Yenile
                </button>
                <button
                  onClick={handleDownload}
                  className="btn-success flex items-center"
                  disabled={!results.length || isLoading}
                >
                  <FaDownload className="mr-2" />
                  İndir (CSV)
                </button>
                <button
                  onClick={handleDeleteScan}
                  className="btn-danger flex items-center"
                  disabled={isLoading}
                >
                  <FaTrash className="mr-2" />
                  Sil
                </button>
              </div>
            </div>

            {/* Tarama Bilgileri */}
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-700 mb-4">Tarama Bilgileri</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">ID</p>
                  <p className="text-gray-800 break-all">{scan.id}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Domain</p>
                  <p className="text-gray-800">{scan.domain}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Durum</p>
                  <p className={`px-2 py-1 text-xs font-semibold leading-tight rounded-full ${getStatusClass(scan.status)}`}>
                    {getStatusText(scan.status)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Oluşturulma Tarihi</p>
                  <p className="text-gray-800">{formatDate(scan.createdAt)}</p>
                </div>
                {scan.error && (
                  <div className="md:col-span-2">
                    <p className="text-sm font-medium text-gray-500">Hata</p>
                    <p className="text-red-600 bg-red-50 p-2 rounded break-all">{scan.error}</p>
                  </div>
                )}
              </div>
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer text-primary-600 hover:text-primary-700">Tarama Seçenekleri</summary>
                <pre className="mt-2 p-3 bg-gray-50 rounded text-xs overflow-auto">
                  {JSON.stringify(scan.options, null, 2)}
                </pre>
              </details>
            </div>

            {/* Sonuçlar */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-700 mb-3 md:mb-0">Sonuçlar ({filteredResults.length})</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center space-x-2">
                    <button 
                      className={`px-3 py-1 text-sm rounded-md ${!showListView ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}
                      onClick={() => setShowListView(false)}
                    >
                      Tablo Görünümü
                    </button>
                    <button 
                      className={`px-3 py-1 text-sm rounded-md ${showListView ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}
                      onClick={() => setShowListView(true)}
                    >
                      Liste Görünümü
                    </button>
                  </div>
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="Ara..." 
                      value={searchQuery} 
                      onChange={(e) => setSearchQuery(e.target.value)} 
                      className="border border-gray-300 rounded-md pl-3 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute right-3 top-2.5 text-gray-400">
                      <FaSearch />
                    </span>
                  </div>
                  <select 
                    value={sortOrder} 
                    onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')} 
                    className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="asc">A-Z</option>
                    <option value="desc">Z-A</option>
                  </select>
                </div>
              </div>

              {isLoading && results.length === 0 && (
                <div className="text-center py-6">
                  <FaSync className="animate-spin text-3xl text-primary-500 mx-auto" />
                  <p className="mt-1">Sonuçlar yükleniyor...</p>
                </div>
              )}

              {!isLoading && !filteredResults.length && (
                <p className="text-gray-600">Henüz sonuç bulunamadı veya aramanızla eşleşen sonuç yok.</p>
              )}

              {filteredResults.length > 0 && !showListView && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Host</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kaynaklar</th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredResults.map((result, index) => (
                        <tr key={`${result.host}-${index}`}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 break-all">{result.host}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{result.ip || 'N/A'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 break-all">
                            {result.source 
                              ? (Array.isArray(result.source) 
                                ? result.source.join(', ') 
                                : String(result.source))
                              : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end space-x-3">
                              <button
                                onClick={() => copyToClipboard(result.host)}
                                className="text-gray-600 hover:text-gray-900"
                                title="Panoya kopyala"
                              >
                                <FaCopy />
                              </button>
                              <a
                                href={`https://${result.host}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-900"
                                title="Ziyaret et"
                              >
                                <FaExternalLinkAlt />
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {filteredResults.length > 0 && showListView && (
                <div className="p-4">
                  <div className="flex justify-between mb-3">
                    <div className="text-sm text-gray-500">
                      Toplam: <span className="font-medium">{filteredResults.length}</span> subdomain
                    </div>
                    <button
                      onClick={copyAllToClipboard}
                      className="flex items-center px-3 py-2 bg-blue-100 text-blue-800 rounded-md text-sm hover:bg-blue-200 transition"
                      title="Tüm subdomainleri kopyala"
                    >
                      <FaClipboard className="mr-2" />
                      Tümünü Kopyala
                    </button>
                  </div>
                  <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 max-h-96 overflow-y-auto font-mono text-sm">
                    {filteredResults.map((result, index) => (
                      <div key={index} className="hover:bg-gray-100 py-1 px-2 rounded flex justify-between items-center">
                        <div className="flex-1 break-all">
                          {result.host} {result.ip && <span className="text-gray-500 text-xs">({result.ip})</span>}
                        </div>
                        <div className="flex items-center space-x-2 ml-2">
                          <button
                            onClick={() => copyToClipboard(result.host)}
                            className="text-gray-600 hover:text-gray-900"
                            title="Panoya kopyala"
                          >
                            <FaCopy className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={`https://${result.host}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-900"
                            title="Ziyaret et"
                          >
                            <FaExternalLinkAlt className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Kopyalama bildirimi */}
            {copiedHost && (
              <div className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg">
                <p className="text-sm">"{copiedHost}" panoya kopyalandı</p>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
} 