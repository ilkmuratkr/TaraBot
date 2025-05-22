'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { FaArrowLeft, FaSearch, FaDownload, FaEdit } from 'react-icons/fa';
import { DomainList } from '@/models/DomainList';
import { DomainListService } from '@/services/DomainListService';

export default function DomainListDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  
  const [domainList, setDomainList] = useState<DomainList | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [domainsPerPage] = useState(50);
  
  useEffect(() => {
    const fetchDomainList = async () => {
      try {
        const list = await DomainListService.getById(id);
        setDomainList(list);
      } catch (error) {
        console.error('Domain listesi getirilirken hata:', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (id) {
      fetchDomainList();
    }
  }, [id]);
  
  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent"></div>
          <p className="ml-2 text-gray-600">Domain listesi yükleniyor...</p>
        </div>
      </Layout>
    );
  }
  
  if (!domainList) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-64">
          <p className="text-gray-600 mb-4">Domain listesi bulunamadı veya yüklenirken bir hata oluştu.</p>
          <Link href="/domain-listeleri" className="btn btn-primary">
            <FaArrowLeft className="mr-2" />
            Domain Listelerine Dön
          </Link>
        </div>
      </Layout>
    );
  }
  
  // Arama ve sayfalama işlemleri
  const filteredDomains = searchTerm
    ? domainList.domains.filter(domain => 
        domain.domain.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : domainList.domains;
  
  const totalPages = Math.ceil(filteredDomains.length / domainsPerPage);
  const indexOfLastDomain = currentPage * domainsPerPage;
  const indexOfFirstDomain = indexOfLastDomain - domainsPerPage;
  const currentDomains = filteredDomains.slice(indexOfFirstDomain, indexOfLastDomain);
  
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);
  
  // CSV olarak indirme fonksiyonu
  const downloadAsCsv = () => {
    let csvContent = 'rank,domain\n';
    
    domainList.domains.forEach(domain => {
      csvContent += `${domain.rank || ''},${domain.domain}\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${domainList.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };
  
  return (
    <Layout>
      <div className="flex flex-col space-y-6">
        <div className="flex items-center">
          <Link href="/domain-listeleri" className="text-gray-500 hover:text-gray-700 mr-3">
            <FaArrowLeft />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{domainList.name}</h1>
            <div className="flex flex-wrap items-center text-sm text-gray-600 mt-1">
              <span>Kaynak: {domainList.source}</span>
              <span className="mx-2">•</span>
              <span>{domainList.domains.length.toLocaleString('tr-TR')} domain</span>
              <span className="mx-2">•</span>
              <span>Oluşturma: {typeof domainList.createdAt === 'string' 
                ? new Date(domainList.createdAt).toLocaleDateString('tr-TR') 
                : domainList.createdAt instanceof Date 
                  ? domainList.createdAt.toLocaleDateString('tr-TR')
                  : 'Tarih bilgisi yok'}</span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:justify-between gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <FaSearch className="text-gray-400" />
            </div>
            <input
              type="text"
              className="pl-10 input"
              placeholder="Domain ara..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // Arama yapıldığında ilk sayfaya dön
              }}
            />
          </div>
          
          <div className="flex gap-2">
            <Link href={`/domain-listeleri/${id}/duzenle`} className="btn btn-secondary inline-flex items-center">
              <FaEdit className="mr-2" />
              Düzenle
            </Link>
            <button onClick={downloadAsCsv} className="btn btn-primary inline-flex items-center">
              <FaDownload className="mr-2" />
              CSV İndir
            </button>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left bg-gray-50">
                  <th className="px-6 py-3 font-medium w-16">Sıra</th>
                  <th className="px-6 py-3 font-medium">Domain</th>
                  {domainList.domains.some(d => d.rank !== undefined) && (
                    <th className="px-6 py-3 font-medium w-24">Kaynak Sırası</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {currentDomains.length > 0 ? (
                  currentDomains.map((domain, index) => (
                    <tr key={domain.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-gray-500">
                        {indexOfFirstDomain + index + 1}
                      </td>
                      <td className="px-6 py-3 font-medium">{domain.domain}</td>
                      {domainList.domains.some(d => d.rank !== undefined) && (
                        <td className="px-6 py-3 text-gray-500">
                          {domain.rank || '-'}
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={domainList.domains.some(d => d.rank !== undefined) ? 3 : 2} className="px-6 py-4 text-center text-gray-500">
                      {searchTerm ? 'Arama sonucu bulunamadı' : 'Bu liste boş'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Sayfalama */}
          {filteredDomains.length > domainsPerPage && (
            <div className="flex justify-between items-center px-6 py-3 bg-gray-50 border-t border-gray-200">
              <div className="text-sm text-gray-500">
                {indexOfFirstDomain + 1}-{Math.min(indexOfLastDomain, filteredDomains.length)} / {filteredDomains.length} domain gösteriliyor
              </div>
              
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => paginate(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`px-3 py-1 rounded ${
                    currentPage === 1
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Önceki
                </button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  // İlk sayfa, son sayfa ve mevcut sayfanın etrafındaki sayfaları göster
                  let pageNum = 0;
                  
                  if (totalPages <= 5) {
                    // 5 veya daha az sayfa varsa hepsini göster
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    // Başlardaysa ilk 5 sayfayı göster
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    // Sonlardaysa son 5 sayfayı göster
                    pageNum = totalPages - 4 + i;
                  } else {
                    // Ortadaysa mevcut sayfanın etrafındaki 5 sayfayı göster
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => paginate(pageNum)}
                      className={`px-3 py-1 rounded ${
                        currentPage === pageNum
                          ? 'bg-primary-600 text-white'
                          : 'text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => paginate(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1 rounded ${
                    currentPage === totalPages
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Sonraki
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
} 