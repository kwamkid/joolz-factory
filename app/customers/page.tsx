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
  Mail,
  MapPin,
  Building2,
  CreditCard,
  Filter,
  Eye
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
  shipping_address_count?: number;
  shipping_address_names?: string[];
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

  // Fetch customers function
  const fetchCustomers = useCallback(async () => {
    if (dataFetched) return;

    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No session');
      }

      const authHeaders = {
        'Authorization': `Bearer ${session.access_token}`
      };

      // Fetch customers via API
      const customersResponse = await fetch('/api/customers', {
        method: 'GET',
        headers: authHeaders
      });

      const customersResult = await customersResponse.json();

      if (!customersResponse.ok) {
        throw new Error(customersResult.error || 'Failed to fetch customers');
      }

      const data = customersResult.customers || [];

      if (data) {
        // Fetch shipping address counts for all customers
        const customersWithAddresses = await Promise.all(
          data.map(async (customer: any) => {
            try {
              const response = await fetch(`/api/shipping-addresses?customer_id=${customer.id}`, {
                headers: authHeaders
              });

              if (response.ok) {
                const result = await response.json();
                const addresses = result.addresses || [];
                return {
                  ...customer,
                  customer_type: customer.customer_type_new || customer.customer_type || 'retail',
                  shipping_address_count: addresses.length,
                  shipping_address_names: addresses.map((addr: any) => addr.address_name)
                };
              }
            } catch (err) {
              console.error(`Error fetching addresses for customer ${customer.id}:`, err);
            }

            return {
              ...customer,
              customer_type: customer.customer_type_new || customer.customer_type || 'retail',
              shipping_address_count: 0,
              shipping_address_names: []
            };
          })
        );

        setCustomers(customersWithAddresses as Customer[]);
        setDataFetched(true);
      }
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

    return matchesSearch && matchesType && matchesActive;
  });

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
            onChange={(e) => setFilterType(e.target.value)}
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
            onChange={(e) => setFilterActive(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
          >
            <option value="all">สถานะทั้งหมด</option>
            <option value="true">ใช้งาน</option>
            <option value="false">ปิดใช้งาน</option>
          </select>
        </div>

        {/* Customer Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ชื่อลูกค้า
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ประเภท
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ผู้ติดต่อ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    สาขา
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    จังหวัด
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    สถานะ
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    onClick={() => router.push(`/customers/${customer.id}`)}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    {/* ชื่อลูกค้า: รหัส + ชื่อ + วงเงิน */}
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-2">
                        <Eye className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="text-xs text-gray-400 mb-0.5">{customer.customer_code}</div>
                          <div className="font-medium text-gray-900">{customer.name}</div>
                          {customer.credit_limit > 0 && (
                            <div className="text-sm text-[#E9B308] font-medium mt-1">
                              ฿{customer.credit_limit.toLocaleString()}
                              {customer.credit_days > 0 && (
                                <span className="text-xs text-gray-500 ml-1">({customer.credit_days} วัน)</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* ประเภท */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <CustomerTypeBadge type={customer.customer_type} />
                    </td>

                    {/* ผู้ติดต่อ: ชื่อ + เบอร์โทร */}
                    <td className="px-6 py-4">
                      {customer.contact_person || customer.phone ? (
                        <div>
                          {customer.contact_person && (
                            <div className="text-sm text-gray-900">{customer.contact_person}</div>
                          )}
                          {customer.phone && (
                            <div className="text-sm text-gray-500 mt-0.5">{customer.phone}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>

                    {/* สาขา: จำนวนเท่านั้น */}
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {customer.shipping_address_count ? (
                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#E9B308] bg-opacity-10 text-[#E9B308] font-semibold">
                          {customer.shipping_address_count}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>

                    {/* จังหวัด */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {customer.province || '-'}
                    </td>

                    {/* สถานะ */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge isActive={customer.is_active} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

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
