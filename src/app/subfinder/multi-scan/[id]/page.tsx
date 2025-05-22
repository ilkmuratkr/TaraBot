'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { SubfinderService, MultiScanJob, SubfinderResult } from '@/services/SubfinderService';
import Layout from '@/components/Layout';
import { FaPlay, FaPause, FaStop, FaTrash, FaDownload, FaSync, FaChevronDown, FaChevronUp, FaSearch, FaCopy, FaExternalLinkAlt, FaClipboard, FaList, FaPlus } from 'react-icons/fa';
import Link from 'next/link';
import { DomainListService } from '@/services/DomainListService';

// Helper function to format date strings
const formatDate = (dateString: string | undefined) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'medium' });
  } catch (e) {
    return 'Geçersiz Tarih';
  }
};

// Helper function to get status class
const getStatusClass = (status: string | undefined) => {
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
const getIndividualScanStatusClass = (status: string | undefined) => {
  switch (status) {
    case 'completed': return 'text-green-600 font-semibold';
    case 'failed': return 'text-red-600 font-semibold';
    default: return 'text-gray-500';
  }
};

export default function MultiScanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [scanJob, setScanJob] = useState<MultiScanJob | null>(null);
  const [results, setResults] = useState<SubfinderResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultsPage, setResultsPage] = useState(0);
  const [resultsLimit] = useState(100);
  const [hasMoreResults, setHasMoreResults] = useState(true);
  const [expandedDomains, setExpandedDomains] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showListView, setShowListView] = useState<boolean>(false);
  const [copiedHost, setCopiedHost] = useState<string | null>(null);
  
  // Domain listesi ekleme modali için state
  const [showDomainListModal, setShowDomainListModal] = useState<boolean>(false);
  const [listName, setListName] = useState<string>('');
  const [isAddingToList, setIsAddingToList] = useState<boolean>(false);
  const [addListError, setAddListError] = useState<string | null>(null);

  const fetchScanDetails = useCallback(async () => {
    if (!id) return;
    try {
      const jobData = await SubfinderService.getMultiScanDetails(id);
      if (jobData) {
        setScanJob(jobData);
        // Set default list name when scan details are loaded
        if (!listName && jobData.name) {
          setListName(`${jobData.name} Subdomainleri`);
        }
      } else {
        setError('Çoklu tarama işi bulunamadı.');
      }
    } catch (err: any) {
      setError(err.message || 'Tarama detayları yüklenirken bir hata oluştu.');
      console.error('Tarama detayları yükleme hatası:', err);
    }
  }, [id, listName]);

  const fetchResults = useCallback(async (page: number, newSearch: boolean = false) => {
    if (!id) return;
    if (!hasMoreResults && !newSearch && page !== 0) return;

    setIsLoadingResults(true);
    try {
      const newResults = await SubfinderService.getMultiScanResults(id, page, resultsLimit);
      if (newResults.length < resultsLimit) {
        setHasMoreResults(false);
      }
      setResults(prev => (page === 0 || newSearch) ? newResults : [...prev, ...newResults]);
      setResultsPage(page + 1);
    } catch (err: any) {
      console.error('Sonuçlar yüklenirken hata:', err);
      setError('Sonuçlar yüklenirken bir hata oluştu.');
    } finally {
      setIsLoadingResults(false);
    }
  }, [id, resultsLimit, hasMoreResults]);

  // Initial data loading
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        await fetchScanDetails();
        await fetchResults(0, true);
      } catch (error) {
        console.error("Error loading initial data", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (id) { 
        loadInitialData();
    }
  }, [id, fetchScanDetails, fetchResults]);

  useEffect(() => {
    if (!id || !scanJob || scanJob.status === 'completed' || scanJob.status === 'failed' || scanJob.status === 'stopping') {
      return;
    }
    const interval = setInterval(() => {
      fetchScanDetails();
    }, 5000);
    return () => clearInterval(interval);
  }, [id, scanJob, fetchScanDetails]);

  const handlePause = async () => {
    if (!id || !scanJob || scanJob.status !== 'running') return;
    const originalStatus = scanJob.status;
    setScanJob(prev => prev ? { ...prev, status: 'stopping' } : null);
    try {
      const updatedJob = await SubfinderService.pauseMultiScan(id);
      if (updatedJob) setScanJob(updatedJob);
      else setScanJob(prev => prev ? { ...prev, status: originalStatus } : null);
    } catch (e) {
      setScanJob(prev => prev ? { ...prev, status: originalStatus } : null);
      console.error("Pause error", e);
    }
  };

  const handleResume = async () => {
    if (!id || !scanJob || scanJob.status !== 'paused') return;
    const originalStatus = scanJob.status;
    setScanJob(prev => prev ? { ...prev, status: 'running' } : null);
    try {
      const updatedJob = await SubfinderService.resumeMultiScan(id);
      if (updatedJob) setScanJob(updatedJob);
      else setScanJob(prev => prev ? { ...prev, status: originalStatus } : null);
    } catch (e) {
      setScanJob(prev => prev ? { ...prev, status: originalStatus } : null);
      console.error("Resume error", e);
    }
  };

  const handleStop = async () => {
    if (!id || !scanJob || !confirm('Bu çoklu taramayı durdurmak istediğinizden emin misiniz? Kalan domainler işlenmeyecektir.')) return;
    if (scanJob.status === 'completed' || scanJob.status === 'failed' || scanJob.status === 'stopping') return;
    const originalStatus = scanJob.status;
    setScanJob(prev => prev ? { ...prev, status: 'stopping' } : null);
    try {
      const updatedJob = await SubfinderService.stopMultiScan(id);
      if (updatedJob) setScanJob(updatedJob);
      else setScanJob(prev => prev ? { ...prev, status: originalStatus } : null);
    } catch (e) {
      setScanJob(prev => prev ? { ...prev, status: originalStatus } : null);
      console.error("Stop error", e);
    }
  };

  const handleDelete = async () => {
    if (!id || !confirm('Bu çoklu taramayı ve tüm sonuçlarını kalıcı olarak silmek istediğinizden emin misiniz?')) return;
    try {
      setIsLoading(true);
      const success = await SubfinderService.deleteMultiScan(id);
      if (success) {
        router.push('/subfinder/multi-scan');
      } else {
        alert('Tarama silinirken bir hata oluştu.');
        setIsLoading(false);
      }
    } catch (e) {
      alert('Tarama silinirken bir hata oluştu: ' + (e as Error).message);
      setIsLoading(false);
    }
  };
  
  const toggleDomainExpansion = (domain: string) => {
    setExpandedDomains(prev => ({ ...prev, [domain]: !prev[domain] }));
  };

  const downloadCSV = () => {
    if (results.length === 0) {
      alert('İndirilecek sonuç bulunmamaktadır.');
      return;
    }
    const headers = ['host', 'source', 'ip', 'input'];
    const csvRows = [
      headers.join(','),
      ...results.map(row => 
        headers.map(header => {
          let value = (row as any)[header];
          if (value === undefined || value === null) value = '';
          if (Array.isArray(value)) value = value.join('|');
          const stringValue = String(value);
          return `"${stringValue.replace(/"/g, '""')}"`;
        }).join(',')
      )
    ];
    const csvString = csvRows.join('\r\n');
    const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `multiscan_${scanJob?.name || id}_subdomains.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
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
  
  const handleAddToDomainList = async () => {
    if (!scanJob || !listName.trim()) {
      setAddListError('Liste adı boş olamaz');
      return;
    }
    
    setIsAddingToList(true);
    setAddListError(null);
    
    try {
      // Liste kaynağını oluştur
      const source = `Çoklu Subfinder: ${scanJob.name}`;
      
      // Önce tüm sonuçları getir (sayfalama olmadan)
      let allResults: SubfinderResult[] = [];
      let page = 0;
      let hasMore = true;
      const limit = 1000; // Daha büyük sayfalama limiti kullanarak daha az API çağrısı yap
      
      setCopiedHost('Tüm sonuçlar toplanıyor, lütfen bekleyin...');
      
      while (hasMore) {
        const batchResults = await SubfinderService.getMultiScanResults(id, page, limit);
        if (batchResults.length === 0 || batchResults.length < limit) {
          hasMore = false;
        }
        allResults = [...allResults, ...batchResults];
        page++;
      }
      
      if (allResults.length === 0) {
        setAddListError('Listeye eklenecek subdomain bulunamadı');
        setIsAddingToList(false);
        return;
      }
      
      // Sonuçları domainlere dönüştür
      const domains = allResults.map(result => ({ id: '', domain: result.host }));
      
      setCopiedHost(`${domains.length} subdomain ekleniyor...`);
      
      // Tek adımda hem listeyi oluştur hem de domainleri ekle
      const newList = await DomainListService.create(listName, source, domains);
      
      // Oluşturulan listenin ID'si ile listeyi güncelleyerek domainleri ekle
      const updatedList = await DomainListService.update(
        newList.id,
        {
          name: listName,
          source: source,
          domains: domains
        }
      );
      
      // Başarılı mesaj göster
      setCopiedHost(`${domains.length} subdomain, '${listName}' listesine eklendi`);
      
      // Modalı kapat
      setShowDomainListModal(false);
      
    } catch (error) {
      console.error('Domain listesi oluşturma hatası:', error);
      setAddListError('Domain listesi oluşturulurken bir hata oluştu');
    } finally {
      setIsAddingToList(false);
    }
  };

  if (isLoading && !scanJob) {
    return <Layout><div className="container mx-auto px-4 py-8 text-center"><p className="text-xl text-gray-600">Çoklu Tarama Detayları Yükleniyor...</p></div></Layout>;
  }
  if (error && !scanJob) {
    return <Layout><div className="container mx-auto px-4 py-8 text-center"><p className="text-xl text-red-500">Hata: {error}</p></div></Layout>;
  }
  if (!scanJob) {
    return <Layout><div className="container mx-auto px-4 py-8 text-center"><p className="text-xl text-gray-600">Tarama işi bulunamadı veya yüklenemedi.</p></div></Layout>;
  }

  const totalDomains = scanJob.domains?.length || 0;
  const completedOrFailedDomainsCount = Object.keys(scanJob.completedDomainScans || {}).length;

  const isActionable = scanJob.status === 'running' || scanJob.status === 'paused' || scanJob.status === 'pending';
  
  // Arama ve filtreleme
  const filteredResults = results
    .filter(result => {
      if (!searchQuery) return true;
      return result.host.toLowerCase().includes(searchQuery.toLowerCase());
    });

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert"><p>{error}</p></div>} 
        <div className="bg-white shadow-xl rounded-lg p-6 md:p-8">
          <div className="flex flex-col md:flex-row justify-between items-start mb-6 pb-6 border-b">
            <div className="mb-4 md:mb-0">
              <h1 className="text-3xl font-bold text-gray-800 mb-1">Çoklu Tarama: {scanJob.name}</h1>
              <p className="text-sm text-gray-500 mb-2">ID: {scanJob.id}</p>
              <span className={`px-3 py-1 text-sm font-semibold rounded-full inline-block ${getStatusClass(scanJob.status)}`}>
                {scanJob.status ? scanJob.status.toUpperCase() : 'BİLİNMİYOR'}
              </span>
              <p className="text-sm text-gray-600 mt-2">Başlangıç: {formatDate(scanJob.createdAt)}</p>
              <p className="text-sm text-gray-600">Son Güncelleme: {formatDate(scanJob.updatedAt)}</p>
            </div>
            <div className="flex flex-col space-y-2 items-stretch md:items-end w-full md:w-auto">
              {scanJob.status === 'running' && (
                <button onClick={handlePause} className="btn-warning flex items-center justify-center"><FaPause className="mr-2" /> Duraklat</button>
              )}
              {scanJob.status === 'paused' && (
                <button onClick={handleResume} className="btn-success flex items-center justify-center"><FaPlay className="mr-2" /> Devam Et</button>
              )}
              {isActionable && (
                <button onClick={handleStop} className="btn-danger flex items-center justify-center"><FaStop className="mr-2" /> Durdur</button>
              )}
              <button onClick={handleDelete} className="btn-danger-outline flex items-center justify-center"><FaTrash className="mr-2" /> Sil</button>
              <button onClick={() => { fetchScanDetails(); fetchResults(0, true); }} disabled={isLoading || isLoadingResults} className="btn-secondary flex items-center justify-center">
                  <FaSync className={`mr-2 ${(isLoading || isLoadingResults) ? 'animate-spin' : ''}`} /> Yenile
              </button>
            </div>
          </div>

          <div className="mb-8 p-4 bg-gray-50 rounded-lg">
            <h2 className="text-xl font-semibold text-gray-700 mb-3">Tarama İlerlemesi</h2>
            <div className="w-full bg-gray-200 rounded-full h-6 mb-1">
              <div 
                className={`h-6 rounded-full ${getStatusClass(scanJob.status)} transition-all duration-500 ease-out`}
                style={{ width: `${scanJob.overallProgress}%` }}
              >
                 <span className="text-xs font-medium flex items-center justify-center h-full text-white">{scanJob.overallProgress}%</span>
              </div>
            </div>
            <p className="text-sm text-gray-600 text-center">{completedOrFailedDomainsCount} / {totalDomains} domain işlendi. Toplam {scanJob.totalSubdomainsFound} alt-domain bulundu.</p>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-700 mb-3">Domain Taramaları ({completedOrFailedDomainsCount}/{totalDomains})</h2>
            <div className="space-y-2 max-h-[30rem] overflow-y-auto bg-gray-50 p-4 rounded-lg border">
              {(scanJob.domains && scanJob.domains.length > 0) ? scanJob.domains.map((domain, index) => {
                const scanInfo = scanJob.completedDomainScans && scanJob.completedDomainScans[domain];
                return (
                  <div key={domain} className="p-3 border rounded-md bg-white shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleDomainExpansion(domain)}>
                      <div className="flex items-center">
                        <span className="text-gray-500 mr-2">{index + 1}.</span>
                        <span className="font-medium text-gray-800">{domain}</span>
                      </div>
                      <div className="flex items-center">
                        {scanInfo ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full mr-2 ${getIndividualScanStatusClass(scanInfo.status)}`}>
                            {scanInfo.status ? scanInfo.status.toUpperCase() : '-'} ({scanInfo.resultCount ?? 0} sonuç)
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 mr-2">Bekliyor...</span>
                        )}
                        {expandedDomains[domain] ? <FaChevronUp className="text-gray-600" /> : <FaChevronDown className="text-gray-500" />}
                      </div>
                    </div>
                    {expandedDomains[domain] && scanInfo && (
                      <div className="mt-3 pt-2 pl-6 border-t text-xs text-gray-600 space-y-1">
                        <p><span className="font-semibold">Tekil Tarama ID:</span> 
                          {scanInfo.scanId !== 'N/A' && scanInfo.scanId !== 'N/A_WORKER_ERROR' ? 
                            <Link href={`/subfinder/${scanInfo.scanId}`} className="text-blue-600 hover:underline">{scanInfo.scanId}</Link> 
                            : scanInfo.scanId
                          }
                        </p>
                        {scanInfo.error && <p className="text-red-500"><span className="font-semibold">Hata:</span> {scanInfo.error}</p>}
                      </div>
                    )}
                  </div>
                );
              }) : <p className="text-gray-500 text-center py-4">Bu çoklu tarama için henüz domain tanımlanmamış.</p>}
            </div>
          </div>

          <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-3">
              <h2 className="text-xl font-semibold text-gray-700 mb-2 md:mb-0">Birleştirilmiş Sonuçlar ({results.length} / {scanJob.totalSubdomainsFound})</h2>
              <div className="flex flex-wrap gap-2">
                <button onClick={downloadCSV} className="btn-primary-outline flex items-center justify-center text-sm" disabled={results.length === 0 || isLoadingResults}>
                  <FaDownload className="mr-2" /> CSV İndir
                </button>
                <button
                  onClick={() => setShowDomainListModal(true)}
                  className="btn-success-outline flex items-center justify-center text-sm"
                  disabled={!results.length}
                >
                  <FaList className="mr-2" />
                  {scanJob.status === 'completed' ? 'Tümünü Listeye Ekle' : 'Mevcut Sonuçları Listeye Ekle'}
                </button>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
              <div className="flex flex-wrap items-center gap-2 mb-3 md:mb-0">
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
            </div>
            
            {isLoadingResults && results.length === 0 && (
                 <div className="text-center py-10"><p className="text-gray-500">Sonuçlar yükleniyor...</p></div>
            )}
            {!isLoadingResults && results.length === 0 && (scanJob.status === 'completed' || scanJob.status === 'failed') && (
                 <div className="text-center py-10"><p className="text-gray-500">Bu tarama için birleştirilmiş sonuç bulunmamaktadır.</p></div>
            )}
            {results.length > 0 && !showListView && (
              <div className="overflow-x-auto bg-white rounded-lg shadow border">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Host</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kaynak(lar)</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Adresi</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Giriş Domaini</th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredResults.map((result, index) => (
                      <tr key={`${result.host}-${index}`} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{result.host}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{Array.isArray(result.source) ? result.source.join(', ') : result.source}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{result.ip || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{result.input || scanJob.domains.find(d => result.host.endsWith(d)) || 'N/A'}</td>
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
            
            {results.length > 0 && showListView && (
              <div className="p-4 bg-white rounded-lg shadow border">
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
            
            {hasMoreResults && results.length > 0 && (
              <div className="mt-6 text-center">
                <button 
                  onClick={() => fetchResults(resultsPage)} 
                  disabled={isLoadingResults} 
                  className="btn-secondary"
                >
                  {isLoadingResults ? 'Daha Fazla Yükleniyor...' : 'Daha Fazla Yükle'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Domain listesine ekleme modalı */}
      {showDomainListModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
            <h2 className="text-lg font-semibold mb-4">Subdomainleri Listeye Ekle</h2>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                {scanJob.status === 'completed' 
                  ? `Tüm sonuçlar (toplam ${scanJob.totalSubdomainsFound} subdomain) yeni bir liste olarak kaydedilecek.`
                  : `Şu ana kadar elde edilen tüm sonuçlar yeni bir liste olarak kaydedilecek.`}
              </p>
              <label htmlFor="list-name" className="block text-sm font-medium text-gray-700 mb-1">
                Liste Adı
              </label>
              <input
                type="text"
                id="list-name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                placeholder="Liste adı girin"
              />
              {addListError && (
                <p className="mt-1 text-sm text-red-600">{addListError}</p>
              )}
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                onClick={() => setShowDomainListModal(false)}
              >
                İptal
              </button>
              <button
                type="button"
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 flex items-center"
                onClick={handleAddToDomainList}
                disabled={isAddingToList}
              >
                {isAddingToList ? (
                  <>
                    <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                    İşleniyor...
                  </>
                ) : (
                  <>
                    <FaPlus className="mr-2" />
                    Listeye Ekle
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Kopyalama bildirimi */}
      {copiedHost && (
        <div className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg">
          <p className="text-sm">"{copiedHost}" panoya kopyalandı</p>
        </div>
      )}
    </Layout>
  );
} 