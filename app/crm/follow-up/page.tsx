'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import {
  Users,
  Search,
  Loader2,
  Phone,
  Calendar,
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  Clock,
  Plus,
  ChevronRight,
  Filter,
  ArrowUpDown
} from 'lucide-react';

interface CRMCustomer {
  id: string;
  customer_code: string;
  name: string;
  contact_person?: string;
  phone?: string;
  province?: string;
  customer_type: 'retail' | 'wholesale' | 'distributor';
  last_order_date: string | null;
  days_since_last_order: number | null;
  avg_order_frequency: number | null; // Average days between orders
  total_orders: number;
  total_spent: number;
}

interface Summary {
  totalCustomers: number;
  customersWithOrders: number;
  customersNeverOrdered: number;
  customersNotOrderedIn3Days: number;
  customersNotOrderedIn7Days: number;
  customersNotOrderedIn14Days: number;
  customersNotOrderedIn30Days: number;
}

// Customer type badge
function CustomerTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    retail: 'bg-blue-100 text-blue-800',
    wholesale: 'bg-purple-100 text-purple-800',
    distributor: 'bg-green-100 text-green-800'
  };

  const labels: Record<string, string> = {
    retail: 'ขายปลีก',
    wholesale: 'ขายส่ง',
    distributor: 'ตัวแทนจำหน่าย'
  };

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${colors[type] || 'bg-gray-100 text-gray-800'}`}>
      {labels[type] || type}
    </span>
  );
}

// Days since last order badge - compares with avg frequency
function DaysBadge({ days, avgFrequency }: { days: number | null; avgFrequency: number | null }) {
  if (days === null) {
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        ยังไม่เคยสั่ง
      </span>
    );
  }

  // Color based on comparison with average frequency (if available)
  let colorClass = 'bg-green-100 text-green-800';
  let isOverdue = false;

  if (avgFrequency && days > avgFrequency) {
    isOverdue = true;
    const overdueRatio = days / avgFrequency;
    if (overdueRatio >= 2) {
      colorClass = 'bg-red-100 text-red-800';
    } else if (overdueRatio >= 1.5) {
      colorClass = 'bg-orange-100 text-orange-800';
    } else {
      colorClass = 'bg-yellow-100 text-yellow-800';
    }
  } else {
    // Fallback to fixed thresholds if no frequency data
    if (days >= 30) {
      colorClass = 'bg-red-100 text-red-800';
    } else if (days >= 14) {
      colorClass = 'bg-orange-100 text-orange-800';
    } else if (days >= 7) {
      colorClass = 'bg-yellow-100 text-yellow-800';
    }
  }

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${colorClass}`}>
      {days} วัน {isOverdue && avgFrequency && <span className="opacity-75">(เกิน)</span>}
    </span>
  );
}

// Frequency badge - shows average order pattern
function FrequencyBadge({ frequency }: { frequency: number | null }) {
  if (frequency === null) {
    return <span className="text-gray-400 text-sm">-</span>;
  }

  return (
    <span className="text-sm text-gray-700">
      ทุก ~{frequency} วัน
    </span>
  );
}

export default function CRMFollowUpPage() {
  const router = useRouter();
  const { userProfile, loading: authLoading } = useAuth();

  const [customers, setCustomers] = useState<CRMCustomer[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterDays, setFilterDays] = useState<string>('all'); // 'all', '3', '5', '7', '10', '14', '21', '30', 'never'
  const [sortBy, setSortBy] = useState<string>('days_since_last_order');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch customers
  useEffect(() => {
    if (!authLoading && userProfile) {
      fetchCustomers();
    }
  }, [authLoading, userProfile, debouncedSearch, filterDays, sortBy, sortOrder]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No session');
      }

      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      params.set('sort_by', sortBy);
      params.set('sort_order', sortOrder);

      // Apply filter - "สั่งไปแล้ว xx วัน"
      if (filterDays === 'never') {
        params.set('has_orders', 'false');
      } else if (filterDays !== 'all') {
        params.set('min_days', filterDays);
        params.set('has_orders', 'true');
      }

      const response = await fetch(`/api/crm/customers?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch customers');
      }

      const result = await response.json();
      setCustomers(result.customers || []);
      setSummary(result.summary || null);
    } catch (error) {
      console.error('Error fetching customers:', error);
      setError('ไม่สามารถโหลดข้อมูลลูกค้าได้');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleCreateOrder = (customerId: string) => {
    // Navigate to new order page with customer pre-selected
    router.push(`/orders/new?customer=${customerId}`);
  };

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-[#E9B308] animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-7 h-7 text-[#E9B308]" />
              ลูกค้าที่ควรติดตาม
            </h1>
            <p className="text-gray-500 mt-1">ติดตามลูกค้าที่ไม่ได้สั่งซื้อนาน</p>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <button
              onClick={() => setFilterDays('all')}
              className={`bg-white rounded-lg border p-4 text-left transition-all hover:shadow-md ${filterDays === 'all' ? 'border-[#E9B308] ring-2 ring-[#E9B308]/20' : 'border-gray-200'}`}
            >
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Users className="w-4 h-4" />
                <span className="text-xs">ลูกค้าทั้งหมด</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{summary.totalCustomers}</div>
            </button>

            <button
              onClick={() => setFilterDays('3')}
              className={`bg-white rounded-lg border p-4 text-left transition-all hover:shadow-md ${filterDays === '3' ? 'border-green-500 ring-2 ring-green-500/20' : 'border-gray-200'}`}
            >
              <div className="flex items-center gap-2 text-green-600 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-xs">สั่งไปแล้ว 3+ วัน</span>
              </div>
              <div className="text-2xl font-bold text-green-600">{summary.customersNotOrderedIn3Days || 0}</div>
            </button>

            <button
              onClick={() => setFilterDays('7')}
              className={`bg-white rounded-lg border p-4 text-left transition-all hover:shadow-md ${filterDays === '7' ? 'border-yellow-500 ring-2 ring-yellow-500/20' : 'border-gray-200'}`}
            >
              <div className="flex items-center gap-2 text-yellow-600 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-xs">สั่งไปแล้ว 7+ วัน</span>
              </div>
              <div className="text-2xl font-bold text-yellow-600">{summary.customersNotOrderedIn7Days}</div>
            </button>

            <button
              onClick={() => setFilterDays('14')}
              className={`bg-white rounded-lg border p-4 text-left transition-all hover:shadow-md ${filterDays === '14' ? 'border-orange-500 ring-2 ring-orange-500/20' : 'border-gray-200'}`}
            >
              <div className="flex items-center gap-2 text-orange-600 mb-1">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs">สั่งไปแล้ว 14+ วัน</span>
              </div>
              <div className="text-2xl font-bold text-orange-600">{summary.customersNotOrderedIn14Days}</div>
            </button>

            <button
              onClick={() => setFilterDays('30')}
              className={`bg-white rounded-lg border p-4 text-left transition-all hover:shadow-md ${filterDays === '30' ? 'border-red-500 ring-2 ring-red-500/20' : 'border-gray-200'}`}
            >
              <div className="flex items-center gap-2 text-red-600 mb-1">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs">สั่งไปแล้ว 30+ วัน</span>
              </div>
              <div className="text-2xl font-bold text-red-600">{summary.customersNotOrderedIn30Days}</div>
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ค้นหาชื่อลูกค้า, รหัส, เบอร์โทร..."
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] text-sm"
              />
            </div>

            {/* Filter by days */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={filterDays}
                onChange={(e) => setFilterDays(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] text-sm"
              >
                <option value="all">ทั้งหมด</option>
                <option value="3">สั่งไปแล้ว 3+ วัน</option>
                <option value="5">สั่งไปแล้ว 5+ วัน</option>
                <option value="7">สั่งไปแล้ว 7+ วัน</option>
                <option value="10">สั่งไปแล้ว 10+ วัน</option>
                <option value="14">สั่งไปแล้ว 14+ วัน</option>
                <option value="21">สั่งไปแล้ว 21+ วัน</option>
                <option value="30">สั่งไปแล้ว 30+ วัน</option>
                <option value="never">ยังไม่เคยสั่ง</option>
              </select>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-gray-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] text-sm"
              >
                <option value="days_since_last_order">วันที่ไม่สั่ง</option>
                <option value="total_orders">จำนวนออเดอร์</option>
                <option value="total_spent">ยอดซื้อรวม</option>
                <option value="last_order_date">วันที่สั่งล่าสุด</option>
                <option value="name">ชื่อลูกค้า</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                title={sortOrder === 'asc' ? 'น้อยไปมาก' : 'มากไปน้อย'}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Customer List */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-[#E9B308] animate-spin" />
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">ไม่พบลูกค้าตามเงื่อนไขที่เลือก</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ลูกค้า</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ประเภท</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">สั่งล่าสุด</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">สั่งไปแล้ว</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">รอบสั่งซื้อ</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">ออเดอร์</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">ยอดซื้อรวม</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {customers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      {/* Customer Info */}
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-xs text-gray-400 mb-0.5">{customer.customer_code}</div>
                          <div className="font-medium text-gray-900">{customer.name}</div>
                          {customer.phone && (
                            <a
                              href={`tel:${customer.phone}`}
                              className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 mt-1"
                            >
                              <Phone className="w-3 h-3" />
                              {customer.phone}
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Type */}
                      <td className="px-6 py-4">
                        <CustomerTypeBadge type={customer.customer_type || 'retail'} />
                      </td>

                      {/* Last Order Date */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(customer.last_order_date)}
                        </div>
                      </td>

                      {/* Days Since Last Order */}
                      <td className="px-6 py-4 text-center">
                        <DaysBadge days={customer.days_since_last_order} avgFrequency={customer.avg_order_frequency} />
                      </td>

                      {/* Order Frequency */}
                      <td className="px-6 py-4 text-center">
                        <FrequencyBadge frequency={customer.avg_order_frequency} />
                      </td>

                      {/* Total Orders */}
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-medium text-gray-900">{customer.total_orders}</span>
                      </td>

                      {/* Total Spent */}
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-medium text-gray-900">
                          ฿{customer.total_spent.toLocaleString('th-TH', { minimumFractionDigits: 0 })}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleCreateOrder(customer.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#E9B308] text-[#00231F] rounded-lg hover:bg-[#d4a307] text-sm font-medium transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            สร้างออเดอร์
                          </button>
                          <button
                            onClick={() => router.push(`/customers/${customer.id}`)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                            title="ดูรายละเอียด"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Results count */}
        {!loading && customers.length > 0 && (
          <div className="text-sm text-gray-500 text-center">
            แสดง {customers.length} ลูกค้า
          </div>
        )}
      </div>
    </Layout>
  );
}
