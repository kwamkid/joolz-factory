// Path: app/production/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { createClient } from '@supabase/supabase-js';
import {
  Factory, Plus, Clock, CheckCircle, XCircle,
  Package, Calendar, Boxes
} from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { getImageUrl } from '@/lib/utils/image';

// Types
interface PlannedItem {
  bottle_type_id: string;
  quantity: number;
  bottle_types?: {
    size: string;
  };
}

interface ProductionBatch {
  id: string;
  batch_id: string;
  product_id: string;
  planned_date: string;
  planned_items: PlannedItem[];
  status: string;
  created_at: string;
  products?: {
    name: string;
    image?: string;
  };
  total_bottles: number;
}

type StatusFilter = 'all' | 'planned' | 'completed' | 'cancelled';

export default function ProductionPage() {
  const router = useRouter();
  const { session } = useAuth();
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Fetch batches
  const fetchBatches = async () => {
    try {
      let url = '/api/production';
      if (statusFilter !== 'all') {
        url += `?status=${statusFilter}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch batches');

      const data = await response.json();
      console.log('Batches data:', data.batches);
      if (data.batches && data.batches.length > 0) {
        console.log('First batch planned_items:', data.batches[0].planned_items);
      }
      setBatches(data.batches || []);
    } catch (err: any) {
      console.error('Error fetching batches:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.access_token) {
      fetchBatches();
    }
  }, [session?.access_token, statusFilter]);

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'planned':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            <Clock className="w-3.5 h-3.5" />
            รอผลิต
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle className="w-3.5 h-3.5" />
            เสร็จแล้ว
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <XCircle className="w-3.5 h-3.5" />
            ยกเลิก
          </span>
        );
      default:
        return null;
    }
  };

  // Count by status
  const statusCounts = {
    all: batches.length,
    planned: batches.filter(b => b.status === 'planned').length,
    completed: batches.filter(b => b.status === 'completed').length,
    cancelled: batches.filter(b => b.status === 'cancelled').length
  };

  // Handle start production
  const handleStartProduction = async (e: React.MouseEvent, batchId: string) => {
    e.stopPropagation(); // Prevent navigation
    router.push(`/production/${batchId}`);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-[#E9B308]">Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <Factory className="w-8 h-8 text-[#E9B308]" />
            การผลิต
          </h1>
          <p className="text-gray-600 text-base">จัดการแผนการผลิตและติดตามสถานะ</p>
        </div>

        <button
          onClick={() => router.push('/production/new')}
          className="bg-[#E9B308] text-[#00231F] px-6 py-3 rounded-lg font-semibold hover:bg-[#d4a307] transition-colors flex items-center justify-center gap-2 text-base mt-4 sm:mt-0"
        >
          <Plus className="w-5 h-5" />
          วางแผนการผลิต
        </button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { value: 'all', label: 'ทั้งหมด', count: statusCounts.all },
          { value: 'planned', label: 'รอผลิต', count: statusCounts.planned },
          { value: 'completed', label: 'เสร็จแล้ว', count: statusCounts.completed },
          { value: 'cancelled', label: 'ยกเลิก', count: statusCounts.cancelled }
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value as StatusFilter)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === tab.value
                ? 'bg-[#E9B308] text-[#00231F]'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                statusFilter === tab.value ? 'bg-[#00231F]/20' : 'bg-gray-300'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Batches List */}
      {batches.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg shadow p-8 text-center">
          <Factory className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">ยังไม่มีรายการผลิต</p>
          <button
            onClick={() => router.push('/production/new')}
            className="mt-4 text-[#E9B308] hover:underline"
          >
            สร้างแผนการผลิตใหม่
          </button>
        </div>
      ) : (
        <>
          {/* Mobile Card Layout */}
          <div className="md:hidden space-y-4">
            {batches.map((batch) => (
              <div
                key={batch.id}
                className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden"
              >
                {/* Card Header - Product Info */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    {batch.products?.image ? (
                      <img
                        src={getImageUrl(batch.products.image)}
                        alt={batch.products.name}
                        className="w-14 h-14 object-cover rounded-lg flex-shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 bg-gradient-to-br from-[#E9B308]/20 to-[#E9B308]/5 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Package className="w-7 h-7 text-[#E9B308]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 text-lg truncate">
                        {batch.products?.name}
                      </h3>
                      <p className="text-sm text-gray-500 font-mono">{batch.batch_id}</p>
                    </div>
                    {getStatusBadge(batch.status)}
                  </div>
                </div>

                {/* Card Body - Details */}
                <div className="p-4 space-y-3">
                  {/* Date */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">วันที่ต้องผลิต</p>
                      <p className="font-semibold text-gray-900">
                        {new Date(batch.planned_date).toLocaleDateString('th-TH', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Quantity */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Boxes className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500">จำนวนที่ต้องผลิต</p>
                      <p className="font-bold text-xl text-gray-900">
                        {batch.total_bottles.toLocaleString()} <span className="text-sm font-normal">ขวด</span>
                      </p>
                    </div>
                  </div>

                  {/* Bottle Sizes */}
                  {batch.planned_items && batch.planned_items.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {batch.planned_items.map((item, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200"
                        >
                          {item.bottle_types?.size || 'N/A'}: {item.quantity.toLocaleString()} ขวด
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Footer - Actions */}
                <div className="p-4 bg-gray-50 border-t border-gray-100">
                  {batch.status === 'planned' ? (
                    <button
                      onClick={(e) => handleStartProduction(e, batch.id)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#E9B308] text-[#00231F] rounded-xl hover:bg-[#d4a307] transition-colors font-bold text-lg shadow-sm"
                    >
                      <Factory className="w-6 h-6" />
                      เริ่มผลิต
                    </button>
                  ) : (
                    <button
                      onClick={() => router.push(`/production/${batch.id}`)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
                    >
                      ดูรายละเอียด
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table Layout */}
          <div className="hidden md:block bg-white border border-gray-200 rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Batch ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      สินค้า
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      จำนวนขวด
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      สถานะ
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      จัดการ
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {batches.map((batch) => (
                    <tr
                      key={batch.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">{batch.batch_id}</div>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Calendar className="w-3 h-3" />
                          {new Date(batch.planned_date).toLocaleDateString('th-TH', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {batch.products?.image ? (
                            <img
                              src={getImageUrl(batch.products.image)}
                              alt={batch.products.name}
                              className="w-10 h-10 object-cover rounded-lg"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                              <Package className="w-5 h-5 text-gray-400" />
                            </div>
                          )}
                          <div>
                            <div className="text-sm font-medium text-gray-900">{batch.products?.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-2">
                          <Boxes className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div className="flex flex-col gap-1">
                            <div className="text-sm font-semibold text-gray-900">
                              {batch.total_bottles.toLocaleString()} ขวด
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {batch.planned_items?.map((item, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
                                >
                                  {item.bottle_types?.size || 'N/A'}: {item.quantity.toLocaleString()}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(batch.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          {batch.status === 'planned' && (
                            <button
                              onClick={(e) => handleStartProduction(e, batch.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#E9B308] text-[#00231F] rounded-lg hover:bg-[#d4a307] transition-colors text-sm font-medium"
                            >
                              <Factory className="w-4 h-4" />
                              เริ่มผลิต
                            </button>
                          )}
                          <button
                            onClick={() => router.push(`/production/${batch.id}`)}
                            className="inline-flex items-center px-3 py-1.5 text-[#E9B308] hover:text-[#d4a307] transition-colors text-sm font-medium"
                          >
                            ดูรายละเอียด
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
