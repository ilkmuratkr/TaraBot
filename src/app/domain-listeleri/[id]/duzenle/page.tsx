'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { FaArrowLeft, FaSave } from 'react-icons/fa';
import { DomainListService } from '@/services/DomainListService';
import { DomainList } from '@/models/DomainList';

export default function EditDomainListPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  
  const [domainList, setDomainList] = useState<DomainList | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [name, setName] = useState('');
  const [domains, setDomains] = useState('');
  
  const [errors, setErrors] = useState({
    name: '',
    domains: '',
  });
  
  useEffect(() => {
    const fetchDomainList = async () => {
      try {
        const list = await DomainListService.getById(id);
        setDomainList(list);
        
        if (list) {
          setName(list.name);
          // Domainleri metin olarak hazırla
          const domainsText = list.domains.map(d => d.domain).join('\n');
          setDomains(domainsText);
        }
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
  
  const validateForm = () => {
    const newErrors = {
      name: '',
      domains: '',
    };
    
    let isValid = true;

    if (!name.trim()) {
      newErrors.name = 'Liste adı gerekli';
      isValid = false;
    }

    if (!domains.trim()) {
      newErrors.domains = 'En az bir domain girmelisiniz';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!domainList || !validateForm()) return;
    
    try {
      setSaving(true);
      
      // Domainleri satır satır ayır ve işle
      const domainArray = domains
        .split('\n')
        .map(d => d.trim())
        .filter(d => d.length > 0 && d.includes('.'));
      
      // Yeni domain objeleri oluştur
      const domainObjects = domainArray.map(domain => ({
        id: Math.random().toString(36).substring(2, 15),
        domain
      }));
      
      // Domain listesini güncelle
      await DomainListService.update(id, {
        name,
        domains: domainObjects,
      });
      
      router.push(`/domain-listeleri/${id}`);
    } catch (error) {
      console.error('Domain listesi güncellenirken hata:', error);
      alert('Domain listesi güncellenirken bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setSaving(false);
    }
  };
  
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
  
  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center mb-6">
          <Link href={`/domain-listeleri/${id}`} className="text-gray-500 hover:text-gray-700 mr-3">
            <FaArrowLeft />
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">Domain Listesini Düzenle</h1>
        </div>
        
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
                disabled={saving}
              />
              {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
            </div>
            
            <div>
              <label htmlFor="domains" className="block mb-2 text-sm font-medium text-gray-700">
                Domainler (Her satıra bir domain)
              </label>
              <textarea
                id="domains"
                rows={15}
                className={`input font-mono ${errors.domains ? 'border-red-500' : ''}`}
                value={domains}
                onChange={(e) => setDomains(e.target.value)}
                placeholder="example.com&#10;example.org&#10;example.net"
                disabled={saving}
              ></textarea>
              {errors.domains && <p className="mt-1 text-sm text-red-500">{errors.domains}</p>}
              <p className="mt-2 text-sm text-gray-500">
                Her satıra bir domain girin. Alt alan adları ve protokoller olmadan giriş yapın (örn: example.com).
              </p>
            </div>
          </div>
          
          <div className="flex justify-end space-x-3">
            <Link
              href={`/domain-listeleri/${id}`}
              className="btn btn-secondary"
            >
              İptal
            </Link>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? (
                <>
                  <span className="inline-block h-4 w-4 mr-2 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></span>
                  Kaydediliyor...
                </>
              ) : (
                <>
                  <FaSave className="mr-2" />
                  Değişiklikleri Kaydet
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
} 