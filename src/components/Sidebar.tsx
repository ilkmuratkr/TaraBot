'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FaHome, FaList, FaSearch, FaHistory, FaCog, FaShieldAlt, FaSitemap, FaNetworkWired } from 'react-icons/fa';

interface SidebarLink {
  href: string;
  label: string;
  icon: React.ReactNode;
}

export default function Sidebar() {
  const pathname = usePathname();
  
  const links: SidebarLink[] = [
    {
      href: '/',
      label: 'Anasayfa',
      icon: <FaHome className="w-5 h-5" />,
    },
    {
      href: '/domain-listeleri',
      label: 'Domain Listeleri',
      icon: <FaList className="w-5 h-5" />,
    },
    {
      href: '/yeni-tarama',
      label: 'Yeni Tarama',
      icon: <FaSearch className="w-5 h-5" />,
    },
    {
      href: '/tarama-gecmisi',
      label: 'Tarama Geçmişi',
      icon: <FaHistory className="w-5 h-5" />,
    },
    {
      href: '/subfinder',
      label: 'SubFinder',
      icon: <FaSitemap className="w-5 h-5" />,
    },
    {
      href: '/reverseip',
      label: 'Reverse IP',
      icon: <FaNetworkWired className="w-5 h-5" />,
    },
    {
      href: '/ayarlar',
      label: 'Ayarlar',
      icon: <FaCog className="w-5 h-5" />,
    },
    {
      href: '/admin',
      label: 'Admin Panel',
      icon: <FaShieldAlt className="w-5 h-5" />,
    },
  ];

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200 w-64">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-primary-600">TaraBot</h1>
        <p className="text-sm text-gray-500">Web Tarama Botu</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {links.map((link) => {
          const isActive = pathname === link.href;
          
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className={`mr-3 ${isActive ? 'text-primary-700' : 'text-gray-500'}`}>
                {link.icon}
              </span>
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-gray-200">
        <div className="text-xs text-gray-500">
          TaraBot v0.1.0
        </div>
      </div>
    </div>
  );
} 