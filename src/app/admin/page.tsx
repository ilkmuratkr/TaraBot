'use client';

import { useState, useEffect, useRef } from 'react';
import Layout from '@/components/Layout';
import { FaSync } from 'react-icons/fa';

export default function AdminPage() {
  const [apiKey, setApiKey] = useState('tarabot-admin-key');
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  useEffect(() => {
    // iframe yüklendikten sonra bir kez reload yapalım
    if (iframeRef.current) {
      iframeRef.current.onload = () => {
        setIframeLoaded(true);
      };
      
      iframeRef.current.onerror = () => {
        setIframeError(true);
      };
    }
  }, []);
  
  const reloadIframe = () => {
    if (iframeRef.current) {
      setIframeLoaded(false);
      iframeRef.current.src = `http://localhost:3003/admin/queues?apiKey=${apiKey}`;
    }
  };
  
  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Kuyruk Yönetimi</h1>
          
          <button 
            onClick={reloadIframe}
            className="flex items-center px-3 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
          >
            <FaSync className="w-4 h-4 mr-2" /> Yenile
          </button>
        </div>
        
        {iframeError && (
          <div className="p-4 mb-4 text-red-600 bg-red-100 rounded-lg">
            Backend servisi çalışmıyor veya bağlantı kurulamadı. Lütfen backend servisinin çalıştığından emin olun.
          </div>
        )}
        
        <div className="w-full h-[calc(100vh-140px)] bg-white rounded-lg shadow-sm overflow-hidden">
          <iframe 
            ref={iframeRef}
            src={`http://localhost:3003/admin/queues?apiKey=${apiKey}`}
            className="w-full h-full border-0"
            style={{ height: 'calc(100vh - 140px)' }}
          />
        </div>
      </div>
    </Layout>
  );
} 