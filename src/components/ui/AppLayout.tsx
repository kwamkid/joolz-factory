// src/components/ui/AppLayout.tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import Sidebar, { MobileMenuButton } from '@/components/ui/Sidebar';
import { FullScreenLoading } from '@/components/ui/LoadingSpinner';

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  showBackButton?: boolean;
  headerActions?: React.ReactNode;
}

export default function AppLayout({ 
  children, 
  title,
  showBackButton = false,
  headerActions 
}: AppLayoutProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // แสดง loading หากยังไม่ได้ login
  if (loading) {
    return <FullScreenLoading text="กำลังโหลด..." />;
  }

  // Redirect ถ้าไม่ได้ login
  if (!user) {
    router.push('/login');
    return <FullScreenLoading text="กำลังเปลี่ยนหน้า..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-0" style={{ background: '#00231F' }}>
        {/* Header Bar */}
        <header className="bg-black/20 backdrop-blur-md shadow-lg border-b border-gray-700 sticky top-0 z-30">
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center space-x-4">
              <MobileMenuButton onClick={() => setSidebarOpen(true)} />
              
              {showBackButton && (
                <button
                  onClick={() => router.back()}
                  className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-xl transition-all"
                >
                  ←
                </button>
              )}
              
              {title && (
                <div>
                  <h1 className="text-xl font-bold text-white">{title}</h1>
                </div>
              )}
            </div>

            {/* Header Actions */}
            {headerActions && (
              <div className="flex items-center space-x-3">
                {headerActions}
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}