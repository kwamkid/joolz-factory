// src/components/ui/Sidebar.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  Menu,
  X,
  Home,
  Factory,
  Package,
  Users,
  Bottle,
  BarChart3,
  UserPlus,
  TrendingUp,
  ClipboardList,
  Settings,
  LogOut,
  ChevronRight
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  path: string;
  requiredRoles?: string[];
  badge?: number;
  subItems?: MenuItem[];
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, hasRole, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  // เมนูหลัก
  const menuItems: MenuItem[] = [
    {
      id: 'dashboard',
      label: 'หน้าหลัก',
      icon: Home,
      path: '/dashboard'
    },
    {
      id: 'production',
      label: 'การผลิต',
      icon: Factory,
      path: '/production',
      requiredRoles: ['operation', 'manager', 'admin'],
      subItems: [
        {
          id: 'production-planning',
          label: 'วางแผนการผลิต',
          icon: ClipboardList,
          path: '/production/planning',
          requiredRoles: ['manager', 'admin']
        },
        {
          id: 'production-orange',
          label: 'น้ำส้มคั้น',
          icon: Factory,
          path: '/production/orange'
        },
        {
          id: 'production-lemon',
          label: 'น้ำเลม่อน',
          icon: Factory,
          path: '/production/lemon'
        },
        {
          id: 'production-herbal',
          label: 'น้ำสมุนไพร',
          icon: Factory,
          path: '/production/herbal'
        }
      ]
    },
    {
      id: 'inventory',
      label: 'จัดการสต็อก',
      icon: Package,
      path: '/inventory',
      requiredRoles: ['manager', 'admin']
    },
    {
      id: 'suppliers',
      label: 'ซัพพลายเออร์',
      icon: Users,
      path: '/suppliers',
      requiredRoles: ['manager', 'admin']
    },
    {
      id: 'bottles',
      label: 'จัดการขวด',
      icon: Bottle,
      path: '/bottles',
      requiredRoles: ['manager', 'admin']
    },
    {
      id: 'reports',
      label: 'รายงาน',
      icon: BarChart3,
      path: '/reports',
      requiredRoles: ['manager', 'admin'],
      subItems: [
        {
          id: 'reports-production',
          label: 'รายงานการผลิต',
          icon: Factory,
          path: '/reports/production',
          requiredRoles: ['manager', 'admin']
        },
        {
          id: 'reports-cost',
          label: 'รายงานต้นทุน',
          icon: TrendingUp,
          path: '/reports/cost',
          requiredRoles: ['admin']
        }
      ]
    }
  ];

  // เมนูแอดมิน
  const adminMenuItems: MenuItem[] = [
    {
      id: 'admin-users',
      label: 'จัดการผู้ใช้',
      icon: UserPlus,
      path: '/admin/users',
      requiredRoles: ['admin']
    },
    {
      id: 'admin-financials',
      label: 'รายงานการเงิน',
      icon: TrendingUp,
      path: '/admin/financials',
      requiredRoles: ['admin']
    }
  ];

  // ตรวจสอบสิทธิ์การเข้าถึงเมนู
  const canAccessMenuItem = (item: MenuItem): boolean => {
    if (!item.requiredRoles) return true;
    return item.requiredRoles.some(role => hasRole(role as any));
  };

  // กรองเมนูตามสิทธิ์
  const filteredMenuItems = menuItems.filter(canAccessMenuItem);
  const filteredAdminItems = adminMenuItems.filter(canAccessMenuItem);

  // จัดการ expand/collapse submenu
  const toggleExpanded = (itemId: string) => {
    setExpandedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  // นำทางไปหน้าต่างๆ
  const handleNavigation = (path: string) => {
    router.push(path);
    onClose(); // ปิด sidebar ในมือถือ
  };

  // ตรวจสอบว่าเมนูนี้ active หรือไม่
  const isActive = (path: string): boolean => {
    if (path === '/dashboard') {
      return pathname === '/dashboard' || pathname === '/';
    }
    return pathname.startsWith(path);
  };

  // Auto-expand เมนูที่ active
  useEffect(() => {
    filteredMenuItems.forEach(item => {
      if (item.subItems && item.subItems.some(subItem => isActive(subItem.path))) {
        if (!expandedItems.includes(item.id)) {
          setExpandedItems(prev => [...prev, item.id]);
        }
      }
    });
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <>
      {/* Overlay สำหรับมือถือ */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed top-0 left-0 h-full w-80 bg-gray-900 border-r border-gray-700 z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 flex items-center justify-center">
              <img 
                src="/logo.svg" 
                alt="Joolz Factory" 
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Joolz Factory</h2>
              <p className="text-sm text-gray-400">ระบบจัดการโรงงาน</p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="lg:hidden p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User Info */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="h-12 w-12 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-xl flex items-center justify-center">
              <span className="text-black font-bold text-lg">
                {user?.name?.charAt(0) || 'U'}
              </span>
            </div>
            <div>
              <h3 className="font-semibold text-white">{user?.name}</h3>
              <p className="text-sm text-gray-400">
                {user?.roles.includes('admin') ? 'ผู้ดูแลระบบ' : 
                 user?.roles.includes('manager') ? 'ผู้จัดการ' : 'พนักงาน'}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="p-4 space-y-2">
          {/* เมนูหลัก */}
          {filteredMenuItems.map((item) => (
            <div key={item.id}>
              <button
                onClick={() => {
                  if (item.subItems) {
                    toggleExpanded(item.id);
                  } else {
                    handleNavigation(item.path);
                  }
                }}
                className={`
                  w-full flex items-center justify-between p-3 rounded-xl transition-all text-left
                  ${isActive(item.path) 
                    ? 'bg-yellow-500 text-black font-semibold' 
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                  }
                `}
              >
                <div className="flex items-center space-x-3">
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </div>
                
                {item.subItems && (
                  <ChevronRight 
                    className={`h-4 w-4 transition-transform ${
                      expandedItems.includes(item.id) ? 'rotate-90' : ''
                    }`} 
                  />
                )}
              </button>

              {/* Submenu */}
              {item.subItems && expandedItems.includes(item.id) && (
                <div className="ml-4 mt-2 space-y-1">
                  {item.subItems.filter(canAccessMenuItem).map((subItem) => (
                    <button
                      key={subItem.id}
                      onClick={() => handleNavigation(subItem.path)}
                      className={`
                        w-full flex items-center space-x-3 p-2 rounded-lg transition-all text-left text-sm
                        ${isActive(subItem.path)
                          ? 'bg-yellow-500 text-black font-semibold'
                          : 'text-gray-400 hover:text-white hover:bg-gray-800'
                        }
                      `}
                    >
                      <subItem.icon className="h-4 w-4 flex-shrink-0" />
                      <span>{subItem.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Admin Section */}
          {filteredAdminItems.length > 0 && (
            <>
              <div className="pt-6 pb-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3">
                  ผู้ดูแลระบบ
                </h4>
              </div>
              
              {filteredAdminItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavigation(item.path)}
                  className={`
                    w-full flex items-center space-x-3 p-3 rounded-xl transition-all text-left
                    ${isActive(item.path)
                      ? 'bg-yellow-500 text-black font-semibold'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800'
                    }
                  `}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span>{item.label}</span>
                </button>
              ))}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-700 bg-gray-900">
          <div className="space-y-2">
            <button
              onClick={() => handleNavigation('/settings')}
              className="w-full flex items-center space-x-3 p-3 rounded-xl text-gray-300 hover:text-white hover:bg-gray-800 transition-all text-left"
            >
              <Settings className="h-5 w-5" />
              <span>ตั้งค่า</span>
            </button>
            
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-3 p-3 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-all text-left"
            >
              <LogOut className="h-5 w-5" />
              <span>ออกจากระบบ</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// Mobile Menu Button Component
export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden p-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"
    >
      <Menu className="h-6 w-6" />
    </button>
  );
}