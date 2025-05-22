'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { FaPlus, FaTrash, FaCog } from 'react-icons/fa';
import { DomainList } from '@/models/DomainList';
import { DomainListService } from '@/services/DomainListService';
import { ScanService } from '@/services/ScanService';

export default function NewScanPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  
  // Form state
  const [scanName, setScanName] = useState('');
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [includeSubdomains, setIncludeSubdomains] = useState(true);
  const [customSubdomains, setCustomSubdomains] = useState('www\nadmin\nblog');
  const [paths, setPaths] = useState<string[]>(['/wp-content']);
  const [startIndex, setStartIndex] = useState<number>(0);
  const [searchTerms, setSearchTerms] = useState<string[]>(['.env']);
  
  // Performans ayarları state - varsayılan değerler backend ile aynı
  const [concurrency, setConcurrency] = useState<number>(10);  // Aynı anda taranacak domain sayısı
  const [timeout, setTimeout] = useState<number>(5000);        // Her istek için zaman aşımı (ms)
  const [batchSize, setBatchSize] = useState<number>(20);      // İşlenecek domain batch boyutu
  const [urlBatchSize, setUrlBatchSize] = useState<number>(5); // Paralel HTTP istekleri
  const [retries, setRetries] = useState<number>(1);           // Başarısız istekler için yeniden deneme sayısı
  const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);
  
  // Domain listeleri state
  const [domainLists, setDomainLists] = useState<DomainList[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Errors
  const [errors, setErrors] = useState({
    scanName: '',
    selectedList: '',
    startIndex: '',
    paths: [''],
    searchTerms: [''],
    concurrency: '',
    timeout: '',
    batchSize: '',
    urlBatchSize: '',
    retries: '',
  });

  // Domain listelerini yükle
  useEffect(() => {
    const fetchDomainLists = async () => {
      try {
        setLoadingLists(true);
        const lists = await DomainListService.getAll();
        setDomainLists(lists);
      } catch (error) {
        console.error('Domain listeleri yüklenirken hata:', error);
      } finally {
        setLoadingLists(false);
      }
    };

    fetchDomainLists();
  }, []);

  const validateStep = (currentStep: number) => {
    const newErrors = { ...errors };
    let isValid = true;

    if (currentStep === 1) {
      if (!scanName.trim()) {
        newErrors.scanName = 'Tarama adı gerekli';
        isValid = false;
      } else {
        newErrors.scanName = '';
      }

      if (selectedListId === null) {
        newErrors.selectedList = 'Domain listesi seçmelisiniz';
        isValid = false;
      } else {
        newErrors.selectedList = '';
      }
    }
    
    if (currentStep === 2) {
      // Başlangıç indeksi kontrolü
      if (startIndex < 0) {
        newErrors.startIndex = 'Başlangıç sırası 0 veya daha büyük olmalıdır';
        isValid = false;
      } else {
        newErrors.startIndex = '';
      }
      
      // En az bir arama dizini kontrolü
      if (paths.length === 0 || !paths.some(path => path.trim().length > 0)) {
        newErrors.paths = ['En az bir dizin belirtmelisiniz'];
        isValid = false;
      } else {
        newErrors.paths = [''];
      }
      
      // En az bir arama terimi kontrolü
      if (searchTerms.length === 0 || !searchTerms.some(term => term.trim().length > 0)) {
        newErrors.searchTerms = ['En az bir arama terimi belirtmelisiniz'];
        isValid = false;
      } else {
        newErrors.searchTerms = [''];
      }
      
      // Performans ayarları doğrulaması
      if (showAdvancedSettings) {
        if (concurrency < 1 || concurrency > 100) {
          newErrors.concurrency = 'Eşzamanlılık değeri 1-100 arasında olmalıdır';
          isValid = false;
        } else {
          newErrors.concurrency = '';
        }
        
        if (timeout < 1000 || timeout > 30000) {
          newErrors.timeout = 'Zaman aşımı 1000-30000 ms arasında olmalıdır';
          isValid = false;
        } else {
          newErrors.timeout = '';
        }
        
        if (batchSize < 5 || batchSize > 100) {
          newErrors.batchSize = 'Batch boyutu 5-100 arasında olmalıdır';
          isValid = false;
        } else {
          newErrors.batchSize = '';
        }
        
        if (urlBatchSize < 1 || urlBatchSize > 20) {
          newErrors.urlBatchSize = 'URL batch boyutu 1-20 arasında olmalıdır';
          isValid = false;
        } else {
          newErrors.urlBatchSize = '';
        }
        
        if (retries < 0 || retries > 5) {
          newErrors.retries = 'Yeniden deneme sayısı 0-5 arasında olmalıdır';
          isValid = false;
        } else {
          newErrors.retries = '';
        }
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handlePathChange = (index: number, value: string) => {
    const newPaths = [...paths];
    newPaths[index] = value;
    setPaths(newPaths);
  };

  const handleSearchTermChange = (index: number, value: string) => {
    const newSearchTerms = [...searchTerms];
    newSearchTerms[index] = value;
    setSearchTerms(newSearchTerms);
  };

  const addPath = () => {
    setPaths([...paths, '']);
  };

  const removePath = (index: number) => {
    if (paths.length > 1) {
      const newPaths = [...paths];
      newPaths.splice(index, 1);
      setPaths(newPaths);
    }
  };

  const addSearchTerm = () => {
    setSearchTerms([...searchTerms, '']);
  };

  const removeSearchTerm = (index: number) => {
    if (searchTerms.length > 1) {
      const newSearchTerms = [...searchTerms];
      newSearchTerms.splice(index, 1);
      setSearchTerms(newSearchTerms);
    }
  };

  const goToNextStep = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    }
  };

  const goToPrevStep = () => {
    setStep(step - 1);
  };

  const startScan = async () => {
    if (validateStep(step)) {
      try {
        setIsSubmitting(true);
        
        // Seçilen domain listesini bul
        const selectedList = domainLists.find(list => list.id === selectedListId);
        
        if (!selectedList || !selectedListId) {
          throw new Error('Seçilen domain listesi bulunamadı');
        }
        
        // Tarama konfigürasyonu oluştur
        const scanConfig = {
          name: scanName,
          domainListId: selectedListId,
          domainListName: selectedList.name,
          startIndex: startIndex,
          includeSubdomains: includeSubdomains,
          subdomains: customSubdomains.split('\n').filter(Boolean),
          paths: paths.filter(Boolean),
          searchTerms: searchTerms.filter(Boolean),
          // Performans ayarlarını ekle (sadece gösteriliyorsa)
          ...(showAdvancedSettings && {
            concurrency,
            timeout,
            batchSize,
            urlBatchSize,
            retries
          })
        };
        
        // Tarama oluştur ve başlat
        const scan = await ScanService.createScan(scanConfig);
        await ScanService.startScan(scan.id);
        
        // Başarılı olduğunda tarama detay sayfasına yönlendir
        alert('Tarama başlatıldı!');
        router.push(`/tarama-gecmisi/${scan.id}`);
      } catch (error) {
        console.error('Tarama başlatılırken hata:', error);
        alert('Tarama başlatılamadı. Lütfen tekrar deneyin.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <h1 className="mb-2 text-2xl font-bold text-gray-800">Yeni Tarama Başlat</h1>
        <p className="mb-6 text-gray-600">Domain listelerini tarayarak içerik ve güvenlik kontrolü yapın</p>
        
        <div className="p-4 mb-6 bg-white rounded-lg shadow-sm">
          <div className="flex items-center">
            <div className={`flex items-center justify-center w-8 h-8 ${step >= 1 ? 'bg-primary-600' : 'bg-gray-300'} rounded-full text-white`}>
              1
            </div>
            <div className={`flex-1 h-1 mx-2 ${step >= 2 ? 'bg-primary-600' : 'bg-gray-300'}`}></div>
            <div className={`flex items-center justify-center w-8 h-8 ${step >= 2 ? 'bg-primary-600' : 'bg-gray-300'} rounded-full text-white`}>
              2
            </div>
          </div>
          <div className="flex justify-between mt-2 text-sm">
            <div className={step >= 1 ? 'text-primary-600 font-medium' : 'text-gray-500'}>
              Tarama Bilgileri
            </div>
            <div className={step >= 2 ? 'text-primary-600 font-medium' : 'text-gray-500'}>
              Tarama Kapsamı
            </div>
          </div>
        </div>
        
        <div className="space-y-6">
          {step === 1 && (
            <div className="p-6 bg-white rounded-lg shadow-sm">
              <div className="mb-4">
                <label htmlFor="scanName" className="block mb-2 text-sm font-medium text-gray-700">
                  Tarama Adı
                </label>
                <input
                  type="text"
                  id="scanName"
                  className={`input ${errors.scanName ? 'border-red-500' : ''}`}
                  value={scanName}
                  onChange={(e) => setScanName(e.target.value)}
                  placeholder="Örn: E-ticaret Siteleri Taraması"
                />
                {errors.scanName && <p className="mt-1 text-sm text-red-500">{errors.scanName}</p>}
              </div>
              
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Domain Listesi Seçin
                </label>
                
                {loadingLists ? (
                  <div className="flex items-center justify-center p-8 text-gray-500">
                    <div className="inline-block w-6 h-6 mr-2 border-2 border-t-2 border-gray-200 border-t-primary-600 rounded-full animate-spin"></div>
                    Domain listeleri yükleniyor...
                  </div>
                ) : domainLists.length > 0 ? (
                  <div className={`space-y-3 ${errors.selectedList ? 'border border-red-500 rounded-lg p-3' : ''}`}>
                    {domainLists.map((list) => (
                      <div
                        key={list.id}
                        className={`flex items-center p-4 border rounded-lg cursor-pointer ${
                          selectedListId === list.id
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setSelectedListId(list.id)}
                      >
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-800">{list.name}</h3>
                          <p className="text-sm text-gray-500">{list.domains.length.toLocaleString('tr-TR')} domain</p>
                        </div>
                        <div className="flex items-center justify-center w-5 h-5 border border-gray-300 rounded-full">
                          {selectedListId === list.id && (
                            <div className="w-3 h-3 bg-primary-600 rounded-full"></div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center bg-gray-50 rounded-lg">
                    <p className="mb-4 text-gray-500">Henüz hiç domain listesi eklenmemiş.</p>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => router.push('/domain-listeleri')}
                    >
                      Domain Listesi Ekle
                    </button>
                  </div>
                )}
                
                {errors.selectedList && <p className="mt-1 text-sm text-red-500">{errors.selectedList}</p>}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="p-6 bg-white rounded-lg shadow-sm space-y-6">
              {/* Alt Alan Adları Bölümü */}
              <div>
                <div className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    id="includeSubdomains"
                    checked={includeSubdomains}
                    onChange={(e) => setIncludeSubdomains(e.target.checked)}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="includeSubdomains" className="ml-2 text-sm font-medium text-gray-700">
                    Alt alan adlarını (subdomains) dahil et
                  </label>
                </div>
                
                <div className={`mt-3 ${!includeSubdomains ? 'opacity-50' : ''}`}>
                  <label htmlFor="customSubdomains" className="block mb-2 text-sm font-medium text-gray-700">
                    Alt Alan Adları (Her satıra bir alt alan adı)
                  </label>
                  <textarea
                    id="customSubdomains"
                    rows={4}
                    className="input font-mono"
                    value={customSubdomains}
                    onChange={(e) => setCustomSubdomains(e.target.value)}
                    placeholder="www&#10;admin&#10;blog&#10;shop"
                    disabled={!includeSubdomains}
                  ></textarea>
                  <p className="mt-1 text-sm text-gray-500">
                    {includeSubdomains ? 
                      'Belirtilen alt alan adları, her domain için taranacaktır. (örn: www.example.com, admin.example.com)' : 
                      'Alt alan adları devre dışı bırakıldı. Sadece ana domainler taranacak.'}
                  </p>
                </div>
              </div>
              
              {/* Başlangıç İndeksi */}
              <div>
                <label htmlFor="startIndex" className="block mb-2 text-sm font-medium text-gray-700">
                  Başlangıç Sırası
                </label>
                <input
                  type="number"
                  id="startIndex"
                  min="0"
                  className={`input w-full md:w-1/3 ${errors.startIndex ? 'border-red-500' : ''}`}
                  value={startIndex}
                  onChange={(e) => setStartIndex(parseInt(e.target.value) || 0)}
                />
                {errors.startIndex ? (
                  <p className="mt-1 text-sm text-red-500">{errors.startIndex}</p>
                ) : (
                  <p className="mt-1 text-sm text-gray-500">
                    Domain listesinde taramaya başlanacak sıra. Önceki yarım kalmış taramalara devam etmek için kullanın.
                  </p>
                )}
              </div>
              
              {/* Taranacak Dizinler */}
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Taranacak Dizinler
                </label>
                {paths.map((path, index) => (
                  <div key={index} className="flex items-center mb-2 space-x-2">
                    <input
                      type="text"
                      className="input"
                      value={path}
                      onChange={(e) => handlePathChange(index, e.target.value)}
                      placeholder="/wp-content"
                    />
                    {index === paths.length - 1 ? (
                      <button
                        type="button"
                        onClick={addPath}
                        className="p-2 text-primary-600 rounded-md hover:bg-primary-50"
                      >
                        <FaPlus />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => removePath(index)}
                        className="p-2 text-red-600 rounded-md hover:bg-red-50"
                      >
                        <FaTrash />
                      </button>
                    )}
                  </div>
                ))}
                {errors.paths[0] ? (
                  <p className="mt-1 text-sm text-red-500">{errors.paths[0]}</p>
                ) : (
                  <p className="text-sm text-gray-500">
                    Dizinleri "/" ile başlatın. (örn: /wp-admin, /wp-content, /uploads)
                  </p>
                )}
              </div>
              
              {/* Aranacak Kelimeler */}
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Aranacak Kelimeler
                </label>
                {searchTerms.map((term, index) => (
                  <div key={index} className="flex items-center mb-2 space-x-2">
                    <input
                      type="text"
                      className="input"
                      value={term}
                      onChange={(e) => handleSearchTermChange(index, e.target.value)}
                      placeholder="password"
                    />
                    {index === searchTerms.length - 1 ? (
                      <button
                        type="button"
                        onClick={addSearchTerm}
                        className="p-2 text-primary-600 rounded-md hover:bg-primary-50"
                      >
                        <FaPlus />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => removeSearchTerm(index)}
                        className="p-2 text-red-600 rounded-md hover:bg-red-50"
                      >
                        <FaTrash />
                      </button>
                    )}
                  </div>
                ))}
                {errors.searchTerms[0] ? (
                  <p className="mt-1 text-sm text-red-500">{errors.searchTerms[0]}</p>
                ) : (
                  <p className="text-sm text-gray-500">
                    Belirtilen dizinlerde aranacak kelimeler veya ifadeler. (örn: password, api_key, token)
                  </p>
                )}
              </div>
              
              {/* Performans Ayarları */}
              <div className="mt-8 border-t border-gray-200 pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <FaCog className="text-gray-500 mr-2" />
                    <h3 className="text-lg font-medium text-gray-800">Tarama Performans Ayarları</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                    className="flex items-center text-primary-600 bg-primary-50 px-3 py-1 rounded-md text-sm font-medium hover:bg-primary-100"
                  >
                    {showAdvancedSettings ? 'Basit Ayarlar' : 'Detaylı Ayarlar'}
                  </button>
                </div>
                <p className="mt-2 text-sm text-gray-600">
                  {showAdvancedSettings ? 
                    "Tarama hızı ve sistem kaynağı kullanımını dengelemek için ayarları özelleştirebilirsiniz." : 
                    "Önerilen tarama ayarları kullanılacak. Hızı veya güvenliği artırmak için detaylı ayarları açabilirsiniz."}
                </p>
                
                {showAdvancedSettings && (
                  <div className="mt-4 space-y-4 bg-gray-50 p-4 rounded-lg">
                    <div className="mb-4">
                      <p className="text-sm text-gray-700 mb-2">
                        <strong>Tarama Hızı ve Performans:</strong> Bu ayarlar, tarama hızını ve sistem kaynak kullanımını etkiler. Yüksek değerler taramayı hızlandırır ancak daha fazla sistem kaynağı kullanır.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Eşzamanlılık Ayarı */}
                      <div>
                        <label htmlFor="concurrency" className="block mb-1 text-sm font-medium text-gray-700">
                          Eşzamanlılık
                        </label>
                        <input
                          type="number"
                          id="concurrency"
                          min="1"
                          max="100"
                          className={`input ${errors.concurrency ? 'border-red-500' : ''}`}
                          value={concurrency}
                          onChange={(e) => setConcurrency(parseInt(e.target.value) || 10)}
                        />
                        {errors.concurrency ? (
                          <p className="mt-1 text-sm text-red-500">{errors.concurrency}</p>
                        ) : (
                          <p className="mt-1 text-xs text-gray-500">
                            Aynı anda taranacak domain sayısı
                          </p>
                        )}
                      </div>
                      
                      {/* Zaman Aşımı Ayarı */}
                      <div>
                        <label htmlFor="timeout" className="block mb-1 text-sm font-medium text-gray-700">
                          Zaman Aşımı (ms)
                        </label>
                        <input
                          type="number"
                          id="timeout"
                          min="1000"
                          max="30000"
                          step="1000"
                          className={`input ${errors.timeout ? 'border-red-500' : ''}`}
                          value={timeout}
                          onChange={(e) => setTimeout(parseInt(e.target.value) || 5000)}
                        />
                        {errors.timeout ? (
                          <p className="mt-1 text-sm text-red-500">{errors.timeout}</p>
                        ) : (
                          <p className="mt-1 text-xs text-gray-500">
                            Yanıt için beklenecek süre
                          </p>
                        )}
                      </div>
                      
                      {/* Domain Batch Boyutu */}
                      <div>
                        <label htmlFor="batchSize" className="block mb-1 text-sm font-medium text-gray-700">
                          Domain Batch Boyutu
                        </label>
                        <input
                          type="number"
                          id="batchSize"
                          min="5"
                          max="100"
                          className={`input ${errors.batchSize ? 'border-red-500' : ''}`}
                          value={batchSize}
                          onChange={(e) => setBatchSize(parseInt(e.target.value) || 20)}
                        />
                        {errors.batchSize ? (
                          <p className="mt-1 text-sm text-red-500">{errors.batchSize}</p>
                        ) : (
                          <p className="mt-1 text-xs text-gray-500">
                            Bir seferde işlenecek domain grubu 
                          </p>
                        )}
                      </div>
                      
                      {/* URL Batch Boyutu */}
                      <div>
                        <label htmlFor="urlBatchSize" className="block mb-1 text-sm font-medium text-gray-700">
                          URL Batch Boyutu
                        </label>
                        <input
                          type="number"
                          id="urlBatchSize"
                          min="1"
                          max="20"
                          className={`input ${errors.urlBatchSize ? 'border-red-500' : ''}`}
                          value={urlBatchSize}
                          onChange={(e) => setUrlBatchSize(parseInt(e.target.value) || 5)}
                        />
                        {errors.urlBatchSize ? (
                          <p className="mt-1 text-sm text-red-500">{errors.urlBatchSize}</p>
                        ) : (
                          <p className="mt-1 text-xs text-gray-500">
                            Paralel URL istekleri sayısı
                          </p>
                        )}
                      </div>
                      
                      {/* Yeniden Deneme Sayısı */}
                      <div>
                        <label htmlFor="retries" className="block mb-1 text-sm font-medium text-gray-700">
                          Yeniden Deneme
                        </label>
                        <input
                          type="number"
                          id="retries"
                          min="0"
                          max="5"
                          className={`input ${errors.retries ? 'border-red-500' : ''}`}
                          value={retries}
                          onChange={(e) => setRetries(parseInt(e.target.value) || 1)}
                        />
                        {errors.retries ? (
                          <p className="mt-1 text-sm text-red-500">{errors.retries}</p>
                        ) : (
                          <p className="mt-1 text-xs text-gray-500">
                            Başarısız istekler için tekrar sayısı
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-md mt-4">
                      <p className="text-sm text-blue-700">
                        <strong>Önerilen Ayarlar:</strong> Hızlı tarama için eşzamanlılık 10-20, timeout 3-5 saniye, yeniden deneme 0-1. Bloklanma riskine karşı değerleri düşük tutabilirsiniz.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div className="flex justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={goToPrevStep}
                className="btn btn-secondary"
              >
                Geri
              </button>
            ) : (
              <button
                type="button"
                onClick={() => router.push('/')}
                className="btn btn-secondary"
              >
                İptal
              </button>
            )}
            
            {step < 2 ? (
              <button
                type="button"
                onClick={goToNextStep}
                className="btn btn-primary"
                disabled={loadingLists || domainLists.length === 0}
              >
                İleri
              </button>
            ) : (
              <button
                type="button"
                onClick={startScan}
                className="btn btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div className="inline-block w-4 h-4 mr-2 border-2 border-t-2 border-gray-200 border-t-white rounded-full animate-spin"></div>
                    Başlatılıyor...
                  </>
                ) : 'Taramayı Başlat'}
              </button>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
} 