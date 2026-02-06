'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import DateRangePicker from '@/components/ui/DateRangePicker';
import { DateValueType } from 'react-tailwindcss-datepicker';
import {
  ShoppingCart,
  Plus,
  Search,
  Loader2,
  Trash2,
  ChevronRight,
} from 'lucide-react';

// Order interface
interface Order {
  id: string;
  order_number: string;
  order_date: string;
  delivery_date?: string;
  total_amount: number;
  payment_status: string;
  payment_method?: string;
  order_status: string;
  customer_id: string;
  customer_code: string;
  customer_name: string;
  contact_person?: string;
  customer_phone?: string;
  item_count: number;
  branch_count: number;
  branch_names?: string[];
}

// Status badge components
function OrderStatusBadge({ status, clickable = false }: { status: string; clickable?: boolean }) {
  const statusConfig = {
    new: { label: 'ใหม่', color: 'bg-blue-100 text-blue-700', hoverColor: 'hover:bg-blue-200' },
    shipping: { label: 'กำลังส่ง', color: 'bg-yellow-100 text-yellow-700', hoverColor: 'hover:bg-yellow-200' },
    completed: { label: 'สำเร็จ', color: 'bg-green-100 text-green-700', hoverColor: '' },
    cancelled: { label: 'ยกเลิก', color: 'bg-red-100 text-red-700', hoverColor: '' }
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.new;

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${config.color} ${clickable ? `${config.hoverColor} cursor-pointer transition-colors` : ''}`}>
      {config.label}
      {clickable && <ChevronRight className="w-3 h-3" />}
    </span>
  );
}

function PaymentStatusBadge({ status, clickable = false }: { status: string; clickable?: boolean }) {
  const statusConfig = {
    pending: { label: 'รอชำระ', color: 'bg-orange-100 text-orange-700', hoverColor: 'hover:bg-orange-200' },
    paid: { label: 'ชำระแล้ว', color: 'bg-green-100 text-green-700', hoverColor: '' }
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${config.color} ${clickable ? `${config.hoverColor} cursor-pointer transition-colors` : ''}`}>
      {config.label}
      {clickable && <ChevronRight className="w-3 h-3" />}
    </span>
  );
}

export default function OrdersPage() {
  const router = useRouter();
  const { userProfile, loading: authLoading } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [deliveryDateRange, setDeliveryDateRange] = useState<DateValueType>({
    startDate: null,
    endDate: null,
  });

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(20);

  // Status update modal
  const [statusUpdateModal, setStatusUpdateModal] = useState<{
    show: boolean;
    order: Order | null;
    nextStatus: string;
    statusType: 'order' | 'payment';
  }>({
    show: false,
    order: null,
    nextStatus: '',
    statusType: 'order'
  });
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Payment details state (for when updating payment status to 'paid')
  const [paymentDetails, setPaymentDetails] = useState({
    paymentMethod: 'cash', // cash or transfer
    collectedBy: '', // for cash
    transferDate: '', // for transfer
    transferTime: '', // for transfer
    notes: ''
  });

  // Server-side pagination state
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search term (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1); // Reset to page 1 when search changes
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, paymentFilter, recordsPerPage]);

  // Fetch orders with server-side filtering and pagination
  useEffect(() => {
    if (!authLoading && userProfile) {
      fetchOrders();
    }
  }, [authLoading, userProfile, currentPage, recordsPerPage, statusFilter, paymentFilter, debouncedSearch]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No session');
      }

      // Build query params for server-side filtering
      const params = new URLSearchParams();
      params.set('page', currentPage.toString());
      params.set('limit', recordsPerPage.toString());
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (paymentFilter !== 'all') params.set('payment_status', paymentFilter);
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());

      const response = await fetch(`/api/orders?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }

      const result = await response.json();
      setOrders(result.orders || []);
      setTotalOrders(result.pagination?.total || 0);
      setTotalPages(result.pagination?.totalPages || 0);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setError('ไม่สามารถโหลดข้อมูลคำสั่งซื้อได้');
    } finally {
      setLoading(false);
    }
  };

  // Get next order status in flow
  const getNextOrderStatus = (currentStatus: string): string | null => {
    const statusFlow: { [key: string]: string } = {
      'new': 'shipping',
      'shipping': 'completed'
    };
    return statusFlow[currentStatus] || null;
  };

  // Get next payment status (now only pending -> paid)
  const getNextPaymentStatus = (currentStatus: string): string | null => {
    if (currentStatus === 'pending') return 'paid';
    return null; // No next status if already paid
  };

  // Get order status label in Thai
  const getOrderStatusLabel = (status: string): string => {
    const labels: { [key: string]: string } = {
      'new': 'ใหม่',
      'shipping': 'กำลังส่ง',
      'completed': 'สำเร็จ',
      'cancelled': 'ยกเลิก'
    };
    return labels[status] || status;
  };

  // Get payment status label in Thai
  const getPaymentStatusLabel = (status: string): string => {
    const labels: { [key: string]: string } = {
      'pending': 'รอชำระ',
      'paid': 'ชำระแล้ว'
    };
    return labels[status] || status;
  };

  // Handle order status click
  const handleOrderStatusClick = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation(); // Prevent row click

    const nextStatus = getNextOrderStatus(order.order_status);
    if (!nextStatus) return;

    setStatusUpdateModal({
      show: true,
      order,
      nextStatus,
      statusType: 'order'
    });
  };

  // Handle payment status click
  const handlePaymentStatusClick = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation(); // Prevent row click

    const nextStatus = getNextPaymentStatus(order.payment_status);
    if (!nextStatus) return;

    // Reset payment details form
    setPaymentDetails({
      paymentMethod: order.payment_method || 'cash',
      collectedBy: '',
      transferDate: '',
      transferTime: '',
      notes: ''
    });

    setStatusUpdateModal({
      show: true,
      order,
      nextStatus,
      statusType: 'payment'
    });
  };

  // Confirm and update status
  const confirmStatusUpdate = async () => {
    if (!statusUpdateModal.order) return;

    // If updating payment status to 'paid', validate payment details
    if (statusUpdateModal.statusType === 'payment' && statusUpdateModal.nextStatus === 'paid') {
      if (paymentDetails.paymentMethod === 'cash' && !paymentDetails.collectedBy.trim()) {
        alert('กรุณาระบุชื่อคนเก็บเงิน');
        return;
      }
      if (paymentDetails.paymentMethod === 'transfer' && (!paymentDetails.transferDate || !paymentDetails.transferTime)) {
        alert('กรุณาระบุวันที่และเวลาจากสลิป');
        return;
      }
    }

    try {
      setUpdatingStatus(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No session');
      }

      const updateData: any = { id: statusUpdateModal.order.id };

      if (statusUpdateModal.statusType === 'order') {
        updateData.order_status = statusUpdateModal.nextStatus;
      } else {
        updateData.payment_status = statusUpdateModal.nextStatus;
      }

      // Update order status
      const response = await fetch('/api/orders', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      // If updating payment status to 'paid', create payment record
      if (statusUpdateModal.statusType === 'payment' && statusUpdateModal.nextStatus === 'paid') {
        const paymentRecordData = {
          order_id: statusUpdateModal.order.id,
          payment_method: paymentDetails.paymentMethod,
          amount: statusUpdateModal.order.total_amount,
          collected_by: paymentDetails.paymentMethod === 'cash' ? paymentDetails.collectedBy : null,
          transfer_date: paymentDetails.paymentMethod === 'transfer' ? paymentDetails.transferDate : null,
          transfer_time: paymentDetails.paymentMethod === 'transfer' ? paymentDetails.transferTime : null,
          notes: paymentDetails.notes || null
        };

        const paymentResponse = await fetch('/api/payment-records', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(paymentRecordData)
        });

        if (!paymentResponse.ok) {
          const errorData = await paymentResponse.json();
          throw new Error(errorData.error || 'Failed to create payment record');
        }
      }

      // Refresh orders list
      await fetchOrders();

      // Close modal
      setStatusUpdateModal({
        show: false,
        order: null,
        nextStatus: '',
        statusType: 'order'
      });
    } catch (error) {
      console.error('Error updating status:', error);
      alert(error instanceof Error ? error.message : 'ไม่สามารถอัพเดทสถานะได้');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handle delete order (admin only)
  const handleDeleteOrder = async (e: React.MouseEvent, order: Order) => {
    e.stopPropagation(); // Prevent row click

    if (!confirm(`คุณต้องการลบคำสั่งซื้อ "${order.order_number}" หรือไม่?\n\nการลบจะเป็นการลบถาวร ไม่สามารถกู้คืนได้`)) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No session');
      }

      const response = await fetch(`/api/orders?id=${order.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'ไม่สามารถลบคำสั่งซื้อได้');
      }

      // Refresh orders list
      fetchOrders();
    } catch (error) {
      console.error('Error deleting order:', error);
      alert(error instanceof Error ? error.message : 'ไม่สามารถลบคำสั่งซื้อได้');
    }
  };

  // Helper function to check if date matches filter
  const checkDateFilter = (order: Order): boolean => {
    if (!deliveryDateRange?.startDate && !deliveryDateRange?.endDate) return true;
    if (!order.delivery_date) return false;

    const deliveryDate = new Date(order.delivery_date);
    deliveryDate.setHours(0, 0, 0, 0);

    const startDate = deliveryDateRange.startDate ? new Date(String(deliveryDateRange.startDate)) : null;
    const endDate = deliveryDateRange.endDate ? new Date(String(deliveryDateRange.endDate)) : null;
    if (startDate) startDate.setHours(0, 0, 0, 0);
    if (endDate) endDate.setHours(23, 59, 59, 999);

    if (startDate && endDate) {
      return deliveryDate >= startDate && deliveryDate <= endDate;
    } else if (startDate) {
      return deliveryDate >= startDate;
    } else if (endDate) {
      return deliveryDate <= endDate;
    }
    return true;
  };

  // Calculate filtered counts for each status
  const getFilteredCount = (status: string | null = null) => {
    return orders.filter(order => {
      const matchesPayment = paymentFilter === 'all' || order.payment_status === paymentFilter;
      const matchesDate = checkDateFilter(order);
      const matchesStatus = status === null || order.order_status === status;
      return matchesPayment && matchesDate && matchesStatus;
    }).length;
  };

  // Client-side date filter only (server doesn't support date range yet)
  const filteredOrders = orders.filter(order => checkDateFilter(order));

  // Pagination is now handled by server, but we still filter by date client-side
  const displayedOrders = filteredOrders;

  // Calculate display indices for pagination info
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = Math.min(startIndex + displayedOrders.length, totalOrders);
  const totalRecords = totalOrders;

  // Page navigation functions
  const goToFirstPage = () => setCurrentPage(1);
  const goToLastPage = () => setCurrentPage(totalPages);
  const goToPreviousPage = () => setCurrentPage(prev => Math.max(1, prev - 1));
  const goToNextPage = () => setCurrentPage(prev => Math.min(totalPages, prev + 1));
  const goToPage = (page: number) => setCurrentPage(page);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxPagesToShow = 5;

    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  if (authLoading || loading) {
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 text-[#E9B308]" />
            <h1 className="text-3xl font-bold text-gray-900">คำสั่งซื้อ</h1>
          </div>
          <button
            onClick={() => router.push('/orders/new')}
            className="bg-[#E9B308] text-[#00231F] px-4 py-2 rounded-lg hover:bg-[#d4a307] transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            สร้างคำสั่งซื้อ
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Filters Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="space-y-3">
            {/* Row 1: Search + Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="ค้นหาเลขที่, ชื่อลูกค้า, รหัส..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                />
              </div>
              <DateRangePicker
                value={deliveryDateRange}
                onChange={(val) => setDeliveryDateRange(val)}
                placeholder="วันที่ส่ง - ทั้งหมด"
              />
            </div>

            {/* Row 2: Order Status Pills + Payment Status Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Order Status */}
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                ทั้งหมด {getFilteredCount()}
              </button>
              <button
                onClick={() => setStatusFilter('new')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === 'new'
                    ? 'bg-blue-500 text-white'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                ใหม่ {getFilteredCount('new')}
              </button>
              <button
                onClick={() => setStatusFilter('shipping')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === 'shipping'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                }`}
              >
                กำลังส่ง {getFilteredCount('shipping')}
              </button>
              <button
                onClick={() => setStatusFilter('completed')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === 'completed'
                    ? 'bg-green-500 text-white'
                    : 'bg-green-50 text-green-700 hover:bg-green-100'
                }`}
              >
                สำเร็จ {getFilteredCount('completed')}
              </button>
              <button
                onClick={() => setStatusFilter('cancelled')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === 'cancelled'
                    ? 'bg-red-500 text-white'
                    : 'bg-red-50 text-red-700 hover:bg-red-100'
                }`}
              >
                ยกเลิก {getFilteredCount('cancelled')}
              </button>

              {/* Divider */}
              <div className="w-px h-5 bg-gray-300 mx-1 hidden md:block" />

              {/* Payment Status */}
              <button
                onClick={() => setPaymentFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  paymentFilter === 'all'
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                ชำระ: ทั้งหมด
              </button>
              <button
                onClick={() => setPaymentFilter('pending')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  paymentFilter === 'pending'
                    ? 'bg-orange-500 text-white'
                    : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
                }`}
              >
                รอชำระ
              </button>
              <button
                onClick={() => setPaymentFilter('paid')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  paymentFilter === 'paid'
                    ? 'bg-green-500 text-white'
                    : 'bg-green-50 text-green-700 hover:bg-green-100'
                }`}
              >
                ชำระแล้ว
              </button>
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {/* Table Controls - Top */}
          <div className="px-6 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">แสดง</span>
              <select
                value={recordsPerPage}
                onChange={(e) => {
                  setRecordsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-sm text-gray-600">รายการ/หน้า</span>
            </div>
            <div className="text-sm text-gray-600">
              {totalRecords > 0 ? (
                <>
                  <span className="font-medium">{startIndex + 1}-{endIndex}</span>
                  {' / '}
                  <span className="font-medium">{totalRecords}</span>
                </>
              ) : (
                <span>0 / 0</span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    เลขที่คำสั่งซื้อ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ลูกค้า
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    รายการ/สาขา
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ยอดรวม
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    สถานะคำสั่งซื้อ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    สถานะการชำระ
                  </th>
                  {userProfile?.role === 'admin' && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      จัดการ
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {displayedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={userProfile?.role === 'admin' ? 7 : 6} className="px-6 py-12 text-center text-gray-500">
                      {searchTerm || statusFilter !== 'all' || paymentFilter !== 'all' || deliveryDateRange?.startDate ? 'ไม่พบคำสั่งซื้อที่ค้นหา' : 'ยังไม่มีคำสั่งซื้อ'}
                    </td>
                  </tr>
                ) : (
                  displayedOrders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => router.push(`/orders/${order.id}`)}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      {/* เลขที่คำสั่งซื้อ */}
                      <td className="px-6 py-4">
                        <div className="space-y-0.5">
                          {/* วันที่ส่ง - prominent */}
                          {order.delivery_date ? (
                            <div className="font-normal text-gray-900">
                              {new Date(order.delivery_date).toLocaleDateString('th-TH', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </div>
                          ) : (
                            <div className="font-normal text-gray-400">ไม่ระบุวันส่ง</div>
                          )}
                          {/* วันที่เปิดบิล - secondary */}
                          <div className="text-sm text-gray-500">
                            {new Date(order.order_date).toLocaleDateString('th-TH', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </div>
                          {/* หมายเลข order - secondary */}
                          <div className="text-sm text-gray-500">{order.order_number}</div>
                        </div>
                      </td>

                      {/* ลูกค้า */}
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{order.customer_name}</div>
                          <div className="text-xs text-gray-500">{order.customer_code}</div>
                        </div>
                      </td>

                      {/* รายการ/สาขา */}
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {order.branch_names && order.branch_names.length > 0 ? (
                            order.branch_names.map((branchName, index) => (
                              <span
                                key={index}
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                              >
                                {branchName}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-gray-400">ไม่มีข้อมูลสาขา</span>
                          )}
                        </div>
                      </td>

                      {/* ยอดรวม */}
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-gray-900">
                          ฿{order.total_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </div>
                      </td>

                      {/* สถานะคำสั่งซื้อ */}
                      <td className="px-6 py-4">
                        {getNextOrderStatus(order.order_status) ? (
                          <button
                            onClick={(e) => handleOrderStatusClick(e, order)}
                            title={`คลิกเพื่อเปลี่ยนเป็น "${getOrderStatusLabel(getNextOrderStatus(order.order_status) || '')}"`}
                          >
                            <OrderStatusBadge status={order.order_status} clickable />
                          </button>
                        ) : (
                          <OrderStatusBadge status={order.order_status} />
                        )}
                      </td>

                      {/* สถานะการชำระ */}
                      <td className="px-6 py-4">
                        {/* ถ้า order ถูกยกเลิก ไม่ต้องแสดงสถานะการชำระ */}
                        {order.order_status === 'cancelled' ? (
                          <span className="text-gray-400">-</span>
                        ) : getNextPaymentStatus(order.payment_status) ? (
                          <button
                            onClick={(e) => handlePaymentStatusClick(e, order)}
                            title={`คลิกเพื่อเปลี่ยนเป็น "${getPaymentStatusLabel(getNextPaymentStatus(order.payment_status) || '')}"`}
                          >
                            <PaymentStatusBadge status={order.payment_status} clickable />
                          </button>
                        ) : (
                          <PaymentStatusBadge status={order.payment_status} />
                        )}
                      </td>

                      {/* จัดการ (Admin only) */}
                      {userProfile?.role === 'admin' && (
                        <td className="px-6 py-4">
                          <div className="flex justify-end">
                            <button
                              onClick={(e) => handleDeleteOrder(e, order)}
                              className="text-red-600 hover:text-red-900 p-1"
                              title="ลบ (Admin เท่านั้น)"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls - Bottom */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
              {/* Records info */}
              <div className="text-sm text-gray-600">
                {totalRecords > 0 ? (
                  <>
                    แสดง{' '}
                    <span className="font-medium">{startIndex + 1}-{endIndex}</span>
                    {' จาก '}
                    <span className="font-medium">{totalRecords}</span>
                    {' รายการ'}
                  </>
                ) : (
                  <span>ไม่มีรายการ</span>
                )}
              </div>

              {/* Pagination buttons */}
              <div className="flex items-center gap-2">
                {/* First page */}
                <button
                  onClick={goToFirstPage}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="หน้าแรก"
                >
                  «
                </button>

                {/* Previous page */}
                <button
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="หน้าก่อนหน้า"
                >
                  ‹
                </button>

                {/* Page numbers */}
                <div className="flex items-center gap-1">
                  {getPageNumbers().map((page, index) => {
                    if (page === '...') {
                      return (
                        <span key={`ellipsis-${index}`} className="px-2 text-gray-500">
                          ...
                        </span>
                      );
                    }
                    return (
                      <button
                        key={page}
                        onClick={() => goToPage(page as number)}
                        className={`px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors ${
                          currentPage === page
                            ? 'bg-[#E9B308] border-[#E9B308] text-[#00231F]'
                            : 'border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>

                {/* Next page */}
                <button
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="หน้าถัดไป"
                >
                  ›
                </button>

                {/* Last page */}
                <button
                  onClick={goToLastPage}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="หน้าสุดท้าย"
                >
                  »
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Status Update Confirmation Modal */}
        {statusUpdateModal.show && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setStatusUpdateModal({ show: false, order: null, nextStatus: '', statusType: 'order' })}
          >
            <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-4 text-gray-900">
                ยืนยันการเปลี่ยน{statusUpdateModal.statusType === 'order' ? 'สถานะคำสั่งซื้อ' : 'สถานะการชำระเงิน'}
              </h3>

              <div className="mb-6 space-y-3">
                <p className="text-gray-700">
                  คำสั่งซื้อ: <span className="font-medium">{statusUpdateModal.order?.order_number}</span>
                </p>
                <p className="text-gray-700">
                  ลูกค้า: <span className="font-medium">{statusUpdateModal.order?.customer_name}</span>
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-600">เปลี่ยนจาก:</span>
                  {statusUpdateModal.statusType === 'order' ? (
                    <>
                      <OrderStatusBadge status={statusUpdateModal.order?.order_status || ''} />
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                      <OrderStatusBadge status={statusUpdateModal.nextStatus} />
                    </>
                  ) : (
                    <>
                      <PaymentStatusBadge status={statusUpdateModal.order?.payment_status || ''} />
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                      <PaymentStatusBadge status={statusUpdateModal.nextStatus} />
                    </>
                  )}
                </div>

                {/* Payment Details Form (only show when updating payment status to 'paid') */}
                {statusUpdateModal.statusType === 'payment' && statusUpdateModal.nextStatus === 'paid' && (
                  <div className="mt-6 pt-6 border-t space-y-4">
                    <h4 className="font-medium text-gray-900">รายละเอียดการชำระเงิน</h4>

                    <p className="text-sm text-gray-600">
                      ยอดชำระ: <span className="font-semibold text-[#E9B308]">
                        ฿{statusUpdateModal.order?.total_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </span>
                    </p>

                    {/* Payment Method Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        วิธีการชำระเงิน <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setPaymentDetails({ ...paymentDetails, paymentMethod: 'cash' })}
                          className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                            paymentDetails.paymentMethod === 'cash'
                              ? 'border-[#E9B308] bg-[#E9B308] bg-opacity-10 text-[#00231F] font-medium'
                              : 'border-gray-300 text-gray-700 hover:border-gray-400'
                          }`}
                        >
                          เงินสด
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentDetails({ ...paymentDetails, paymentMethod: 'transfer' })}
                          className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                            paymentDetails.paymentMethod === 'transfer'
                              ? 'border-[#E9B308] bg-[#E9B308] bg-opacity-10 text-[#00231F] font-medium'
                              : 'border-gray-300 text-gray-700 hover:border-gray-400'
                          }`}
                        >
                          โอนเงิน
                        </button>
                      </div>
                    </div>

                    {/* Cash Payment Fields */}
                    {paymentDetails.paymentMethod === 'cash' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          ชื่อคนเก็บเงิน <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={paymentDetails.collectedBy}
                          onChange={(e) => setPaymentDetails({ ...paymentDetails, collectedBy: e.target.value })}
                          placeholder="ระบุชื่อคนเก็บเงิน"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                        />
                      </div>
                    )}

                    {/* Transfer Payment Fields */}
                    {paymentDetails.paymentMethod === 'transfer' && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              วันที่จากสลิป <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="date"
                              value={paymentDetails.transferDate}
                              onChange={(e) => setPaymentDetails({ ...paymentDetails, transferDate: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              เวลาจากสลิป <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="time"
                              value={paymentDetails.transferTime}
                              onChange={(e) => setPaymentDetails({ ...paymentDetails, transferTime: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        หมายเหตุ
                      </label>
                      <textarea
                        value={paymentDetails.notes}
                        onChange={(e) => setPaymentDetails({ ...paymentDetails, notes: e.target.value })}
                        placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setStatusUpdateModal({ show: false, order: null, nextStatus: '', statusType: 'order' })}
                  disabled={updatingStatus}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={confirmStatusUpdate}
                  disabled={updatingStatus}
                  className="px-4 py-2 bg-[#E9B308] text-[#00231F] rounded-lg hover:bg-[#d4a307] transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {updatingStatus ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <span>ยืนยัน</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
