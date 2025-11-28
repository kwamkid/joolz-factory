'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import {
  Package,
  AlertTriangle,
  Factory,
  Wine,
  Leaf,
  Truck,
  Phone,
  LucideIcon,
  ChevronRight
} from 'lucide-react';

// Define color type
type StatColor = 'blue' | 'green' | 'yellow' | 'red';

// Interfaces
interface ProductionBatch {
  id: string;
  batchNumber: string;
  productName: string;
  status: string;
  quantity: number;
  createdAt: string;
}

interface LowStockItem {
  id: string;
  name: string;
  currentStock: number;
  minStock: number;
  unit: string;
  shortage: number;
}

interface LowStockBottle {
  id: string;
  size: string;
  capacityMl: number;
  currentStock: number;
  minStock: number;
  shortage: number;
}

interface DeliveryOrder {
  id: string;
  orderNumber: string;
  deliveryDate: string;
  status: string;
  totalAmount: number;
  customer: {
    id: string;
    name: string;
    phone?: string;
  };
}

interface DashboardStats {
  todayProduction: {
    count: number;
    batches: ProductionBatch[];
  };
  lowStockMaterials: {
    count: number;
    items: LowStockItem[];
  };
  lowStockBottles: {
    count: number;
    items: LowStockBottle[];
  };
  todayDeliveries: {
    count: number;
    orders: DeliveryOrder[];
  };
}

// Stat Card Component
function StatCard({
  title,
  value,
  icon: Icon,
  color = 'blue',
  onClick
}: {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: StatColor;
  onClick?: () => void;
}) {
  const colorClasses: Record<StatColor, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500'
  };

  return (
    <div
      className={`bg-white rounded-lg shadow p-6 ${onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`${colorClasses[color]} p-3 rounded-lg`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch dashboard stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();

        const response = await fetch('/api/dashboard', {
          headers: {
            'Authorization': `Bearer ${sessionData?.session?.access_token || ''}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch dashboard stats');
        }

        const result = await response.json();
        setStats(result.stats);
      } catch (error) {
        console.error('Error fetching stats:', error);
        setError('ไม่สามารถโหลดข้อมูลได้');
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading && userProfile) {
      fetchStats();
    }
  }, [authLoading, userProfile]);

  // Check auth and redirect if needed
  useEffect(() => {
    if (!authLoading && !userProfile) {
      router.push('/login');
    }
  }, [userProfile, authLoading, router]);

  // Show loading while checking auth
  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#00231F]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#E9B308] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  // If no profile after loading, don't render (will redirect)
  if (!userProfile) {
    return null;
  }

  return (
    <Layout
      title="Dashboard"
      breadcrumbs={[
        { label: 'หน้าแรก' }
      ]}
    >
      {/* Welcome Message */}
      <div className="mb-6">
        <h2 className="text-xl text-gray-700">
          สวัสดี, {userProfile.name || 'ผู้ใช้งาน'} 👋
        </h2>
        <p className="text-gray-500">
          {userProfile.role === 'admin' && 'ภาพรวมระบบทั้งหมด'}
          {userProfile.role === 'manager' && 'ภาพรวมการผลิตและสต็อก'}
          {userProfile.role === 'operation' && 'งานผลิตประจำวัน'}
          {userProfile.role === 'sales' && 'ภาพรวมการขายและลูกค้า'}
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatCard
          title="การผลิตวันนี้"
          value={`${stats?.todayProduction.count || 0} รายการ`}
          icon={Factory}
          color="blue"
        />
        <StatCard
          title="วัตถุดิบใกล้หมด"
          value={`${stats?.lowStockMaterials.count || 0} รายการ`}
          icon={Leaf}
          color={stats && stats.lowStockMaterials.count > 0 ? 'yellow' : 'green'}
        />
        <StatCard
          title="ขวดใกล้หมด"
          value={`${stats?.lowStockBottles.count || 0} รายการ`}
          icon={Wine}
          color={stats && stats.lowStockBottles.count > 0 ? 'yellow' : 'green'}
        />
        <StatCard
          title="ส่งของวันนี้"
          value={`${stats?.todayDeliveries.count || 0} ออเดอร์`}
          icon={Truck}
          color="blue"
        />
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Production */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              การผลิตวันนี้
            </h3>
            <Link
              href="/production"
              className="text-[#E9B308] hover:text-[#d4a307] text-sm font-medium flex items-center"
            >
              ดูทั้งหมด
              <ChevronRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
          <div className="space-y-3">
            {stats?.todayProduction.batches && stats.todayProduction.batches.length > 0 ? (
              stats.todayProduction.batches.slice(0, 5).map((batch) => (
                <div key={batch.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{batch.batchNumber}</p>
                    <p className="text-xs text-gray-600">{batch.productName} - {batch.quantity} ขวด</p>
                    <p className="text-xs text-gray-500">
                      สถานะ: {batch.status === 'completed' ? 'เสร็จสิ้น' : batch.status === 'in_progress' ? 'กำลังผลิต' : 'วางแผน'}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm text-center py-4">ยังไม่มีการผลิตวันนี้</p>
            )}
          </div>
        </div>

        {/* Today's Deliveries */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              ลูกค้าที่ต้องส่งวันนี้
            </h3>
            <Link
              href="/orders"
              className="text-[#E9B308] hover:text-[#d4a307] text-sm font-medium flex items-center"
            >
              ดูทั้งหมด
              <ChevronRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
          <div className="space-y-3">
            {stats?.todayDeliveries.orders && stats.todayDeliveries.orders.length > 0 ? (
              stats.todayDeliveries.orders.slice(0, 5).map((order) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{order.customer.name}</p>
                    <p className="text-xs text-gray-600">Order: {order.orderNumber}</p>
                    {order.customer.phone && (
                      <p className="text-xs text-gray-500 flex items-center mt-1">
                        <Phone className="w-3 h-3 mr-1" />
                        {order.customer.phone}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-[#E9B308]">
                      ฿{order.totalAmount.toLocaleString()}
                    </p>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-gray-500 text-sm text-center py-4">ไม่มีการส่งของวันนี้</p>
            )}
          </div>
        </div>

        {/* Low Stock Materials */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Leaf className="w-5 h-5 mr-2 text-yellow-500" />
              วัตถุดิบใกล้หมด
            </h3>
            <Link
              href="/stock"
              className="text-[#E9B308] hover:text-[#d4a307] text-sm font-medium flex items-center"
            >
              จัดการ
              <ChevronRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
          <div className="space-y-2">
            {stats?.lowStockMaterials.items && stats.lowStockMaterials.items.length > 0 ? (
              stats.lowStockMaterials.items.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center justify-between p-2 bg-yellow-50 rounded">
                  <div className="flex items-center space-x-3">
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-600">
                        คงเหลือ: {item.currentStock} {item.unit} (ต่ำกว่า {item.minStock} {item.unit})
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm text-center py-4">วัตถุดิบเพียงพอทั้งหมด</p>
            )}
          </div>
        </div>

        {/* Low Stock Bottles */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Wine className="w-5 h-5 mr-2 text-yellow-500" />
              ขวดใกล้หมด
            </h3>
            <Link
              href="/bottle-stock"
              className="text-[#E9B308] hover:text-[#d4a307] text-sm font-medium flex items-center"
            >
              จัดการ
              <ChevronRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
          <div className="space-y-2">
            {stats?.lowStockBottles.items && stats.lowStockBottles.items.length > 0 ? (
              stats.lowStockBottles.items.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center justify-between p-2 bg-yellow-50 rounded">
                  <div className="flex items-center space-x-3">
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.size}</p>
                      <p className="text-xs text-gray-600">
                        คงเหลือ: {item.currentStock} ขวด (ต่ำกว่า {item.minStock} ขวด)
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm text-center py-4">ขวดเพียงพอทั้งหมด</p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
