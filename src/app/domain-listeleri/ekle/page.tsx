'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { FaUpload, FaTrash } from 'react-icons/fa';
import { DomainListService } from '@/services/DomainListService';

export default function AddDomainListPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [inputMethod, setInputMethod] = useState<'manual' | 'file'>('manual');
  const [domains, setDomains] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [errors, setErrors] = useState({
    name: '',
    domains: '',
    file: '',
  });

  const validateForm = () => {
    const newErrors = {
      name: '',
      domains: '',
      file: '',
    };
    
    let isValid = true;

    if (!name.trim()) {
      newErrors.name = 'Liste adı gerekli';
      isValid = false;
    }

    if (inputMethod === 'manual' && !domains.trim()) {
      newErrors.domains = 'En az bir domain girmelisiniz';
      isValid = false;
    }

    if (inputMethod === 'file' && !file) {
      newErrors.file = 'Dosya seçmelisiniz';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      try {
        setSubmitting(true);
        
        if (inputMethod === 'manual') {
          // Manuel girilen domainleri işle
          const domainArray = domains
            .split('\n')
            .map(d => d.trim())
            .filter(d => d.length > 0 && d.includes('.'));
          
          // Her domain için bir obje oluştur
          const domainObjects = domainArray.map(domain => ({
            id: Math.random().toString(36).substring(2, 15),
            domain
          }));
          
          await DomainListService.create(name, 'Manuel Giriş', domainObjects);
        } else if (inputMethod === 'file' && file) {
          // Dosyadan oku
          const fileContent = await file.text();
          await DomainListService.importFromCSV(name, 'CSV Dosyası', fileContent);
        }
        
        router.push('/domain-listeleri');
      } catch (error) {
        console.error('Domain listesi kaydedilirken hata:', error);
        alert('Domain listesi kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.');
      } finally {
        setSubmitting(false);
      }
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <h1 className="mb-6 text-2xl font-bold text-gray-800">Yeni Domain Listesi Ekle</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="p-6 bg-white rounded-lg shadow-sm">
            <div className="mb-4">
              <label htmlFor="name" className="block mb-2 text-sm font-medium text-gray-700">
                Liste Adı
              </label>
              <input
                type="text"
                id="name"
                className={`input ${errors.name ? 'border-red-500' : ''}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn: E-ticaret Siteleri"
                disabled={submitting}
              />
              {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
            </div>
            
            <div className="mb-4">
              <label className="block mb-2 text-sm font-medium text-gray-700">Domain Giriş Yöntemi</label>
              <div className="flex space-x-4">
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="manual"
                    name="inputMethod"
                    checked={inputMethod === 'manual'}
                    onChange={() => setInputMethod('manual')}
                    className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                    disabled={submitting}
                  />
                  <label htmlFor="manual" className="ml-2 text-sm text-gray-700">
                    Manuel Giriş
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="file"
                    name="inputMethod"
                    checked={inputMethod === 'file'}
                    onChange={() => setInputMethod('file')}
                    className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                    disabled={submitting}
                  />
                  <label htmlFor="file" className="ml-2 text-sm text-gray-700">
                    Dosyadan Yükle
                  </label>
                </div>
              </div>
            </div>
            
            {inputMethod === 'manual' ? (
              <div>
                <label htmlFor="domains" className="block mb-2 text-sm font-medium text-gray-700">
                  Domainler (Her satıra bir domain)
                </label>
                <textarea
                  id="domains"
                  rows={10}
                  className={`input font-mono ${errors.domains ? 'border-red-500' : ''}`}
                  value={domains}
                  onChange={(e) => setDomains(e.target.value)}
                  placeholder="example.com&#10;example.org&#10;example.net"
                  disabled={submitting}
                ></textarea>
                {errors.domains && <p className="mt-1 text-sm text-red-500">{errors.domains}</p>}
                <p className="mt-2 text-sm text-gray-500">
                  Her satıra bir domain girin. Alt alan adları ve protokoller olmadan giriş yapın (örn: example.com).
                </p>
              </div>
            ) : (
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Domain Listesi Dosyası
                </label>
                <div className={`flex items-center justify-center w-full ${errors.file ? 'border-red-500' : 'border-gray-300'} border-2 border-dashed rounded-lg h-32`}>
                  {!file ? (
                    <div className="flex flex-col items-center">
                      <FaUpload className="w-8 h-8 mb-2 text-gray-400" />
                      <p className="mb-2 text-sm text-gray-500">
                        <span className="font-semibold">Dosya yüklemek için tıklayın</span> veya sürükleyip bırakın
                      </p>
                      <p className="text-xs text-gray-500">.txt veya .csv dosyası (her satıra bir domain)</p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        accept=".txt,.csv"
                        onChange={handleFileChange}
                        disabled={submitting}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between w-full px-4">
                      <span className="text-sm text-gray-700">{file.name}</span>
                      <button
                        type="button"
                        onClick={clearFile}
                        className="p-1 text-gray-500 rounded-full hover:bg-gray-100"
                        disabled={submitting}
                      >
                        <FaTrash className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                {errors.file && <p className="mt-1 text-sm text-red-500">{errors.file}</p>}
                <p className="mt-2 text-sm text-gray-500">
                  Her satırda bir domain içeren bir metin dosyası yükleyin. Alt alan adları ve protokoller olmadan liste oluşturun (örn: example.com).
                </p>
              </div>
            )}
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="btn btn-secondary"
              disabled={submitting}
            >
              İptal
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="inline-block h-4 w-4 mr-2 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></span>
                  İşleniyor...
                </>
              ) : (
                'Listeyi Kaydet'
              )}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
} 