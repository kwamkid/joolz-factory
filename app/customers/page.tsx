// Path: app/customers/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import {
  UserCircle,
  Plus,
  Search,
  AlertCircle,
  Check,
  X,
  Loader2,
  Phone,
  MessageCircle,
  Eye,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

// Customer interface
interface Customer {
  id: string;
  customer_code: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  district?: string;
  amphoe?: string;
  province?: string;
  postal_code?: string;
  tax_id?: string;
  customer_type: 'retail' | 'wholesale' | 'distributor';
  customer_type_new?: 'retail' | 'wholesale' | 'distributor'; // From database
  credit_limit: number;
  credit_days: number;
  assigned_salesperson?: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Stats from API
  shipping_address_count?: number;
  line_display_name?: string | null;
  total_order_amount?: number;
}

// Status badge component
function StatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="flex items-center text-green-600">
      <Check className="w-4 h-4 mr-1" />
      <span className="text-sm">ใช้งาน</span>
    </span>
  ) : (
    <span className="flex items-center text-red-600">
      <X className="w-4 h-4 mr-1" />
      <span className="text-sm">ปิดใช้งาน</span>
    </span>
  );
}

// Customer type badge
function CustomerTypeBadge({ type }: { type: string }) {
  const colors = {
    retail: 'bg-blue-100 text-blue-800',
    wholesale: 'bg-purple-100 text-purple-800',
    distributor: 'bg-green-100 text-green-800'
  };

  const labels = {
    retail: 'ขายปลีก',
    wholesale: 'ขายส่ง',
    distributor: 'ตัวแทนจำหน่าย'
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[type as keyof typeof colors]}`}>
      {labels[type as keyof typeof labels]}
    </span>
  );
}

// Form data interface
interface CustomerFormData {
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  district: string;
  amphoe: string;
  province: string;
  postal_code: string;
  tax_id: string;
  customer_type: 'retail' | 'wholesale' | 'distributor';
  credit_limit: number;
  credit_days: number;
  is_active: boolean;
  notes: string;
}

export default function CustomersPage() {
  const { userProfile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataFetched, setDataFetched] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterActive, setFilterActive] = useState<string>('all');
  const [filterLine, setFilterLine] = useState<string>('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  // Form state
  const [formData, setFormData] = useState<CustomerFormData>({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    district: '',
    amphoe: '',
    province: '',
    postal_code: '',
    tax_id: '',
    customer_type: 'retail',
    credit_limit: 0,
    credit_days: 0,
    is_active: true,
    notes: ''
  });

  // Fetch customers function - optimized with single API call
  const fetchCustomers = useCallback(async () => {
    if (dataFetched) return;

    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No session');
      }

      // Fetch customers with stats in single API call
      const customersResponse = await fetch('/api/customers?with_stats=true', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      const customersResult = await customersResponse.json();

      if (!customersResponse.ok) {
        throw new Error(customersResult.error || 'Failed to fetch customers');
      }

      const data = customersResult.customers || [];

      // Map customer_type from database
      const customersWithType = data.map((customer: any) => ({
        ...customer,
        customer_type: customer.customer_type_new || customer.customer_type || 'retail'
      }));

      setCustomers(customersWithType as Customer[]);
      setDataFetched(true);
    } catch (error) {
      console.error('Error fetching customers:', error);
      setError('ไม่สามารถโหลดข้อมูลลูกค้าได้');
    } finally {
      setLoading(false);
    }
  }, [dataFetched]);

  // Check auth
  useEffect(() => {
    if (authLoading) return;

    if (!userProfile) {
      router.push('/login');
      return;
    }

    // Check role permission
    if (!['admin', 'manager', 'sales'].includes(userProfile.role)) {
      router.push('/dashboard');
    }
  }, [userProfile, authLoading, router]);

  // Fetch customers
  useEffect(() => {
    if (!authLoading && userProfile && !dataFetched) {
      fetchCustomers();
    }
  }, [authLoading, userProfile, dataFetched, fetchCustomers]);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Handle create/update customer
  const handleSaveCustomer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    // Validation
    if (!formData.name.trim()) {
      setError('กรุณากรอกชื่อลูกค้า');
      setSaving(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('กรุณาเข้าสู่ระบบใหม่');
        setSaving(false);
        return;
      }

      const url = editingCustomer
        ? '/api/customers'
        : '/api/customers';

      const payload = editingCustomer
        ? { id: editingCustomer.id, ...formData }
        : formData;

      const response = await fetch(url, {
        method: editingCustomer ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'เกิดข้อผิดพลาด');
      }

      setSuccess(editingCustomer ? 'อัพเดทลูกค้าสำเร็จ' : 'สร้างลูกค้าสำเร็จ');
      setShowModal(false);
      setDataFetched(false);
      setTimeout(() => {
        setSuccess('');
        fetchCustomers();
      }, 1500);

      // Reset form
      resetForm();
    } catch (error) {
      console.error('Error saving customer:', error);
      setError(error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSaving(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      district: '',
      amphoe: '',
      province: '',
      postal_code: '',
      tax_id: '',
      customer_type: 'retail',
      credit_limit: 0,
      credit_days: 0,
      is_active: true,
      notes: ''
    });
    setEditingCustomer(null);
  };

  // Handle open modal
  const handleOpenModal = () => {
    resetForm();
    setShowModal(true);
  };

  // Filter customers
  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = searchTerm === '' ||
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.customer_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = filterType === 'all' || customer.customer_type === filterType;
    const matchesActive = filterActive === 'all' ||
      (filterActive === 'true' ? customer.is_active : !customer.is_active);
    const matchesLine = filterLine === 'all' ||
      (filterLine === 'linked' ? !!customer.line_display_name : !customer.line_display_name);

    return matchesSearch && matchesType && matchesActive && matchesLine;
  });

  // Pagination
  const totalPages = Math.ceil(filteredCustomers.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedCustomers = filteredCustomers.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  const handleFilterChange = () => {
    setCurrentPage(1);
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
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <UserCircle className="w-8 h-8 mr-3 text-[#E9B308]" />
              ลูกค้า
            </h1>
            <p className="text-gray-600 mt-1">จัดการข้อมูลลูกค้าและความสัมพันธ์</p>
          </div>

          <button
            onClick={handleOpenModal}
            className="bg-[#E9B308] text-[#00231F] px-4 py-2 rounded-lg hover:bg-[#d4a307] transition-colors flex items-center font-medium"
          >
            <Plus className="w-5 h-5 mr-2" />
            เพิ่มลูกค้า
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
            <span className="text-red-800">{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start">
            <Check className="w-5 h-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
            <span className="text-green-800">{success}</span>
          </div>
        )}

        {/* Filters and Search */}
        <div className="mb-6 flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ, รหัส, เบอร์โทร..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
            />
          </div>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
          >
            <option value="all">ประเภททั้งหมด</option>
            <option value="retail">ขายปลีก</option>
            <option value="wholesale">ขายส่ง</option>
            <option value="distributor">ตัวแทนจำหน่าย</option>
          </select>

          {/* Active Filter */}
          <select
            value={filterActive}
            onChange={(e) => { setFilterActive(e.target.value); setCurrentPage(1); }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
          >
            <option value="all">สถานะทั้งหมด</option>
            <option value="true">ใช้งาน</option>
            <option value="false">ปิดใช้งาน</option>
          </select>

          {/* LINE Filter */}
          <select
            value={filterLine}
            onChange={(e) => { setFilterLine(e.target.value); setCurrentPage(1); }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
          >
            <option value="all">LINE ทั้งหมด</option>
            <option value="linked">เชื่อมต่อ LINE แล้ว</option>
            <option value="not_linked">ยังไม่เชื่อมต่อ</option>
          </select>
        </div>

        {/* Customer Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                    ลูกค้า
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px]">
                    ประเภท
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[110px]">
                    เบอร์โทร
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                    LINE
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px]">
                    ยอดสั่งซื้อ
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[60px]">
                    สาขา
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[90px]">
                    สถานะ
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    onClick={() => router.push(`/customers/${customer.id}`)}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    {/* ลูกค้า: ชื่อ (เด่น) + รหัส (จาง) */}
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <Eye className="w-4 h-4 text-gray-300 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium text-gray-900">{customer.name}</div>
                          <div className="text-xs text-gray-400">{customer.customer_code}</div>
                        </div>
                      </div>
                    </td>

                    {/* ประเภท */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      <CustomerTypeBadge type={customer.customer_type} />
                    </td>

                    {/* เบอร์โทร - กดโทรได้ */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      {customer.phone ? (
                        <a
                          href={`tel:${customer.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          {customer.phone}
                        </a>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>

                    {/* LINE status */}
                    <td className="px-3 py-3">
                      {customer.line_display_name ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-[#06C755]" title="เชื่อมต่อ LINE แล้ว">
                          <MessageCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{customer.line_display_name}</span>
                        </span>
                      ) : (
                        <span className="text-gray-300 text-sm">-</span>
                      )}
                    </td>

                    {/* ยอดสั่งซื้อรวม */}
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      {customer.total_order_amount && customer.total_order_amount > 0 ? (
                        <span className="text-sm font-medium text-gray-900">
                          ฿{customer.total_order_amount.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>

                    {/* สาขา */}
                    <td className="px-3 py-3 text-center">
                      {customer.shipping_address_count && customer.shipping_address_count > 0 ? (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#E9B308]/10 text-[#E9B308] text-sm font-semibold">
                          {customer.shipping_address_count}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-sm">-</span>
                      )}
                    </td>

                    {/* สถานะ */}
                    <td className="px-3 py-3 text-center">
                      <StatusBadge isActive={customer.is_active} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {filteredCustomers.length > 0 && (
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">แสดง</span>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-sm text-gray-600">รายการ/หน้า</span>
            </div>

            <div className="text-sm text-gray-600">
              แสดง {startIndex + 1}-{Math.min(endIndex, filteredCustomers.length)} จาก {filteredCustomers.length} รายการ
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Page numbers */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === pageNum
                        ? 'bg-[#E9B308] text-[#00231F]'
                        : 'border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredCustomers.length === 0 && (
          <div className="text-center py-12">
            <UserCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">ไม่พบข้อมูลลูกค้า</p>
            {searchTerm && (
              <p className="text-gray-400 text-sm mt-2">ลองค้นหาด้วยคำอื่น</p>
            )}
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto relative">
              <div className="p-6">
                <h2 className="text-2xl font-bold mb-6">
                  {editingCustomer ? 'แก้ไขลูกค้า' : 'เพิ่มลูกค้าใหม่'}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                  type="button"
                >
                  <X className="w-6 h-6" />
                </button>

                <form onSubmit={handleSaveCustomer}>
                  {/* Basic Information */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3 text-gray-700">ข้อมูลพื้นฐาน</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          ชื่อลูกค้า <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          ประเภทลูกค้า
                        </label>
                        <select
                          value={formData.customer_type}
                          onChange={(e) => setFormData({ ...formData, customer_type: e.target.value as any })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                        >
                          <option value="retail">ขายปลีก</option>
                          <option value="wholesale">ขายส่ง</option>
                          <option value="distributor">ตัวแทนจำหน่าย</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          ผู้ติดต่อ
                        </label>
                        <input
                          type="text"
                          value={formData.contact_person}
                          onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          เบอร์โทร
                        </label>
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          อีเมล
                        </label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          เลขประจำตัวผู้เสียภาษี
                        </label>
                        <input
                          type="text"
                          value={formData.tax_id}
                          onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Address */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3 text-gray-700">ที่อยู่</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          ที่อยู่
                        </label>
                        <textarea
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                          rows={2}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          ตำบล/แขวง
                        </label>
                        <input
                          type="text"
                          value={formData.district}
                          onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          อำเภอ/เขต
                        </label>
                        <input
                          type="text"
                          value={formData.amphoe}
                          onChange={(e) => setFormData({ ...formData, amphoe: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          จังหวัด
                        </label>
                        <input
                          type="text"
                          value={formData.province}
                          onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          รหัสไปรษณีย์
                        </label>
                        <input
                          type="text"
                          value={formData.postal_code}
                          onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Credit Terms */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3 text-gray-700">เงื่อนไขเครดิต</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          วงเงินเครดิต (บาท)
                        </label>
                        <input
                          type="number"
                          value={formData.credit_limit}
                          onChange={(e) => setFormData({ ...formData, credit_limit: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                          min="0"
                          step="0.01"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          ระยะเวลาเครดิต (วัน)
                        </label>
                        <input
                          type="number"
                          value={formData.credit_days}
                          onChange={(e) => setFormData({ ...formData, credit_days: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                          min="0"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      หมายเหตุ
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                      rows={3}
                    />
                  </div>

                  {/* Status */}
                  <div className="mb-6">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="mr-2"
                      />
                      <span className="text-sm font-medium text-gray-700">ใช้งาน</span>
                    </label>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowModal(false);
                        resetForm();
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                      disabled={saving}
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      className="bg-[#E9B308] text-[#00231F] px-4 py-2 rounded-lg hover:bg-[#d4a307] disabled:opacity-50 flex items-center"
                      disabled={saving}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          กำลังบันทึก...
                        </>
                      ) : (
                        'บันทึก'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
