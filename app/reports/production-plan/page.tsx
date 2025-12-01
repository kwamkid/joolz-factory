// Path: app/reports/production-plan/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import {
  Calendar,
  Factory,
  Package,
  Loader2,
  ChevronDown,
  ChevronRight,
  Printer,
  Wine
} from 'lucide-react';

// Interfaces
interface ProductSummary {
  sellableProductId: string;
  sellableProductCode: string;
  sellableProductName: string;
  productId: string;
  bottleTypeId: string;
  bottleSize: string;
  capacityMl: number;
  totalQuantity: number;
  volumeLiters: number;
  orders: Array<{
    orderId: string;
    orderNumber: string;
    customerName: string;
    deliveryDate: string;
    quantity: number;
  }>;
}

interface DateSummary {
  date: string;
  products: ProductSummary[];
  dateTotals: {
    totalBottles: number;
    totalVolumeLiters: number;
  };
}

interface ReportTotals {
  totalBottles: number;
  totalVolumeLiters: number;
}

interface ReportData {
  startDate: string;
  endDate: string;
  summary: ProductSummary[];
  byDate: DateSummary[];
  totals: ReportTotals;
}

export default function ProductionPlanReportPage() {
  const { userProfile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reportData, setReportData] = useState<ReportData | null>(null);

  // Date filter state - default to tomorrow
  const getDefaultDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [startDate, setStartDate] = useState(getDefaultDate);
  const [endDate, setEndDate] = useState(getDefaultDate);
  const [viewMode, setViewMode] = useState<'summary' | 'byDate'>('summary');
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  // Check auth
  useEffect(() => {
    if (authLoading) return;
    if (!userProfile) {
      router.push('/login');
      return;
    }
  }, [userProfile, authLoading, router]);

  // Fetch report data from orders
  const fetchReport = async () => {
    if (!startDate || !endDate) return;

    try {
      setLoading(true);
      setError('');

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || '';

      const response = await fetch(
        `/api/reports/production-plan?start_date=${startDate}&end_date=${endDate}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'ไม่สามารถโหลดข้อมูลได้');
      }

      // Map to simplified data structure (without cost fields)
      const simplifiedReport: ReportData = {
        startDate: result.report.startDate,
        endDate: result.report.endDate,
        summary: result.report.summary.map((p: any) => ({
          sellableProductId: p.sellableProductId,
          sellableProductCode: p.sellableProductCode,
          sellableProductName: p.sellableProductName,
          productId: p.productId,
          bottleTypeId: p.bottleTypeId,
          bottleSize: p.bottleSize,
          capacityMl: p.capacityMl,
          totalQuantity: p.totalQuantity,
          volumeLiters: p.volumeLiters,
          orders: p.orders
        })),
        byDate: result.report.byDate.map((d: any) => ({
          date: d.date,
          products: d.products.map((p: any) => ({
            sellableProductId: p.sellableProductId,
            sellableProductCode: p.sellableProductCode,
            sellableProductName: p.sellableProductName,
            productId: p.productId,
            bottleTypeId: p.bottleTypeId,
            bottleSize: p.bottleSize,
            capacityMl: p.capacityMl,
            totalQuantity: p.totalQuantity,
            volumeLiters: p.volumeLiters,
            orders: p.orders || []
          })),
          dateTotals: {
            totalBottles: d.dateTotals.totalBottles,
            totalVolumeLiters: d.dateTotals.totalVolumeLiters
          }
        })),
        totals: {
          totalBottles: result.report.totals.totalBottles,
          totalVolumeLiters: result.report.totals.totalVolumeLiters
        }
      };

      setReportData(simplifiedReport);
    } catch (err) {
      console.error('Error fetching report:', err);
      setError(err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  // Helper to format date as YYYY-MM-DD in local timezone
  const formatDateLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Quick date presets
  const setDatePreset = (preset: 'today' | 'tomorrow' | 'week' | 'month') => {
    const today = new Date();

    switch (preset) {
      case 'today':
        const todayStr = formatDateLocal(today);
        setStartDate(todayStr);
        setEndDate(todayStr);
        break;
      case 'tomorrow':
        const tmr = new Date(today);
        tmr.setDate(tmr.getDate() + 1);
        const tmrStr = formatDateLocal(tmr);
        setStartDate(tmrStr);
        setEndDate(tmrStr);
        break;
      case 'week':
        const weekEnd = new Date(today);
        weekEnd.setDate(weekEnd.getDate() + 7);
        setStartDate(formatDateLocal(today));
        setEndDate(formatDateLocal(weekEnd));
        break;
      case 'month':
        const monthEnd = new Date(today);
        monthEnd.setDate(monthEnd.getDate() + 30);
        setStartDate(formatDateLocal(today));
        setEndDate(formatDateLocal(monthEnd));
        break;
    }
  };

  // Toggle product expansion
  const toggleProduct = (key: string) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedProducts(newExpanded);
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Print function
  const handlePrint = () => {
    window.print();
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#00231F]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#E9B308] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return null;
  }

  return (
    <Layout>
      <div className="space-y-6 print:space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between print:hidden">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">สรุปออเดอร์ที่ต้องส่ง</h1>
            <p className="text-gray-600 mt-1">
              ดูสรุปสินค้าที่ต้องส่งลูกค้าตามช่วงเวลา เพื่อวางแผนการผลิต
            </p>
          </div>
          <button
            onClick={handlePrint}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            <Printer className="w-5 h-5" />
            <span>พิมพ์</span>
          </button>
        </div>

        {/* Print Header */}
        <div className="hidden print:block text-center mb-6">
          <h1 className="text-2xl font-bold">สรุปออเดอร์ที่ต้องส่ง</h1>
          <p className="text-gray-600">
            {startDate === endDate
              ? formatDate(startDate)
              : `${formatDate(startDate)} - ${formatDate(endDate)}`}
          </p>
        </div>

        {/* Date Filters */}
        <div className="bg-white rounded-lg shadow p-4 print:hidden">
          <div className="flex flex-wrap items-end gap-4">
            {/* Quick Presets */}
            <div className="flex gap-2">
              <button
                onClick={() => setDatePreset('today')}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                วันนี้
              </button>
              <button
                onClick={() => setDatePreset('tomorrow')}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                พรุ่งนี้
              </button>
              <button
                onClick={() => setDatePreset('week')}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                7 วัน
              </button>
              <button
                onClick={() => setDatePreset('month')}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                30 วัน
              </button>
            </div>

            {/* Date Inputs */}
            <div className="flex items-center gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">วันที่เริ่ม</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                />
              </div>
              <span className="text-gray-400 mt-5">-</span>
              <div>
                <label className="block text-xs text-gray-500 mb-1">วันที่สิ้นสุด</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                />
              </div>
            </div>

            {/* Search Button */}
            <button
              onClick={fetchReport}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-[#00231F] hover:bg-[#003d36] text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Calendar className="w-5 h-5" />
              )}
              <span>ดูรายงาน</span>
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Report Content */}
        {reportData && (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 print:grid-cols-3">
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Package className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">รายการสินค้า</p>
                    <p className="text-xl font-bold text-gray-900">{reportData.summary.length}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Wine className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">จำนวนขวดทั้งหมด</p>
                    <p className="text-xl font-bold text-gray-900">{reportData.totals.totalBottles.toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-cyan-100 rounded-lg">
                    <Factory className="w-5 h-5 text-cyan-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">ปริมาตรรวม</p>
                    <p className="text-xl font-bold text-gray-900">{reportData.totals.totalVolumeLiters.toFixed(1)} L</p>
                  </div>
                </div>
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex space-x-2 print:hidden">
              <button
                onClick={() => setViewMode('summary')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  viewMode === 'summary'
                    ? 'bg-[#00231F] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                สรุปรวม
              </button>
              <button
                onClick={() => setViewMode('byDate')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  viewMode === 'byDate'
                    ? 'bg-[#00231F] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                แยกตามวันส่ง
              </button>
            </div>

            {/* Summary View */}
            {viewMode === 'summary' && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">สรุปสินค้าที่ต้องส่ง</h2>
                </div>
                {reportData.summary.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    ไม่มีออเดอร์ในช่วงวันที่เลือก
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {reportData.summary.map((product) => {
                      const key = `${product.sellableProductId}-${product.bottleTypeId}`;
                      const isExpanded = expandedProducts.has(key);
                      return (
                        <div key={key}>
                          <div
                            className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                            onClick={() => toggleProduct(key)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                {isExpanded ? (
                                  <ChevronDown className="w-5 h-5 text-gray-400" />
                                ) : (
                                  <ChevronRight className="w-5 h-5 text-gray-400" />
                                )}
                                <div>
                                  <p className="font-medium text-gray-900">{product.sellableProductName}</p>
                                  <p className="text-sm text-gray-500">
                                    {product.sellableProductCode} | ขวด {product.bottleSize} ({product.capacityMl}ml)
                                  </p>
                                </div>
                              </div>
                              <div className="text-right flex items-center space-x-6">
                                <div>
                                  <p className="text-2xl font-bold text-[#E9B308]">
                                    {product.totalQuantity.toLocaleString()}
                                  </p>
                                  <p className="text-sm text-gray-500">ขวด</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm text-gray-500">ปริมาตร</p>
                                  <p className="font-medium">{product.volumeLiters.toFixed(1)} L</p>
                                </div>
                              </div>
                            </div>
                          </div>
                          {isExpanded && product.orders && product.orders.length > 0 && (
                            <div className="bg-gray-50 px-6 py-3 border-t border-gray-100">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-gray-500">
                                    <th className="text-left py-2">ออเดอร์</th>
                                    <th className="text-left py-2">ลูกค้า</th>
                                    <th className="text-left py-2">วันที่ส่ง</th>
                                    <th className="text-right py-2">จำนวน</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {product.orders.map((order, idx) => (
                                    <tr key={idx} className="border-t border-gray-100">
                                      <td className="py-2 text-blue-600">{order.orderNumber}</td>
                                      <td className="py-2">{order.customerName}</td>
                                      <td className="py-2">{formatDate(order.deliveryDate)}</td>
                                      <td className="py-2 text-right font-medium">{order.quantity}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* By Date View */}
            {viewMode === 'byDate' && (
              <div className="space-y-4">
                {reportData.byDate.length === 0 ? (
                  <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                    ไม่มีออเดอร์ในช่วงวันที่เลือก
                  </div>
                ) : (
                  reportData.byDate.map((dateData) => (
                    <div key={dateData.date} className="bg-white rounded-lg shadow overflow-hidden">
                      <div className="px-6 py-4 bg-[#00231F] text-white">
                        <h3 className="text-lg font-semibold">{formatDate(dateData.date)}</h3>
                        <p className="text-sm text-gray-300">
                          {dateData.products.length} รายการ |{' '}
                          {dateData.dateTotals.totalBottles.toLocaleString()} ขวด |{' '}
                          {dateData.dateTotals.totalVolumeLiters.toFixed(1)} L
                        </p>
                      </div>
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">สินค้า</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ขวด</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">จำนวน</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">ปริมาตร</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {dateData.products.map((product, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-6 py-4">
                                <p className="font-medium text-gray-900">{product.sellableProductName}</p>
                                <p className="text-sm text-gray-500">{product.sellableProductCode}</p>
                              </td>
                              <td className="px-6 py-4 text-gray-600">{product.bottleSize}</td>
                              <td className="px-6 py-4 text-right">
                                <span className="text-lg font-bold text-[#E9B308]">
                                  {product.totalQuantity.toLocaleString()}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right text-gray-600">
                                {product.volumeLiters.toFixed(1)} L
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Print Summary Table */}
            <div className="hidden print:block mt-6">
              <h2 className="text-lg font-semibold mb-4">สรุปสินค้าที่ต้องส่ง</h2>
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2 text-left">รหัส</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">สินค้า</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">ขวด</th>
                    <th className="border border-gray-300 px-4 py-2 text-right">จำนวน</th>
                    <th className="border border-gray-300 px-4 py-2 text-right">ปริมาตร (L)</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.summary.map((product, idx) => (
                    <tr key={idx}>
                      <td className="border border-gray-300 px-4 py-2">{product.sellableProductCode}</td>
                      <td className="border border-gray-300 px-4 py-2">{product.sellableProductName}</td>
                      <td className="border border-gray-300 px-4 py-2">{product.bottleSize}</td>
                      <td className="border border-gray-300 px-4 py-2 text-right font-bold">
                        {product.totalQuantity.toLocaleString()}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {product.volumeLiters.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-100 font-bold">
                    <td colSpan={3} className="border border-gray-300 px-4 py-2 text-right">รวมทั้งหมด</td>
                    <td className="border border-gray-300 px-4 py-2 text-right">{reportData.totals.totalBottles.toLocaleString()}</td>
                    <td className="border border-gray-300 px-4 py-2 text-right">{reportData.totals.totalVolumeLiters.toFixed(1)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Initial State */}
        {!reportData && !loading && !error && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Factory className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">เลือกช่วงวันที่เพื่อดูสรุป</h3>
            <p className="text-gray-500 mb-4">
              ระบบจะสรุปสินค้าที่ต้องส่งลูกค้าตามออเดอร์ในช่วงเวลาที่เลือก
            </p>
            <button
              onClick={fetchReport}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-[#E9B308] hover:bg-[#d4a307] text-[#00231F] rounded-lg font-semibold transition-colors"
            >
              <Calendar className="w-5 h-5" />
              <span>ดูรายงาน</span>
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
