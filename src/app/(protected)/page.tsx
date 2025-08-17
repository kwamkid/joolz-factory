// src/app/(dashboard)/dashboard/page.tsx
'use client';

import React from 'react';
import { 
  Package, Factory, TrendingUp, Users, 
  AlertCircle, CheckCircle2, Clock, ShoppingCart,
  BarChart3, FileText, Calendar, DollarSign
} from 'lucide-react';

export default function DashboardPage() {
  // Mock data
  const stats = [
    { label: 'ยอดผลิตวันนี้', value: '450', icon: Factory, trend: 'up', trendValue: '+12%' },
    { label: 'สต็อกคงเหลือ', value: '1,250', icon: Package, trend: 'down', trendValue: '-5%' },
    { label: 'ซัพพลายเออร์', value: '15', icon: Users },
    { label: 'รายได้วันนี้', value: '฿25,600', icon: DollarSign, trend: 'up', trendValue: '+8%' }
  ];

  const recentProduction = [
    { id: 1, product: 'น้ำส้มคั้น 250ml', quantity: 150, status: 'completed', time: '10:30' },
    { id: 2, product: 'น้ำเลม่อน 350ml', quantity: 100, status: 'in_progress', time: '11:45' },
    { id: 3, product: 'น้ำสมุนไพร 1L', quantity: 50, status: 'pending', time: '13:00' }
  ];

  const lowStockItems = [
    { name: 'ส้ม', current: 25, unit: 'kg', minimum: 50 },
    { name: 'เลม่อน', current: 15, unit: 'kg', minimum: 30 },
    { name: 'ขวด 250ml', current: 200, unit: 'ขวด', minimum: 500 }
  ];

  return (
    <div className="page-content">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">สวัสดี! 👋</h1>
        <p className="text-gray-400">ยินดีต้อนรับสู่ระบบจัดการโรงงาน Joolz Factory</p>
      </div>

      {/* Stats Grid */}
      <div className="dashboard-grid mb-8">
        {stats.map((stat, index) => (
          <div key={index} className="card">
            <div className="flex items-center justify-between mb-4">
              <stat.icon className="h-8 w-8 text-primary" />
              {stat.trend && (
                <span className={`text-sm font-medium ${
                  stat.trend === 'up' ? 'text-green-500' : 'text-red-500'
                }`}>
                  {stat.trendValue}
                </span>
              )}
            </div>
            <p className="stat-value">{stat.value}</p>
            <p className="stat-label">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Production - 2 columns */}
        <div className="lg:col-span-2">
          <div className="card h-full">
            <h3 className="text-lg font-semibold text-white mb-4">การผลิตล่าสุด</h3>
            <div className="space-y-4">
              {recentProduction.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className={`
                      h-10 w-10 rounded-lg flex items-center justify-center
                      ${item.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                        item.status === 'in_progress' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-600 text-gray-400'}
                    `}>
                      {item.status === 'completed' ? <CheckCircle2 className="h-5 w-5" /> :
                       item.status === 'in_progress' ? <Clock className="h-5 w-5" /> :
                       <AlertCircle className="h-5 w-5" />}
                    </div>
                    <div>
                      <h4 className="font-medium text-white">{item.product}</h4>
                      <p className="text-sm text-gray-400">จำนวน: {item.quantity} ขวด</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-400">{item.time}</p>
                    <span className={`
                      text-xs px-2 py-1 rounded-full
                      ${item.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                        item.status === 'in_progress' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-600 text-gray-400'}
                    `}>
                      {item.status === 'completed' ? 'เสร็จสิ้น' :
                       item.status === 'in_progress' ? 'กำลังผลิต' :
                       'รอดำเนินการ'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 flex justify-between items-center">
              <button className="btn btn-ghost btn-sm">
                ดูทั้งหมด
              </button>
              <button className="btn btn-primary">
                <Factory className="h-4 w-4" />
                เริ่มผลิตใหม่
              </button>
            </div>
          </div>
        </div>

        {/* Low Stock Alert - 1 column */}
        <div>
          <div className="card h-full">
            <h3 className="text-lg font-semibold text-white mb-4">สต็อกใกล้หมด</h3>
            <div className="space-y-3">
              {lowStockItems.map((item, index) => (
                <div key={index} className="p-3 bg-red-900/20 border border-red-600 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="font-medium text-white">{item.name}</h5>
                      <p className="text-sm text-red-400">
                        คงเหลือ: {item.current} {item.unit}
                      </p>
                    </div>
                    <AlertCircle className="h-5 w-5 text-red-400" />
                  </div>
                  <div className="mt-2">
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-red-500 h-2 rounded-full"
                        style={{ width: `${(item.current / item.minimum) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      ขั้นต่ำ: {item.minimum} {item.unit}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            
            <button className="btn btn-secondary w-full mt-4">
              <ShoppingCart className="h-4 w-4" />
              สั่งซื้อวัตถุดิบ
            </button>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-white mb-4">เมนูลัด</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card card-hover text-center cursor-pointer">
            <Factory className="h-12 w-12 text-primary mx-auto mb-3" />
            <p className="font-medium text-white">เริ่มผลิต</p>
          </div>
          <div className="card card-hover text-center cursor-pointer">
            <Package className="h-12 w-12 text-primary mx-auto mb-3" />
            <p className="font-medium text-white">จัดการสต็อก</p>
          </div>
          <div className="card card-hover text-center cursor-pointer">
            <BarChart3 className="h-12 w-12 text-primary mx-auto mb-3" />
            <p className="font-medium text-white">ดูรายงาน</p>
          </div>
          <div className="card card-hover text-center cursor-pointer">
            <Users className="h-12 w-12 text-primary mx-auto mb-3" />
            <p className="font-medium text-white">ซัพพลายเออร์</p>
          </div>
        </div>
      </div>
    </div>
  );
}