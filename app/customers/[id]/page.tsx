// Path: app/customers/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  Edit2,
  MapPin,
  Phone,
  Mail,
  Building2,
  CreditCard,
  Plus,
  Trash2,
  Star,
  ExternalLink,
  Loader2,
  AlertCircle,
  Check
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
  customer_type_new?: 'retail' | 'wholesale' | 'distributor';
  credit_limit: number;
  credit_days: number;
  is_active: boolean;
  notes?: string;
  created_at: string;
}

// Shipping Address interface
interface ShippingAddress {
  id: string;
  customer_id: string;
  address_name: string;
  contact_person?: string;
  phone?: string;
  address_line1: string;
  address_line2?: string;
  district?: string;
  amphoe?: string;
  province: string;
  postal_code?: string;
  google_maps_link?: string;
  delivery_notes?: string;
  is_default: boolean;
  is_active: boolean;
}

export default function CustomerDetailPage() {
  const { userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<ShippingAddress | null>(null);
  const [saving, setSaving] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Address form state
  const [addressForm, setAddressForm] = useState({
    address_name: '',
    contact_person: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    district: '',
    amphoe: '',
    province: '',
    postal_code: '',
    google_maps_link: '',
    delivery_notes: '',
    is_default: false
  });

  // Customer edit form state
  const [customerForm, setCustomerForm] = useState({
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
    customer_type: 'retail' as 'retail' | 'wholesale' | 'distributor',
    credit_limit: 0,
    credit_days: 0,
    is_active: true,
    notes: ''
  });

  // Fetch customer details
  useEffect(() => {
    if (!authLoading && userProfile && customerId) {
      fetchCustomerDetails();
      fetchShippingAddresses();
    }
  }, [authLoading, userProfile, customerId]);

  const fetchCustomerDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (error) throw error;

      if (data) {
        const customerData = {
          ...data,
          customer_type: data.customer_type_new || data.customer_type || 'retail'
        };
        setCustomer(customerData);

        // Populate edit form
        setCustomerForm({
          name: customerData.name,
          contact_person: customerData.contact_person || '',
          phone: customerData.phone || '',
          email: customerData.email || '',
          address: customerData.address || '',
          district: customerData.district || '',
          amphoe: customerData.amphoe || '',
          province: customerData.province || '',
          postal_code: customerData.postal_code || '',
          tax_id: customerData.tax_id || '',
          customer_type: customerData.customer_type,
          credit_limit: customerData.credit_limit,
          credit_days: customerData.credit_days,
          is_active: customerData.is_active,
          notes: customerData.notes || ''
        });
      }
    } catch (error) {
      console.error('Error fetching customer:', error);
      setError('ไม่สามารถโหลดข้อมูลลูกค้าได้');
    } finally {
      setLoading(false);
    }
  };

  const fetchShippingAddresses = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/shipping-addresses?customer_id=${customerId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      const result = await response.json();
      if (response.ok) {
        setAddresses(result.addresses || []);
      }
    } catch (error) {
      console.error('Error fetching addresses:', error);
    }
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('กรุณาเข้าสู่ระบบใหม่');
        setSaving(false);
        return;
      }

      const url = '/api/shipping-addresses';
      const method = editingAddress ? 'PUT' : 'POST';
      const payload = editingAddress
        ? { id: editingAddress.id, ...addressForm }
        : { customer_id: customerId, ...addressForm };

      const response = await fetch(url, {
        method,
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

      setSuccess(editingAddress ? 'อัพเดทที่อยู่สำเร็จ' : 'เพิ่มที่อยู่สำเร็จ');
      setShowAddressModal(false);
      fetchShippingAddresses();
      resetAddressForm();

      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error saving address:', error);
      setError(error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!confirm('คุณต้องการลบที่อยู่นี้ใช่หรือไม่?')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/shipping-addresses?id=${addressId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        setSuccess('ลบที่อยู่สำเร็จ');
        fetchShippingAddresses();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (error) {
      console.error('Error deleting address:', error);
      setError('ไม่สามารถลบที่อยู่ได้');
    }
  };

  const resetAddressForm = () => {
    setAddressForm({
      address_name: '',
      contact_person: '',
      phone: '',
      address_line1: '',
      address_line2: '',
      district: '',
      amphoe: '',
      province: '',
      postal_code: '',
      google_maps_link: '',
      delivery_notes: '',
      is_default: false
    });
    setEditingAddress(null);
  };

  const handleEditAddress = (address: ShippingAddress) => {
    setEditingAddress(address);
    setAddressForm({
      address_name: address.address_name,
      contact_person: address.contact_person || '',
      phone: address.phone || '',
      address_line1: address.address_line1,
      address_line2: address.address_line2 || '',
      district: address.district || '',
      amphoe: address.amphoe || '',
      province: address.province,
      postal_code: address.postal_code || '',
      google_maps_link: address.google_maps_link || '',
      delivery_notes: address.delivery_notes || '',
      is_default: address.is_default
    });
    setShowAddressModal(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('กรุณาเข้าสู่ระบบใหม่');
        setSaving(false);
        return;
      }

      const response = await fetch('/api/customers', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          id: customerId,
          ...customerForm
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'เกิดข้อผิดพลาด');
      }

      setSuccess('อัพเดทข้อมูลลูกค้าสำเร็จ');
      setShowEditModal(false);
      fetchCustomerDetails();

      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error saving customer:', error);
      setError(error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSaving(false);
    }
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

  if (!customer) {
    return (
      <Layout>
        <div className="p-6">
          <div className="text-center py-12">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">ไม่พบข้อมูลลูกค้า</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/customers')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            กลับไปหน้ารายการลูกค้า
          </button>

          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{customer.name}</h1>
              <p className="text-gray-600 mt-1">รหัส: {customer.customer_code}</p>
            </div>
            <button
              onClick={() => setShowEditModal(true)}
              className="bg-[#E9B308] text-[#00231F] px-4 py-2 rounded-lg hover:bg-[#d4a307] transition-colors flex items-center"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              แก้ไขข้อมูล
            </button>
          </div>
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

        {/* Customer Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Contact Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">ข้อมูลติดต่อ</h2>
            <div className="space-y-3">
              {customer.contact_person && (
                <div className="flex items-start">
                  <Building2 className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">ผู้ติดต่อ</p>
                    <p className="text-gray-900">{customer.contact_person}</p>
                  </div>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-start">
                  <Phone className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">เบอร์โทร</p>
                    <p className="text-gray-900">{customer.phone}</p>
                  </div>
                </div>
              )}
              {customer.email && (
                <div className="flex items-start">
                  <Mail className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">อีเมล</p>
                    <p className="text-gray-900">{customer.email}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Address */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">ที่อยู่</h2>
            <div className="flex items-start">
              <MapPin className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
              <div className="text-gray-900">
                {[
                  customer.address,
                  customer.district,
                  customer.amphoe,
                  customer.province,
                  customer.postal_code
                ].filter(Boolean).join(' ') || '-'}
              </div>
            </div>
          </div>

          {/* Credit Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">เงื่อนไขเครดิต</h2>
            <div className="flex items-start">
              <CreditCard className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">วงเงินเครดิต</p>
                <p className="text-gray-900 font-semibold text-lg">
                  ฿{customer.credit_limit.toLocaleString()}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  ระยะเวลา {customer.credit_days} วัน
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Shipping Addresses */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">ที่อยู่จัดส่ง</h2>
            <button
              onClick={() => {
                resetAddressForm();
                setShowAddressModal(true);
              }}
              className="bg-[#E9B308] text-[#00231F] px-4 py-2 rounded-lg hover:bg-[#d4a307] transition-colors flex items-center text-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              เพิ่มที่อยู่
            </button>
          </div>

          {addresses.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MapPin className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>ยังไม่มีที่อยู่จัดส่ง</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {addresses.map((address) => (
                <div
                  key={address.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-[#E9B308] transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{address.address_name}</h3>
                      {address.is_default && (
                        <span className="flex items-center text-xs bg-[#E9B308] text-[#00231F] px-2 py-0.5 rounded">
                          <Star className="w-3 h-3 mr-1" />
                          หลัก
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditAddress(address)}
                        className="text-gray-600 hover:text-[#E9B308]"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteAddress(address.id)}
                        className="text-gray-600 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="text-sm text-gray-600 space-y-1">
                    <p>
                      {[
                        address.address_line1,
                        address.address_line2,
                        address.district,
                        address.amphoe,
                        address.province,
                        address.postal_code
                      ].filter(Boolean).join(' ')}
                    </p>

                    {address.contact_person && (
                      <p className="flex items-center">
                        <Building2 className="w-3 h-3 mr-1" />
                        {address.contact_person}
                      </p>
                    )}

                    {address.phone && (
                      <p className="flex items-center">
                        <Phone className="w-3 h-3 mr-1" />
                        {address.phone}
                      </p>
                    )}

                    {address.google_maps_link && (
                      <a
                        href={address.google_maps_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center text-[#E9B308] hover:underline"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        เปิด Google Maps
                      </a>
                    )}

                    {address.delivery_notes && (
                      <p className="text-xs text-gray-500 mt-2 p-2 bg-gray-50 rounded">
                        หมายเหตุ: {address.delivery_notes}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Edit Customer Modal */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-2xl font-bold mb-6">แก้ไขข้อมูลลูกค้า</h2>

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
                          value={customerForm.name}
                          onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          ประเภทลูกค้า
                        </label>
                        <select
                          value={customerForm.customer_type}
                          onChange={(e) => setCustomerForm({ ...customerForm, customer_type: e.target.value as any })}
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
                          value={customerForm.contact_person}
                          onChange={(e) => setCustomerForm({ ...customerForm, contact_person: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          เบอร์โทร
                        </label>
                        <input
                          type="tel"
                          value={customerForm.phone}
                          onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          อีเมล
                        </label>
                        <input
                          type="email"
                          value={customerForm.email}
                          onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          เลขประจำตัวผู้เสียภาษี
                        </label>
                        <input
                          type="text"
                          value={customerForm.tax_id}
                          onChange={(e) => setCustomerForm({ ...customerForm, tax_id: e.target.value })}
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
                          value={customerForm.address}
                          onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
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
                          value={customerForm.district}
                          onChange={(e) => setCustomerForm({ ...customerForm, district: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          อำเภอ/เขต
                        </label>
                        <input
                          type="text"
                          value={customerForm.amphoe}
                          onChange={(e) => setCustomerForm({ ...customerForm, amphoe: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          จังหวัด
                        </label>
                        <input
                          type="text"
                          value={customerForm.province}
                          onChange={(e) => setCustomerForm({ ...customerForm, province: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          รหัสไปรษณีย์
                        </label>
                        <input
                          type="text"
                          value={customerForm.postal_code}
                          onChange={(e) => setCustomerForm({ ...customerForm, postal_code: e.target.value })}
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
                          value={customerForm.credit_limit}
                          onChange={(e) => setCustomerForm({ ...customerForm, credit_limit: parseFloat(e.target.value) || 0 })}
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
                          value={customerForm.credit_days}
                          onChange={(e) => setCustomerForm({ ...customerForm, credit_days: parseInt(e.target.value) || 0 })}
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
                      value={customerForm.notes}
                      onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                      rows={3}
                    />
                  </div>

                  {/* Status */}
                  <div className="mb-6">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={customerForm.is_active}
                        onChange={(e) => setCustomerForm({ ...customerForm, is_active: e.target.checked })}
                        className="mr-2"
                      />
                      <span className="text-sm font-medium text-gray-700">ใช้งาน</span>
                    </label>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowEditModal(false)}
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

        {/* Address Modal */}
        {showAddressModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-2xl font-bold mb-6">
                  {editingAddress ? 'แก้ไขที่อยู่จัดส่ง' : 'เพิ่มที่อยู่จัดส่ง'}
                </h2>

                <form onSubmit={handleSaveAddress}>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ชื่อสาขา/จุดส่ง <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={addressForm.address_name}
                        onChange={(e) => setAddressForm({ ...addressForm, address_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                        placeholder="เช่น สาขาลาดพร้าว, คลังบางนา"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          ผู้รับ
                        </label>
                        <input
                          type="text"
                          value={addressForm.contact_person}
                          onChange={(e) => setAddressForm({ ...addressForm, contact_person: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          เบอร์โทร
                        </label>
                        <input
                          type="tel"
                          value={addressForm.phone}
                          onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ที่อยู่ บรรทัด 1 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={addressForm.address_line1}
                        onChange={(e) => setAddressForm({ ...addressForm, address_line1: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ที่อยู่ บรรทัด 2
                      </label>
                      <input
                        type="text"
                        value={addressForm.address_line2}
                        onChange={(e) => setAddressForm({ ...addressForm, address_line2: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          ตำบล/แขวง
                        </label>
                        <input
                          type="text"
                          value={addressForm.district}
                          onChange={(e) => setAddressForm({ ...addressForm, district: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          อำเภอ/เขต
                        </label>
                        <input
                          type="text"
                          value={addressForm.amphoe}
                          onChange={(e) => setAddressForm({ ...addressForm, amphoe: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          จังหวัด <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={addressForm.province}
                          onChange={(e) => setAddressForm({ ...addressForm, province: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          รหัสไปรษณีย์
                        </label>
                        <input
                          type="text"
                          value={addressForm.postal_code}
                          onChange={(e) => setAddressForm({ ...addressForm, postal_code: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Google Maps Link
                      </label>
                      <input
                        type="url"
                        value={addressForm.google_maps_link}
                        onChange={(e) => setAddressForm({ ...addressForm, google_maps_link: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                        placeholder="https://maps.google.com/..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        หมายเหตุสำหรับคนส่งของ
                      </label>
                      <textarea
                        value={addressForm.delivery_notes}
                        onChange={(e) => setAddressForm({ ...addressForm, delivery_notes: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                        rows={3}
                        placeholder="เช่น เข้าประตูด้านหลัง, ติดต่อ 5 นาทีก่อนถึง"
                      />
                    </div>

                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={addressForm.is_default}
                          onChange={(e) => setAddressForm({ ...addressForm, is_default: e.target.checked })}
                          className="mr-2"
                        />
                        <span className="text-sm font-medium text-gray-700">ตั้งเป็นที่อยู่หลัก</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddressModal(false);
                        resetAddressForm();
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
