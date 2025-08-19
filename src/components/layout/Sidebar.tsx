// src/components/layout/Sidebar.tsx

import React, { useState, useEffect } from 'react';
import { 
  Home, Factory, Package, Users, FlaskConical, BarChart3, 
  UserPlus, TrendingUp, ClipboardList, Menu, X, ChevronRight,
  Leaf
} from 'lucide-react';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  path: string;
  requiredRoles?: string[];
  subItems?: MenuItem[];
}

interface SidebarProps {
  currentPath?: string;
  userRole?: 'operation' | 'manager' | 'admin';
  onNavigate?: (path: string) => void;
  onLogout?: () => void;
}

export default function Sidebar({ 
  currentPath = '/dashboard',
  userRole = 'operation',
  onNavigate = () => {},
  onLogout = () => {}
}: SidebarProps) {
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  // Menu Items Configuration
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
      icon: FlaskConical,
      path: '/bottles',
      requiredRoles: ['manager', 'admin']
    },
    {
      id: 'products',
      label: 'จัดการผลิตภัณฑ์',
      icon: Package,
      path: '/products',
      requiredRoles: ['manager', 'admin']
    },
    {
      id: 'raw-materials',
      label: 'จัดการวัตถุดิบ',
      icon: Leaf,
      path: '/raw-materials',
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
          path: '/reports/production'
        },
        {
          id: 'reports-financial',
          label: 'รายงานการเงิน',
          icon: TrendingUp,
          path: '/reports/financial',
          requiredRoles: ['admin']
        }
      ]
    }
  
  ];

  const adminItems: MenuItem[] = [
    {
      id: 'users',
      label: 'จัดการผู้ใช้',
      icon: UserPlus,
      path: '/users',
      requiredRoles: ['admin']
    }
  ];

  // Check if user has access to menu item
  const hasAccess = (item: MenuItem): boolean => {
    if (!item.requiredRoles) return true;
    return item.requiredRoles.includes(userRole);
  };

  // Filter menu items based on role
  const filteredMenuItems = menuItems.filter(item => hasAccess(item));
  const filteredAdminItems = adminItems.filter(item => hasAccess(item));

  // Toggle submenu
  const toggleExpanded = (itemId: string) => {
    setExpandedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  // Check if path is active
  const isActive = (path: string): boolean => {
    if (path === '/dashboard') {
      return currentPath === '/dashboard';
    }
    return currentPath === path || currentPath.startsWith(path + '/');
  };

  // Handle navigation
  const handleNavigate = (path: string) => {
    onNavigate(path);
  };

  // Auto-expand active menu
  useEffect(() => {
    filteredMenuItems.forEach(item => {
      if (item.subItems && item.subItems.some(sub => isActive(sub.path))) {
        setExpandedItems(prev => {
          if (!prev.includes(item.id)) {
            return [...prev, item.id];
          }
          return prev;
        });
      }
    });
  }, [currentPath]);

  const MenuItem = ({ item, level = 0 }: { item: MenuItem; level?: number }) => {
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const isExpanded = expandedItems.includes(item.id);
    const active = isActive(item.path);

    return (
      <div>
        <button
          onClick={() => {
            if (hasSubItems) {
              toggleExpanded(item.id);
            } else {
              handleNavigate(item.path);
            }
          }}
          className={`
            w-full flex items-center justify-between px-4 py-3 rounded-lg
            transition-all duration-200 text-left
            ${active 
              ? 'bg-primary text-secondary font-semibold' 
              : 'text-gray-300 hover:text-white hover:bg-gray-800'
            }
            ${level > 0 ? 'ml-4 text-sm' : ''}
          `}
        >
          <div className="flex items-center gap-3">
            <item.icon className={`${level > 0 ? 'h-4 w-4' : 'h-5 w-5'} flex-shrink-0`} />
            <span>{item.label}</span>
          </div>
          {hasSubItems && (
            <ChevronRight 
              className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            />
          )}
        </button>

        {/* Sub Items */}
        {hasSubItems && isExpanded && item.subItems && (
          <div className="mt-1 space-y-1">
            {item.subItems
              .filter(hasAccess)
              .map(subItem => (
                <MenuItem key={subItem.id} item={subItem} level={level + 1} />
              ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Sidebar */}
      <aside className={`
        h-full w-[280px] bg-gray-900 border-r border-gray-700
        overflow-y-auto
      `}>
        {/* Header with Logo */}
        <div className="flex items-center h-16 px-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <img 
              src="/logo.svg" 
              alt="Joolz Factory" 
              className="h-12 w-12 object-contain"
            />
            <div>
              <h2 className="text-lg font-bold text-white">Joolz Factory</h2>
              <p className="text-xs text-gray-400">ระบบจัดการโรงงาน</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2 flex-1">
          {/* Main Menu */}
          {filteredMenuItems.map(item => (
            <MenuItem key={item.id} item={item} />
          ))}

          {/* Admin Section */}
          {filteredAdminItems.length > 0 && (
            <>
              <div className="pt-6 pb-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4">
                  ผู้ดูแลระบบ
                </h4>
              </div>
              {filteredAdminItems.map(item => (
                <MenuItem key={item.id} item={item} />
              ))}
            </>
          )}
        </nav>
      </aside>
    </>
  );
}