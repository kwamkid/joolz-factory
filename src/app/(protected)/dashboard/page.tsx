// Path: src/app/(protected)/dashboard/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { 
  Package, Factory, TrendingUp, Users, 
  AlertCircle, CheckCircle2, Clock, ShoppingCart,
  BarChart3, DollarSign, Loader2, Calendar,
  ArrowRight, Gauge
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { dashboardService, DashboardData } from '@/services/dashboard';
import { useAuth } from '@/lib/auth-context';

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
    
    // Refresh ทุก 30 วินาที
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      const dashboardData = await dashboardService.getDashboardData();
      setData(dashboardData);
      setError(null);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
          <p className="mt-4 text-gray-400">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <p className="text-red-400">{error}</p>
        <button 
          onClick={loadDashboardData}
          className="btn btn-primary mt-4"
        >
          ลองใหม่
        </button>
      </div>
    );
  }

  if (!data) return null;

  const stats = [
    { 
      label: 'ผลิตวันนี้', 
      value: data.stats.todayProduction.toLocaleString(), 
      icon: Factory, 
      trend: data.stats.productionTrend, 
      trendValue: data.stats.productionTrendValue,
      unit: 'ขวด'
    },
    { 
      label: 'รอผลิต', 
      value: data.stats.pendingProduction.toString(), 
      icon: Clock,
      unit: 'งาน',
      color: 'text-yellow-400'
    },
    { 
      label: 'ซัพพลายเออร์', 
      value: data.stats.activeSuppliers.toString(), 
      icon: Users,
      unit: 'ราย'
    },
    { 
      label: 'รายได้วันนี้', 
      value: `฿${data.stats.todayRevenue.toLocaleString()}`, 
      icon: DollarSign, 
      trend: data.stats.todayRevenue > 20000 ? 'up' : 'down', 
      trendValue: data.stats.todayRevenue > 20000 ? '+8%' : '-5%',
      hidden: user?.role === 'operation'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-400';
      case 'in_progress':
        return 'bg-yellow-500/20 text-yellow-400';
      default:
        return 'bg-gray-600 text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5" />;
      case 'in_progress':
        return <Clock className="h-5 w-5" />;
      default:
        return <AlertCircle className="h-5 w-5" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'เสร็จสิ้น';
      case 'in_progress':
        return 'กำลังผลิต';
      default:
        return 'รอดำเนินการ';
    }
  };

  const getStockStatusColor = (status: string) => {
    switch (status) {
      case 'critical':
        return 'text-red-400 bg-red-900/20';
      case 'low':
        return 'text-yellow-400 bg-yellow-900/20';
      default:
        return 'text-green-400 bg-green-900/20';
    }
  };

  const getStockStatusIcon = (status: string) => {
    switch (status) {
      case 'critical':
        return <AlertCircle className="h-4 w-4" />;
      case 'low':
        return <Gauge className="h-4 w-4" />;
      default:
        return <CheckCircle2 className="h-4 w-4" />;
    }
  };

  return (
    <div className="page-content">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">สวัสดี, {user?.name}! 👋</h1>
        <p className="text-gray-400">ยินดีต้อนรับสู่ระบบจัดการโรงงาน Joolz Factory</p>
      </div>

      {/* Stats Grid */}
      <div className="dashboard-grid mb-8">
        {stats.filter(stat => !stat.hidden).map((stat, index) => (
          <div key={index} className="card">
            <div className="flex items-center justify-between mb-4">
              <stat.icon className={`h-8 w-8 ${stat.color || 'text-primary'}`} />
              {stat.trend && (
                <span className={`text-sm font-medium ${
                  stat.trend === 'up' ? 'text-green-500' : 
                  stat.trend === 'down' ? 'text-red-500' : 
                  'text-gray-400'
                }`}>
                  {stat.trendValue}
                </span>
              )}
            </div>
            <p className="stat-value">{stat.value}</p>
            <p className="stat-label">{stat.label}</p>
            {stat.unit && (
              <p className="text-sm text-gray-500 mt-1">{stat.unit}</p>
            )}
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Recent Production */}
        <div>
          <div className="card h-full">
            <h3 className="text-lg font-semibold text-white mb-4">การผลิตล่าสุด</h3>
            
            {data.recentProduction.length === 0 ? (
              <div className="text-center py-8">
                <Factory className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">ยังไม่มีการผลิตวันนี้</p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.recentProduction.map((item) => (
                  <div key={item.id} className="p-4 bg-gray-700 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${getStatusColor(item.status)}`}>
                          {getStatusIcon(item.status)}
                        </div>
                        <div>
                          <h4 className="font-medium text-white">{item.product}</h4>
                          <p className="text-sm text-gray-400">Batch: {item.batchId}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-400">{item.date}</p>
                        <p className="text-xs text-gray-500">{item.time}</p>
                        <span className={`text-xs px-2 py-1 rounded-full mt-1 inline-block ${getStatusColor(item.status)}`}>
                          {getStatusText(item.status)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.bottleDetails.map((bottle, idx) => (
                        <span key={idx} className="text-sm bg-gray-600 px-2 py-1 rounded">
                          {bottle.size}: {bottle.quantity} ขวด
                        </span>
                      ))}
                      <span className="text-sm text-primary font-medium ml-auto">
                        รวม: {item.quantity} ขวด
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <button 
              onClick={() => router.push('/production')}
              className="btn btn-ghost btn-sm w-full mt-4"
            >
              ดูทั้งหมด
              <ArrowRight className="h-4 w-4 ml-1" />
            </button>
          </div>
        </div>

        {/* Pending Production */}
        <div>
          <div className="card h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">ที่ต้องผลิตวันนี้</h3>
              <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full">
                {data.pendingProduction.length} งาน
              </span>
            </div>
            
            {data.pendingProduction.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-3" />
                <p className="text-gray-400">ไม่มีงานค้างอยู่</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.pendingProduction.map((item) => (
                  <div key={item.id} className="p-3 bg-gray-700 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-white">{item.product}</h4>
                        <p className="text-xs text-gray-400">
                          {item.batchId} • สร้างเมื่อ {item.createdTime}
                        </p>
                      </div>
                      <button
                        onClick={() => router.push(`/production/execute/${item.id}`)}
                        className="btn btn-primary btn-sm"
                      >
                        <Factory className="h-3 w-3" />
                        ผลิต
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.plannedBottles.map((bottle, idx) => (
                        <span key={idx} className="text-xs bg-gray-600 px-2 py-1 rounded">
                          {bottle.size}: {bottle.quantity}
                        </span>
                      ))}
                      {item.productionDate && (
                        <span className="text-xs text-yellow-400 ml-auto">
                          <Calendar className="h-3 w-3 inline mr-1" />
                          {new Date(item.productionDate).toLocaleDateString('th-TH')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <button 
              onClick={() => router.push('/production/plan')}
              className="btn btn-secondary w-full mt-4"
            >
              <Factory className="h-4 w-4" />
              วางแผนผลิตเพิ่ม
            </button>
          </div>
        </div>
      </div>

      {/* Material Stock */}
      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-4">สต็อกวัตถุดิบ</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {data.materialStock.map((item, index) => (
            <div 
              key={index} 
              className={`p-3 rounded-lg border ${
                item.status === 'critical' ? 'border-red-600 bg-red-900/20' :
                item.status === 'low' ? 'border-yellow-600 bg-yellow-900/20' :
                'border-gray-600 bg-gray-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h5 className="font-medium text-white">{item.name}</h5>
                <span className={`${getStockStatusColor(item.status)}`}>
                  {getStockStatusIcon(item.status)}
                </span>
              </div>
              <p className={`text-lg font-semibold ${
                item.status === 'critical' ? 'text-red-400' :
                item.status === 'low' ? 'text-yellow-400' :
                'text-white'
              }`}>
                {item.current} {item.unit}
              </p>
              <div className="mt-2">
                <div className="w-full bg-gray-700 rounded-full h-1.5">
                  <div 
                    className={`h-1.5 rounded-full ${
                      item.status === 'critical' ? 'bg-red-500' :
                      item.status === 'low' ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(item.percentage, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  ขั้นต่ำ: {item.minimum} {item.unit}
                </p>
              </div>
            </div>
          ))}
        </div>
        
        {data.materialStock.some(item => item.status === 'low' || item.status === 'critical') && (
          <button 
            onClick={() => router.push('/inventory/purchase')}
            className="btn btn-secondary w-full mt-4"
          >
            <ShoppingCart className="h-4 w-4" />
            สั่งซื้อวัตถุดิบ
          </button>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-white mb-4">เมนูลัด</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div 
            onClick={() => router.push('/production/plan')}
            className="card card-hover text-center cursor-pointer"
          >
            <Factory className="h-12 w-12 text-primary mx-auto mb-3" />
            <p className="font-medium text-white">เริ่มผลิต</p>
          </div>
          <div 
            onClick={() => router.push('/inventory')}
            className="card card-hover text-center cursor-pointer"
          >
            <Package className="h-12 w-12 text-primary mx-auto mb-3" />
            <p className="font-medium text-white">จัดการสต็อก</p>
          </div>
          {user?.role !== 'operation' && (
            <div 
              onClick={() => router.push('/reports')}
              className="card card-hover text-center cursor-pointer"
            >
              <BarChart3 className="h-12 w-12 text-primary mx-auto mb-3" />
              <p className="font-medium text-white">ดูรายงาน</p>
            </div>
          )}
          <div 
            onClick={() => router.push('/suppliers')}
            className="card card-hover text-center cursor-pointer"
          >
            <Users className="h-12 w-12 text-primary mx-auto mb-3" />
            <p className="font-medium text-white">ซัพพลายเออร์</p>
          </div>
        </div>
      </div>
    </div>
  );
}