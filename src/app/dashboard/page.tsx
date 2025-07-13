// src/app/dashboard/page.tsx (ใช้ AppLayout)
'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/ui/AppLayout';
import { 
  Package, 
  Factory,
  ClipboardList,
  RefreshCw,
  Settings
} from 'lucide-react';

export default function Dashboard() {
  const { user, hasRole } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<'operation' | 'manager'>('operation');

  if (!user) return null;

  const isOperation = mode === 'operation';
  const canSwitchMode = hasRole('manager') || hasRole('admin');

  // Header Actions
  const headerActions = (
    <div className="flex items-center space-x-3">
      {canSwitchMode && (
        <button
          onClick={() => setMode(mode === 'operation' ? 'manager' : 'operation')}
          className="px-4 py-2 text-sm bg-yellow-500 text-black rounded-xl font-semibold hover:bg-yellow-400 transition-colors"
        >
          {isOperation ? '📱→📊' : '📊→📱'}
        </button>
      )}
    </div>
  );

  return (
    <AppLayout 
      title={isOperation ? '🎯 การผลิต' : '📊 จัดการระบบ'}
      headerActions={headerActions}
    >
      {/* Operation Mode UI */}
      {isOperation && (
        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto h-full">
          {/* Today's Summary */}
          <div 
            className="rounded-3xl p-6 text-white shadow-2xl border border-gray-700" 
            style={{ background: 'linear-gradient(135deg, #1f2937 0%, #374151 100%)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">วันนี้</h2>
              <RefreshCw className="h-6 w-6 text-yellow-400" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold mb-1 text-yellow-400">12</div>
                <div className="text-gray-300 text-sm">Batch ผลิต</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold mb-1 text-yellow-400">450</div>
                <div className="text-gray-300 text-sm">ขวดผลิตแล้ว</div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-6">
            
            {/* Production Cards */}
            <div 
              className="operation-card border border-gray-600 shadow-2xl text-white"
              style={{ background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)' }}
            >
              <Factory className="operation-icon text-white" />
              <h3 className="text-2xl font-bold mb-3 text-white">🍊 น้ำส้มคั้น</h3>
              <p className="text-white/90 mb-6 text-base">ผลิตน้ำส้มสดใหม่</p>
              <button 
                onClick={() => router.push('/production/orange')}
                className="operation-button bg-white text-red-600 hover:bg-gray-100 font-bold shadow-lg hover:shadow-xl"
              >
                เริ่มผลิต
              </button>
            </div>

            <div 
              className="operation-card border border-gray-600 shadow-2xl text-white"
              style={{ background: 'linear-gradient(135deg, #eab308 0%, #facc15 100%)' }}
            >
              <Factory className="operation-icon text-white" />
              <h3 className="text-2xl font-bold mb-3 text-black">🍋 น้ำเลม่อน</h3>
              <p className="text-black/80 mb-6 text-base">ผลิตน้ำเลม่อนสด</p>
              <button 
                onClick={() => router.push('/production/lemon')}
                className="operation-button bg-black text-yellow-400 hover:bg-gray-800 font-bold shadow-lg hover:shadow-xl"
              >
                เริ่มผลิต
              </button>
            </div>

            <div 
              className="operation-card border border-gray-600 shadow-2xl text-white"
              style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' }}
            >
              <Factory className="operation-icon text-white" />
              <h3 className="text-2xl font-bold mb-3 text-white">🌿 น้ำสมุนไพร</h3>
              <p className="text-white/90 mb-6 text-base">ผลิตน้ำสมุนไพรเพื่อสุขภาพ</p>
              <button 
                onClick={() => router.push('/production/herbal')}
                className="operation-button bg-white text-green-600 hover:bg-gray-100 font-bold shadow-lg hover:shadow-xl"
              >
                เริ่มผลิต
              </button>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-4 mt-8">
              <button 
                onClick={() => router.push('/inventory')}
                className="operation-card bg-gray-800 border border-gray-600 hover:border-yellow-500 hover:shadow-xl transition-all"
              >
                <Package className="h-10 w-10 text-yellow-400 mx-auto mb-3" />
                <span className="text-yellow-400 font-semibold text-base">สต็อกวัตถุดิบ</span>
              </button>
              
              <button 
                onClick={() => router.push('/tasks')}
                className="operation-card bg-gray-800 border border-gray-600 hover:border-yellow-500 hover:shadow-xl transition-all"
              >
                <ClipboardList className="h-10 w-10 text-yellow-400 mx-auto mb-3" />
                <span className="text-yellow-400 font-semibold text-base">งานที่ต้องทำ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manager/Admin Mode UI */}
      {!isOperation && (
        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto h-full">
          
          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div 
              className="card text-center border-0 shadow-lg"
              style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
            >
              <div className="text-3xl font-bold text-white">12</div>
              <div className="text-sm text-white/90 font-medium mt-1">Batch วันนี้</div>
            </div>
            <div 
              className="card text-center border-0 shadow-lg"
              style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}
            >
              <div className="text-3xl font-bold text-white">450</div>
              <div className="text-sm text-white/90 font-medium mt-1">ขวดผลิตแล้ว</div>
            </div>
            <div 
              className="card text-center border-0 shadow-lg"
              style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}
            >
              <div className="text-3xl font-bold text-white">85%</div>
              <div className="text-sm text-white/90 font-medium mt-1">ประสิทธิภาพ</div>
            </div>
            <div 
              className="card text-center border-0 shadow-lg"
              style={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' }}
            >
              <div className="text-3xl font-bold text-white">3</div>
              <div className="text-sm text-white/90 font-medium mt-1">สูตรใหม่</div>
            </div>
          </div>

          {/* Welcome Message */}
          <div className="text-center py-12">
            <div className="text-6xl mb-4">👋</div>
            <h2 className="text-2xl font-bold text-white mb-2">
              ยินดีต้อนรับ, {user.name}!
            </h2>
            <p className="text-gray-300 text-lg">
              เลือกเมนูจากแถบด้านซ้ายเพื่อเริ่มใช้งาน
            </p>
          </div>
        </div>
      )}
    </AppLayout>
  );
}