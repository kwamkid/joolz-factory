// Path: app/dashboard/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/lib/auth-context';
import { 
  Package, 
  ShoppingCart, 
  AlertTriangle, 
  TrendingUp,
  Users,
  DollarSign,
  Factory,
  CheckCircle,
  LucideIcon
} from 'lucide-react';

// Define color type
type StatColor = 'blue' | 'green' | 'yellow' | 'red';

// Stat Card Component
function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  change, 
  color = 'blue' 
}: { 
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: string;
  color?: StatColor;
}) {
  const colorClasses: Record<StatColor, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500'
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {change && (
            <p className="text-sm text-green-600 mt-1">
              <TrendingUp className="w-4 h-4 inline mr-1" />
              {change}
            </p>
          )}
        </div>
        <div className={`${colorClasses[color]} p-3 rounded-lg`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { userProfile, loading } = useAuth();
  const router = useRouter();

  // Check auth and redirect if needed
  useEffect(() => {
    if (!loading && !userProfile) {
      router.push('/login');
    }
  }, [userProfile, loading, router]);

  // Show loading while checking auth
  if (loading) {
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

  // Mock data based on user role
  const getStatsForRole = () => {
    switch (userProfile.role) {
      case 'admin':
      case 'manager':
        return [
          { title: 'การผลิตวันนี้', value: '250 ขวด', icon: Factory, color: 'blue' as StatColor, change: '+12%' },
          { title: 'วัตถุดิบใกล้หมด', value: '3 รายการ', icon: AlertTriangle, color: 'yellow' as StatColor },
          { title: 'รอ QC', value: '2 Batch', icon: CheckCircle, color: 'green' as StatColor },
          { title: 'สต็อกคงเหลือ', value: '1,250 ขวด', icon: Package, color: 'blue' as StatColor },
        ];
      case 'sales':
        return [
          { title: 'ยอดขายวันนี้', value: '฿12,500', icon: DollarSign, color: 'green' as StatColor, change: '+8%' },
          { title: 'ออเดอร์ใหม่', value: '5 รายการ', icon: ShoppingCart, color: 'blue' as StatColor },
          { title: 'ลูกค้าใหม่', value: '2 ราย', icon: Users, color: 'green' as StatColor },
          { title: 'ค้างชำระ', value: '฿35,000', icon: AlertTriangle, color: 'red' as StatColor },
        ];
      case 'operation':
        return [
          { title: 'งานวันนี้', value: '3 Batch', icon: Factory, color: 'blue' as StatColor },
          { title: 'รอผลิต', value: '2 Batch', icon: Package, color: 'yellow' as StatColor },
          { title: 'เสร็จแล้ว', value: '1 Batch', icon: CheckCircle, color: 'green' as StatColor },
          { title: 'รอ QC', value: '1 Batch', icon: AlertTriangle, color: 'yellow' as StatColor },
        ];
      default:
        return [];
    }
  };

  const stats = getStatsForRole();

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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activities */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            กิจกรรมล่าสุด
          </h3>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
              <div className="flex-1">
                <p className="text-sm text-gray-900">ผลิต Batch OJ250724001 เสร็จสิ้น</p>
                <p className="text-xs text-gray-500">10 นาทีที่แล้ว</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <div className="flex-1">
                <p className="text-sm text-gray-900">ออเดอร์ใหม่จาก ร้านส้มตำป้าหนอย</p>
                <p className="text-xs text-gray-500">30 นาทีที่แล้ว</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
              <div className="flex-1">
                <p className="text-sm text-gray-900">วัตถุดิบ ส้มเขียวหวาน ใกล้หมด</p>
                <p className="text-xs text-gray-500">1 ชั่วโมงที่แล้ว</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            เมนูลัด
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {userProfile.role !== 'sales' && (
              <>
                <button className="p-4 bg-[#E9B308]/10 hover:bg-[#E9B308]/20 rounded-lg text-center transition-colors">
                  <Factory className="w-6 h-6 text-[#E9B308] mx-auto mb-2" />
                  <span className="text-sm text-gray-700">เริ่มผลิต</span>
                </button>
                <button className="p-4 bg-[#E9B308]/10 hover:bg-[#E9B308]/20 rounded-lg text-center transition-colors">
                  <Package className="w-6 h-6 text-[#E9B308] mx-auto mb-2" />
                  <span className="text-sm text-gray-700">เช็คสต็อก</span>
                </button>
              </>
            )}
            {userProfile.role !== 'operation' && (
              <>
                <button className="p-4 bg-[#E9B308]/10 hover:bg-[#E9B308]/20 rounded-lg text-center transition-colors">
                  <ShoppingCart className="w-6 h-6 text-[#E9B308] mx-auto mb-2" />
                  <span className="text-sm text-gray-700">สร้างออเดอร์</span>
                </button>
                <button className="p-4 bg-[#E9B308]/10 hover:bg-[#E9B308]/20 rounded-lg text-center transition-colors">
                  <Users className="w-6 h-6 text-[#E9B308] mx-auto mb-2" />
                  <span className="text-sm text-gray-700">จัดการลูกค้า</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}