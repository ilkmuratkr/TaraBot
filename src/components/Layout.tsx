'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import { FaBars, FaSearch } from 'react-icons/fa';
import Link from 'next/link';

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Pencere boyutu değiştiğinde sidebar durumunu kontrol et
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };
    
    // İlk yüklemede boyutu kontrol et
    handleResize();
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div
        className={`fixed inset-0 z-40 lg:hidden transition-opacity duration-300 ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="absolute inset-0 bg-gray-600 opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="absolute inset-y-0 left-0 flex flex-col w-64 h-full bg-white">
          <Sidebar />
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className={`hidden lg:flex transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-0'}`}>
        <Sidebar />
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
          <div className="flex items-center">
            <button
              className="p-2 text-gray-600 rounded-md lg:hidden hover:text-gray-900 hover:bg-gray-100 focus:outline-none"
              onClick={() => setSidebarOpen(true)}
            >
              <FaBars className="w-5 h-5" />
            </button>
            <button
              className="hidden p-2 text-gray-600 rounded-md lg:block hover:text-gray-900 hover:bg-gray-100 focus:outline-none"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <FaBars className="w-5 h-5" />
            </button>
            
            <h1 className="ml-2 font-medium sm:text-lg text-gray-700">
              {getCurrentPageTitle(pathname)}
            </h1>
          </div>
          
          <div className="flex items-center space-x-3">
            {pathname === '/' && (
              <Link 
                href="/yeni-tarama" 
                className="btn btn-primary"
              >
                Yeni Tarama
              </Link>
            )}
            
            {pathname === '/domain-listeleri' && (
              <Link 
                href="/domain-listeleri/ekle" 
                className="btn btn-primary"
              >
                Yeni Liste Ekle
              </Link>
            )}
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

// Geçerli sayfa başlığını belirleyen yardımcı fonksiyon
function getCurrentPageTitle(pathname: string): string {
  if (pathname === '/') return 'TaraBot - Dashboard';
  if (pathname.startsWith('/domain-listeleri')) {
    if (pathname === '/domain-listeleri') return 'Domain Listeleri';
    if (pathname.includes('/ekle')) return 'Yeni Domain Listesi';
    if (pathname.includes('/duzenle')) return 'Domain Listesi Düzenle';
    return 'Domain Listesi Detayları';
  }
  if (pathname.startsWith('/yeni-tarama')) return 'Yeni Tarama Başlat';
  if (pathname.startsWith('/tarama-gecmisi')) return 'Tarama Geçmişi';
  if (pathname.startsWith('/ayarlar')) return 'Ayarlar';
  
  return 'TaraBot';
} 