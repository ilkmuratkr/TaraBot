'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { FaPlus, FaSearch, FaTrash, FaEdit, FaDownload, FaFileUpload, FaExternalLinkAlt, FaSync } from 'react-icons/fa';
import { DomainList } from '@/models/DomainList';
import { DomainListService } from '@/services/DomainListService';

export default function DomainListsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [domainLists, setDomainLists] = useState<DomainList[]>([]);
  const [loading, setLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<string>('');
  
  const fetchLists = async () => {
    try {
      setLoading(true);
      const lists = await DomainListService.getAll();
      setDomainLists(lists);
    } catch (error) {
      console.error('Domain listelerini getirirken hata:', error);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchLists();
    
    // CSV işleme ilerlemesini takip et
    const progressInterval = setInterval(() => {
      if (isImporting) {
        const logMessages = Array.from(document.querySelectorAll('.browser-console-log'))
          .map(el => el.textContent || '')
          .filter(text => text.includes('domain işlendi'));
        
        if (logMessages.length > 0) {
          setImportProgress(logMessages[logMessages.length - 1]);
        }
      }
    }, 1000);
    
    return () => clearInterval(progressInterval);
  }, []);
  
  // isImporting değeri değiştiğinde listeleri yenileyin
  useEffect(() => {
    if (!isImporting) {
      // İçe aktarma bittiğinde listeleri yenile
      fetchLists();
    }
  }, [isImporting]);

  const filteredLists = domainLists.filter((list) => {
    if (!list || !searchTerm) return true;
    
    const name = list.name || '';
    const source = list.source || '';
    const term = searchTerm.toLowerCase();
    
    return name.toLowerCase().includes(term) || source.toLowerCase().includes(term);
  });

  const deleteDomainList = async (id: string) => {
    if (window.confirm('Bu domain listesini silmek istediğinize emin misiniz?')) {
      try {
        const success = await DomainListService.delete(id);
        if (success) {
          setDomainLists(domainLists.filter((list) => list.id !== id));
        }
      } catch (error) {
        console.error('Domain listesi silinirken hata:', error);
      }
    }
  };
  
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      setIsImporting(true);
      setImportProgress('CSV dosyası yükleniyor...');
      
      // Dosya ismini kullanarak liste adını belirle
      const fileName = file.name.replace(/\.[^/.]+$/, ""); // Uzantıyı kaldır
      const content = await file.text();
      
      setImportProgress('CSV içeriği işleniyor...');
      
      // CSV'yi içe aktar
      const newList = await DomainListService.importFromCSV(
        `${fileName} Listesi`, 
        'Manuel CSV Yükleme', 
        content
      );
      
      // Listeyi güncelle
      setDomainLists([...domainLists, newList]);
      
      alert(`Başarıyla içe aktarıldı: ${newList.domains.length.toLocaleString('tr-TR')} domain`);
    } catch (error) {
      console.error('Dosya içe aktarılırken hata:', error);
      alert('Dosya içe aktarılırken bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setIsImporting(false);
      setImportProgress('');
      // Input alanını temizle
      event.target.value = '';
    }
  };
  
  const importPresetLists = async () => {
    if (window.confirm('Önceden tanımlanmış domain listelerini (Tranco ve Majestic Top 1M listeleri) içe aktarmak istiyor musunuz? Bu işlem 1 milyon domain içeren listeleri yükleyecek ve uzun sürebilir.')) {
      try {
        setIsImporting(true);
        setImportProgress('Hazır listeler yükleniyor...');
        
        alert('1 milyon domain içeren listeler içe aktarılacak. Bu işlem tarayıcınızda yüksek bellek kullanımına neden olabilir ve birkaç dakika sürebilir. Lütfen bekleyin ve sayfayı kapatmayın.');
        
        const lists = await DomainListService.importPresetLists();
        
        if (lists.length > 0) {
          setDomainLists([...domainLists, ...lists]);
          alert(`${lists.length} domain listesi başarıyla içe aktarıldı. Toplam ${lists.reduce((total: number, list: DomainList) => total + list.domains.length, 0).toLocaleString('tr-TR')} domain içe aktarıldı.`);
        } else {
          alert('Listeler içe aktarılırken bir hata oluştu veya hiç liste bulunamadı.');
        }
      } catch (error) {
        console.error('Hazır listeler içe aktarılırken hata:', error);
        alert('Hazır listeler içe aktarılırken bir hata oluştu. Hata detayı: ' + (error instanceof Error ? error.message : String(error)));
      } finally {
        setIsImporting(false);
        setImportProgress('');
      }
    }
  };

  return (
    <Layout>
      <div className="flex flex-col space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Domain Listeleri</h1>
            <p className="text-gray-600">Taramalarda kullanılacak domain listelerinizi yönetin</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Link href="/domain-listeleri/ekle" className="btn btn-primary inline-flex items-center">
              <FaPlus className="mr-2" />
              Yeni Liste Ekle
            </Link>
            
            <label className="btn btn-secondary inline-flex items-center cursor-pointer">
              <FaFileUpload className="mr-2" />
              CSV Yükle
              <input 
                type="file" 
                accept=".csv,.txt" 
                className="hidden" 
                onChange={handleFileUpload}
                disabled={isImporting}
              />
            </label>
            
            <button
              className="btn btn-secondary inline-flex items-center"
              onClick={importPresetLists}
              disabled={isImporting}
            >
              {isImporting ? (
                <>
                  <span className="inline-block h-4 w-4 mr-2 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></span>
                  İçe Aktarılıyor...
                </>
              ) : (
                <>
                  <FaDownload className="mr-2" />
                  Hazır Listeler
                </>
              )}
            </button>
            
            <button
              className="btn btn-secondary inline-flex items-center"
              onClick={fetchLists}
              disabled={loading}
              title="Listeleri yenile"
            >
              <FaSync className={`${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {isImporting && importProgress && (
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center">
              <div className="mr-3">
                <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-r-transparent"></div>
              </div>
              <div className="text-blue-700">
                <p className="font-medium">İçe aktarma işlemi devam ediyor</p>
                <p className="text-sm">{importProgress}</p>
                <p className="text-xs mt-1">Bu işlem büyük listeler için birkaç dakika sürebilir. Lütfen bekleyin ve sayfayı kapatmayın.</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center p-4 bg-white rounded-lg shadow-sm">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <FaSearch className="text-gray-400" />
            </div>
            <input
              type="text"
              className="pl-10 input"
              placeholder="Domain listelerini ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm">
          {loading ? (
            <div className="p-6 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent"></div>
              <p className="mt-2 text-gray-600">Domain listeleri yükleniyor...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {filteredLists.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left bg-gray-50">
                      <th className="px-6 py-3 font-medium">Liste Adı</th>
                      <th className="px-6 py-3 font-medium">Domain Sayısı</th>
                      <th className="px-6 py-3 font-medium">Kaynak</th>
                      <th className="px-6 py-3 font-medium">Oluşturulma Tarihi</th>
                      <th className="px-6 py-3 font-medium text-center">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredLists.map((list) => (
                      <tr key={list.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium">{list.name}</td>
                        <td className="px-6 py-4">{list.domains.length.toLocaleString('tr-TR')} domain</td>
                        <td className="px-6 py-4">{list.source}</td>
                        <td className="px-6 py-4">{typeof list.createdAt === 'string' 
                          ? new Date(list.createdAt).toLocaleDateString('tr-TR') 
                          : list.createdAt.toLocaleDateString('tr-TR')}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center space-x-3">
                            <Link
                              href={`/domain-listeleri/${list.id}`}
                              className="p-2 text-blue-600 rounded-full hover:bg-blue-50"
                              title="Görüntüle"
                            >
                              <FaSearch className="w-4 h-4" />
                            </Link>
                            <Link
                              href={`/domain-listeleri/${list.id}/duzenle`}
                              className="p-2 text-yellow-600 rounded-full hover:bg-yellow-50"
                              title="Düzenle"
                            >
                              <FaEdit className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => deleteDomainList(list.id)}
                              className="p-2 text-red-600 rounded-full hover:bg-red-50"
                              title="Sil"
                            >
                              <FaTrash className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-6 text-center">
                  <p className="text-gray-500">Henüz hiç domain listesi eklenmemiş.</p>
                  <div className="mt-4">
                    <Link href="/domain-listeleri/ekle" className="btn btn-primary">
                      <FaPlus className="mr-2" />
                      Yeni Liste Ekle
                    </Link>
                    <span className="mx-2">veya</span>
                    <button
                      className="btn btn-secondary"
                      onClick={importPresetLists}
                      disabled={isImporting}
                    >
                      <FaDownload className="mr-2" />
                      Hazır Listeleri İçe Aktar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
} 