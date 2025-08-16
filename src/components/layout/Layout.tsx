// components/layout/Layout.tsx
import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuth } from '@/lib/auth-context';

interface LayoutProps {
  children: React.ReactNode;
  showSearch?: boolean;
  headerActions?: React.ReactNode;
}

export default function Layout({ 
  children,
  showSearch = false,
  headerActions
}: LayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  
  // State สำหรับ Sidebar mobile
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  
  // State สำหรับ search
  const [searchValue, setSearchValue] = React.useState('');

  const handleNavigate = (path: string) => {
    // แก้ path ถ้าเป็น /dashboard ให้เป็น /
    if (path === '/dashboard') {
      router.push('/');
    } else {
      router.push(path);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-secondary flex">
      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50
        transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 transition-transform duration-300 ease-in-out
      `}>
        <Sidebar 
          currentPath={pathname}
          userRole={user?.role || 'operation'}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        />
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <Header
          showSearch={showSearch}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          actions={headerActions}
          onMenuClick={() => setSidebarOpen(true)}
          userName={user?.name || 'User'}
          userRole={user?.role === 'admin' ? 'ผู้ดูแลระบบ' : 
                   user?.role === 'manager' ? 'ผู้จัดการ' : 'พนักงาน'}
          onLogout={handleLogout}
        />
        
        {/* Page Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}