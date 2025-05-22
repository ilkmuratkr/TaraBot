'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { FaArrowLeft, FaDownload, FaSync, FaServer, FaCopy, FaSearch, FaExternalLinkAlt, FaClipboard, FaList, FaPlus } from 'react-icons/fa';
import { ReverseIPService, ReverseIPScan } from '@/services/ReverseIPService';
import { DomainListService } from '@/services/DomainListService';

export default function ReverseIPDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  
  const [scan, setScan] = useState<ReverseIPScan | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [copiedDomain, setCopiedDomain] = useState<string | null>(null);
  const [showListView, setShowListView] = useState<boolean>(false);
  
  // Domain listesi ekleme modali için state
  const [showDomainListModal, setShowDomainListModal] = useState<boolean>(false);
  const [listName, setListName] = useState<string>('');
  const [isAddingToList, setIsAddingToList] = useState<boolean>(false);
  const [addListError, setAddListError] = useState<string | null>(null);

  useEffect(() => {
    loadScan();
  }, [id]);

  useEffect(() => {
    // IP adresi değiştiğinde liste adını güncelle
    if (scan?.ip) {
      setListName(`IP ${scan.ip} Domainleri`);
    }
  }, [scan?.ip]);

  const loadScan = async () => {
    setIsLoading(true);
    try {
      const data = await ReverseIPService.getScanById(id);
      if (!data) {
        alert('Tarama bulunamadı!');
        router.push('/reverseip');
        return;
      }
      setScan(data);
    } catch (error) {
      console.error('Tarama yüklenirken hata oluştu:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    if (!scan) return;
    
    setIsExporting(true);
    
    try {
      // Tüm domainleri satır satır bir string olarak birleştir
      const domainText = scan.domains.join('\n');
      
      // Blob oluştur
      const blob = new Blob([domainText], { type: 'text/plain' });
      
      // Download linkini oluştur
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reverseip-${scan.ip}-${new Date().toISOString().split('T')[0]}.txt`;
      
      // Linki simüle et
      document.body.appendChild(a);
      a.click();
      
      // Temizlik
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Dışa aktarma hatası:', error);
      alert('Dışa aktarma sırasında bir hata oluştu!');
    } finally {
      setIsExporting(false);
    }
  };

  const copyToClipboard = (domain: string) => {
    navigator.clipboard.writeText(domain)
      .then(() => {
        setCopiedDomain(domain);
        setTimeout(() => setCopiedDomain(null), 2000);
      })
      .catch(err => {
        console.error('Panoya kopyalama hatası:', err);
      });
  };

  const copyAllToClipboard = () => {
    if (!scan) return;
    
    const domainText = scan.domains.join('\n');
    navigator.clipboard.writeText(domainText)
      .then(() => {
        setCopiedDomain('Tüm domainler');
        setTimeout(() => setCopiedDomain(null), 2000);
      })
      .catch(err => {
        console.error('Panoya kopyalama hatası:', err);
      });
  };

  const handleAddToDomainList = async () => {
    if (!scan || !listName.trim()) {
      setAddListError('Liste adı boş olamaz');
      return;
    }
    
    setIsAddingToList(true);
    setAddListError(null);
    
    try {
      // Liste kaynağını oluştur
      const source = `Reverse IP: ${scan.ip}`;
      
      // Domainleri oluştur
      const domains = scan.domains.map(domain => ({ id: '', domain }));
      
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
      setCopiedDomain(`${scan.domains.length} domain, '${listName}' listesine eklendi`);
      
      // Modalı kapat
      setShowDomainListModal(false);
      
    } catch (error) {
      console.error('Domain listesi oluşturma hatası:', error);
      setAddListError('Domain listesi oluşturulurken bir hata oluştu');
    } finally {
      setIsAddingToList(false);
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

  // Arama filtreleme fonksiyonu
  const filteredDomains = scan?.domains.filter(domain => 
    domain.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <Link href="/reverseip" className="mr-4 text-gray-600 hover:text-gray-900">
              <FaArrowLeft className="text-xl" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-800">
              Reverse IP Sonuçları: {scan?.ip}
            </h1>
          </div>
          <div className="flex space-x-2">
            <button
              className="btn-secondary flex items-center"
              onClick={loadScan}
              disabled={isLoading}
            >
              <FaSync className={`mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Yenile
            </button>
            <button
              className="btn-primary flex items-center"
              onClick={handleExport}
              disabled={isExporting || !scan || scan.domains.length === 0}
            >
              <FaDownload className="mr-2" />
              Dışa Aktar
            </button>
            <button
              className="btn-success flex items-center"
              onClick={() => setShowDomainListModal(true)}
              disabled={!scan || scan.domains.length === 0}
            >
              <FaList className="mr-2" />
              Listeye Ekle
            </button>
          </div>
        </div>
        
        {isLoading ? (
          <div className="bg-white shadow rounded-lg p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-2 text-gray-500">Yükleniyor...</p>
          </div>
        ) : scan ? (
          <>
            <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-medium text-gray-800">Tarama Bilgileri</h2>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">IP Adresi</p>
                    <p className="text-lg font-medium flex items-center">
                      <FaServer className="mr-2 text-gray-400" />
                      {scan.ip}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Durum</p>
                    <p className="text-lg font-medium">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(scan.status)}`}>
                        {getStatusText(scan.status)}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Domain Sayısı</p>
                    <p className="text-lg font-medium">{scan.count}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Tarama Tarihi</p>
                    <p className="text-lg font-medium">{formatDate(scan.createdAt)}</p>
                  </div>
                </div>
                
                {scan.status === 'failed' && scan.errorMessage && (
                  <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md">
                    <p className="font-medium">Hata:</p>
                    <p>{scan.errorMessage}</p>
                  </div>
                )}
              </div>
            </div>
            
            {scan.domains.length > 0 && (
              <>
                <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
                  <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                    <h2 className="text-lg font-medium text-gray-800">Bulunan Domainler</h2>
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
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Domain ara..."
                          className="border border-gray-300 rounded-md pl-3 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <span className="absolute right-3 top-2.5 text-gray-400">
                          <FaSearch />
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {!showListView ? (
                    <div className="overflow-x-auto">
                      <table className="w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              #
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Domain
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              İşlemler
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredDomains.map((domain, index) => (
                            <tr key={index}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {index + 1}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {domain}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex justify-end space-x-3">
                                  <button
                                    onClick={() => copyToClipboard(domain)}
                                    className="text-gray-600 hover:text-gray-900"
                                    title="Panoya kopyala"
                                  >
                                    <FaCopy />
                                  </button>
                                  <a
                                    href={`https://${domain}`}
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
                  ) : (
                    <div className="p-4">
                      <div className="flex justify-between mb-3">
                        <div className="text-sm text-gray-500">
                          Toplam: <span className="font-medium">{filteredDomains.length}</span> domain
                        </div>
                        <button
                          onClick={copyAllToClipboard}
                          className="flex items-center px-3 py-2 bg-blue-100 text-blue-800 rounded-md text-sm hover:bg-blue-200 transition"
                          title="Tüm domainleri kopyala"
                        >
                          <FaClipboard className="mr-2" />
                          Tümünü Kopyala
                        </button>
                      </div>
                      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 max-h-96 overflow-y-auto font-mono text-sm">
                        {filteredDomains.map((domain, index) => (
                          <div key={index} className="hover:bg-gray-100 py-1 px-2 rounded">
                            {domain}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {filteredDomains.length === 0 && (
                    <div className="p-8 text-center">
                      <p className="text-gray-500">Aramanızla eşleşen domain bulunamadı.</p>
                    </div>
                  )}
                </div>
              </>
            )}
            
            {scan.domains.length === 0 && scan.status === 'completed' && (
              <div className="bg-white shadow rounded-lg p-8 text-center">
                <p className="text-gray-500">Bu IP adresinde hiç domain bulunamadı.</p>
              </div>
            )}
            
            {/* Domain listesine ekleme modalı */}
            {showDomainListModal && (
              <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
                  <h2 className="text-lg font-semibold mb-4">Domainleri Listeye Ekle</h2>
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">
                      {scan.domains.length} adet domain, yeni bir liste olarak kaydedilecek.
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
            {copiedDomain && (
              <div className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg">
                <p className="text-sm">"{copiedDomain}" panoya kopyalandı</p>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white shadow rounded-lg p-8 text-center">
            <p className="text-gray-500">Tarama bulunamadı.</p>
          </div>
        )}
      </div>
    </Layout>
  );
} 