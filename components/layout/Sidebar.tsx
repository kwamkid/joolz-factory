// Path: src/components/layout/Sidebar.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  Home,
  Factory,
  Package,
  Users,
  Droplets,
  Leaf,
  UserCircle,
  ShoppingCart,
  DollarSign,
  BarChart3,
  Settings,
  Menu,
  X,
  ChevronRight,
  LogOut,
  Box,
  ArrowUpDown,
  FileText,
  ClipboardList,
  Boxes,
  Package2,
  Wine
} from 'lucide-react';

// Menu item interface
interface MenuItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: string[];
  badge?: number;
}

// Menu section interface
interface MenuSection {
  title: string;
  items: MenuItem[];
}

// Menu sections configuration
const menuSections: MenuSection[] = [
  // Operation
  {
    title: 'Operation',
    items: [
      {
        label: 'การผลิต',
        href: '/production',
        icon: <Factory className="w-5 h-5" />,
        roles: ['admin', 'manager', 'operation']
      }
    ]
  },
  // Data Management - ข้อมูลหลักที่ key ครั้งเดียว
  {
    title: 'จัดการข้อมูล',
    items: [
      {
        label: 'สินค้าผลิต',
        href: '/products',
        icon: <Box className="w-5 h-5" />,
        roles: ['admin', 'manager']
      },
      {
        label: 'ขวด',
        href: '/bottles',
        icon: <Wine className="w-5 h-5" />,
        roles: ['admin', 'manager']
      },
      {
        label: 'วัตถุดิบ',
        href: '/raw-materials',
        icon: <Leaf className="w-5 h-5" />,
        roles: ['admin', 'manager']
      },
      {
        label: 'ซัพพลายเออร์',
        href: '/suppliers',
        icon: <Users className="w-5 h-5" />,
        roles: ['admin', 'manager']
      }
    ]
  },
  // Stock Management - รวมสต็อกและธุรกรรมซื้อ-ออก
  {
    title: 'สต็อก และ ซื้อ-ออก',
    items: [
      {
        label: 'สต็อกขวด / ซื้อ-ออก',
        href: '/bottle-stock',
        icon: <ArrowUpDown className="w-5 h-5" />,
        roles: ['admin', 'manager', 'operation']
      },
      {
        label: 'สต็อกวัตถุดิบ / ซื้อ-ออก',
        href: '/stock',
        icon: <ArrowUpDown className="w-5 h-5" />,
        roles: ['admin', 'manager', 'operation']
      }
    ]
  },
  // Sales System
  {
    title: 'ระบบการขาย',
    items: [
      {
        label: 'สินค้าพร้อมขาย',
        href: '/sellable-products',
        icon: <Package2 className="w-5 h-5" />,
        roles: ['admin', 'manager', 'sales']
      },
      {
        label: 'ลูกค้า',
        href: '/customers',
        icon: <UserCircle className="w-5 h-5" />,
        roles: ['admin', 'manager', 'sales']
      },
      {
        label: 'คำสั่งซื้อ',
        href: '/orders',
        icon: <ShoppingCart className="w-5 h-5" />,
        roles: ['admin', 'manager', 'sales']
      }
    ]
  },
  // Reports
  {
    title: 'รายงาน',
    items: [
      {
        label: 'รายงานยอดขาย',
        href: '/reports/sales',
        icon: <BarChart3 className="w-5 h-5" />,
        roles: ['admin', 'manager', 'sales']
      },
      {
        label: 'รายงานยอดค้าง',
        href: '/reports/pending',
        icon: <FileText className="w-5 h-5" />,
        roles: ['admin', 'manager', 'sales']
      }
    ]
  }
];

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { userProfile, signOut } = useAuth();

  // Close sidebar on route change (mobile)
  useEffect(() => {
    const handleRouteChange = () => {
      if (window.innerWidth < 1024) {
        setIsOpen(false);
      }
    };

    handleRouteChange();
  }, [pathname]);

  // Filter menu sections based on user role
  const filteredSections = menuSections
    .map(section => ({
      ...section,
      items: section.items.filter(item =>
        userProfile && item.roles.includes(userProfile.role)
      )
    }))
    .filter(section => section.items.length > 0);

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-[#00231F] border border-[#E9B308]/20 rounded-lg"
      >
        {isOpen ? (
          <X className="w-6 h-6 text-[#E9B308]" />
        ) : (
          <Menu className="w-6 h-6 text-[#E9B308]" />
        )}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-[#00231F] border-r border-[#E9B308]/20 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-16 border-b border-[#E9B308]/20">
            <h1 className="text-2xl font-bold text-[#E9B308]">
              JOOLZ<span className="text-white">Factory</span>
            </h1>
          </div>

          {/* User Info */}
          {userProfile && (
            <div className="p-4 border-b border-[#E9B308]/20">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-[#E9B308]/20 rounded-full flex items-center justify-center">
                  <span className="text-[#E9B308] font-semibold">
                    {userProfile.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-white text-sm font-medium">
                    {userProfile.name}
                  </p>
                  <p className="text-[#E9B308] text-xs">
                    {userProfile.role === 'admin' && 'ผู้ดูแลระบบ'}
                    {userProfile.role === 'manager' && 'ผู้จัดการ'}
                    {userProfile.role === 'operation' && 'พนักงานผลิต'}
                    {userProfile.role === 'sales' && 'ฝ่ายขาย'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4">
            {/* Dashboard */}
            <Link
              href="/dashboard"
              className={`flex items-center space-x-3 px-3 py-2 rounded-lg mb-2 transition-colors ${
                pathname === '/dashboard'
                  ? 'bg-[#E9B308] text-[#00231F]'
                  : 'text-gray-300 hover:bg-[#E9B308]/10 hover:text-[#E9B308]'
              }`}
            >
              <Home className="w-5 h-5" />
              <span className="text-[16px] font-medium">Dashboard</span>
            </Link>

            {/* Menu Sections */}
            {filteredSections.map((section, sectionIndex) => (
              <div key={sectionIndex}>
                <h3 className="text-xs text-gray-500 uppercase tracking-wider mt-6 mb-2">
                  {section.title}
                </h3>
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center space-x-3 px-3 py-2 rounded-lg mb-1 transition-colors ${
                      pathname === item.href
                        ? 'bg-[#E9B308] text-[#00231F]'
                        : 'text-gray-300 hover:bg-[#E9B308]/10 hover:text-[#E9B308]'
                    }`}
                  >
                    {item.icon}
                    <span className="text-[16px] font-medium">{item.label}</span>
                    {item.badge && (
                      <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            ))}

            {/* Admin Section */}
            {userProfile?.role === 'admin' && (
              <div>
                <h3 className="text-xs text-gray-500 uppercase tracking-wider mt-6 mb-2">
                  ผู้ดูแลระบบ
                </h3>
                <Link
                  href="/users"
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg mb-1 transition-colors ${
                    pathname === '/users'
                      ? 'bg-[#E9B308] text-[#00231F]'
                      : 'text-gray-300 hover:bg-[#E9B308]/10 hover:text-[#E9B308]'
                  }`}
                >
                  <Users className="w-5 h-5" />
                  <span className="text-[16px] font-medium">จัดการผู้ใช้</span>
                </Link>
                <Link
                  href="/settings"
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg mb-1 transition-colors ${
                    pathname === '/settings'
                      ? 'bg-[#E9B308] text-[#00231F]'
                      : 'text-gray-300 hover:bg-[#E9B308]/10 hover:text-[#E9B308]'
                  }`}
                >
                  <Settings className="w-5 h-5" />
                  <span className="text-[16px] font-medium">ตั้งค่าระบบ</span>
                </Link>
              </div>
            )}
          </nav>

          {/* Logout Button */}
          <div className="p-4 border-t border-[#E9B308]/20">
            <button
              onClick={() => signOut()}
              className="flex items-center space-x-3 w-full px-3 py-2 text-gray-300 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-[16px] font-medium">ออกจากระบบ</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}