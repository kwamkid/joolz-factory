// Path: app/suppliers/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import {
  Truck,
  Plus,
  Edit2,
  Search,
  AlertCircle,
  Check,
  X,
  Loader2,
  Phone,
  Mail,
  MapPin,
  Star,
  Ban,
  Leaf
} from 'lucide-react';
import { getImageUrl } from '@/lib/utils/image';

// Supplier interface
interface Supplier {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address: string;
  line_id?: string;
  rating: number;
  average_price: number;
  status: 'active' | 'banned';
  raw_materials: string[];
  image?: string;
  created_at: string;
  updated_at: string;
}

// Status badge component
function StatusBadge({ status }: { status: 'active' | 'banned' }) {
  return status === 'active' ? (
    <span className="flex items-center text-green-600">
      <Check className="w-4 h-4 mr-1" />
      <span className="text-sm">ใช้งาน</span>
    </span>
  ) : (
    <span className="flex items-center text-red-600">
      <Ban className="w-4 h-4 mr-1" />
      <span className="text-sm">ระงับ</span>
    </span>
  );
}

// Rating display
function RatingDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center space-x-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-4 h-4 ${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
        />
      ))}
      <span className="text-sm text-gray-600 ml-1">({rating})</span>
    </div>
  );
}

// Form data interface
interface SupplierFormData {
  name: string;
  phone: string;
  email: string;
  address: string;
  line_id: string;
  rating: number;
  average_price: number;
  status: 'active' | 'banned';
  raw_materials: string[];
}

export default function SuppliersPage() {
  const { userProfile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataFetched, setDataFetched] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rawMaterials, setRawMaterials] = useState<Array<{ id: string; name: string; image?: string }>>([]);

  // Form state
  const [formData, setFormData] = useState<SupplierFormData>({
    name: '',
    phone: '',
    email: '',
    address: '',
    line_id: '',
    rating: 0,
    average_price: 0,
    status: 'active',
    raw_materials: []
  });

  // Fetch raw materials function
  const fetchRawMaterials = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();

      const response = await fetch('/api/raw-materials', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionData?.session?.access_token || ''}`
        }
      });

      const result = await response.json();

      if (!response.ok) {
        console.warn('ไม่สามารถโหลดวัตถุดิบได้:', result.error);
        setRawMaterials([]);
        return;
      }

      if (result.materials) {
        // Sort by name
        const sortedMaterials = result.materials.sort((a: { name: string }, b: { name: string }) =>
          a.name.localeCompare(b.name)
        );
        setRawMaterials(sortedMaterials);
      } else {
        setRawMaterials([]);
      }
    } catch (error) {
      console.warn('เกิดข้อผิดพลาดในการโหลดวัตถุดิบ');
      setRawMaterials([]);
    }
  }, []);

  // Fetch suppliers function
  const fetchSuppliers = useCallback(async () => {
    if (dataFetched) return;

    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();

      const response = await fetch('/api/suppliers', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionData?.session?.access_token || ''}`
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch suppliers');
      }

      if (result.suppliers) {
        setSuppliers(result.suppliers as Supplier[]);
        setDataFetched(true);
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      setError('ไม่สามารถโหลดข้อมูลซัพพลายเออร์ได้');
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
  }, [userProfile, authLoading, router]);

  // Fetch suppliers and raw materials
  useEffect(() => {
    if (!authLoading && userProfile && !dataFetched) {
      fetchSuppliers();
      fetchRawMaterials();
    }
  }, [authLoading, userProfile, dataFetched, fetchSuppliers, fetchRawMaterials]);

  // Handle create/update supplier
  const handleSaveSupplier = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    // Validation
    if (!formData.name.trim()) {
      setError('กรุณากรอกชื่อซัพพลายเออร์');
      setSaving(false);
      return;
    }

    if (!formData.phone.trim()) {
      setError('กรุณากรอกเบอร์โทร');
      setSaving(false);
      return;
    }

    // Validate phone number format (Thai format)
    const phoneRegex = /^[0-9]{9,10}$/;
    if (!phoneRegex.test(formData.phone.replace(/-/g, ''))) {
      setError('รูปแบบเบอร์โทรไม่ถูกต้อง (ต้องเป็นตัวเลข 9-10 หลัก)');
      setSaving(false);
      return;
    }

    if (!formData.address.trim()) {
      setError('กรุณากรอกที่อยู่');
      setSaving(false);
      return;
    }

    // Validate email if provided
    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        setError('รูปแบบอีเมลไม่ถูกต้อง');
        setSaving(false);
        return;
      }
    }

    // Validate rating
    if (formData.rating < 0 || formData.rating > 5) {
      setError('คะแนนต้องอยู่ระหว่าง 0-5');
      setSaving(false);
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (editingSupplier) {
        // Update existing supplier
        const response = await fetch('/api/suppliers', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData?.session?.access_token || ''}`
          },
          body: JSON.stringify({
            id: editingSupplier.id,
            name: formData.name,
            phone: formData.phone,
            email: formData.email,
            address: formData.address,
            line_id: formData.line_id,
            rating: formData.rating,
            average_price: formData.average_price,
            status: formData.status,
            raw_materials: formData.raw_materials
          })
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'ไม่สามารถอัพเดทซัพพลายเออร์ได้');
        }

        setSuccess('อัพเดทข้อมูลซัพพลายเออร์สำเร็จ');
      } else {
        // Create new supplier
        const response = await fetch('/api/suppliers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData?.session?.access_token || ''}`
          },
          body: JSON.stringify({
            name: formData.name,
            phone: formData.phone,
            email: formData.email,
            address: formData.address,
            line_id: formData.line_id,
            rating: formData.rating,
            average_price: formData.average_price,
            status: formData.status,
            raw_materials: formData.raw_materials
          })
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'ไม่สามารถสร้างซัพพลายเออร์ได้');
        }

        setSuccess('เพิ่มซัพพลายเออร์ใหม่สำเร็จ');
      }

      // Reset form and refresh
      setShowModal(false);
      setEditingSupplier(null);
      setFormData({
        name: '',
        phone: '',
        email: '',
        address: '',
        line_id: '',
        rating: 0,
        average_price: 0,
        status: 'active',
        raw_materials: []
      });

      // Refetch suppliers
      setDataFetched(false);
      fetchSuppliers();
    } catch (error) {
      console.error('Error saving supplier:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      }
    } finally {
      setSaving(false);
    }
  };

  // Handle toggle supplier status
  const handleToggleSupplierStatus = async (supplier: Supplier) => {
    const newStatus = supplier.status === 'active' ? 'banned' : 'active';
    const action = newStatus === 'active' ? 'เปิดใช้งาน' : 'ระงับ';

    if (!confirm(`คุณต้องการ${action}ซัพพลายเออร์นี้หรือไม่?`)) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      const response = await fetch('/api/suppliers', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData?.session?.access_token || ''}`
        },
        body: JSON.stringify({
          id: supplier.id,
          name: supplier.name,
          phone: supplier.phone,
          email: supplier.email,
          address: supplier.address,
          line_id: supplier.line_id,
          rating: supplier.rating,
          average_price: supplier.average_price,
          status: newStatus,
          raw_materials: supplier.raw_materials
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `ไม่สามารถ${action}ซัพพลายเออร์ได้`);
      }

      setSuccess(`${action}ซัพพลายเออร์สำเร็จ`);
      setDataFetched(false);
      fetchSuppliers();
    } catch (error) {
      console.error('Error toggling supplier status:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError(`ไม่สามารถ${action}ซัพพลายเออร์ได้`);
      }
    }
  };

  // Handle edit supplier
  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      phone: supplier.phone,
      email: supplier.email || '',
      address: supplier.address,
      line_id: supplier.line_id || '',
      rating: supplier.rating,
      average_price: supplier.average_price,
      status: supplier.status,
      raw_materials: supplier.raw_materials || []
    });
    setShowModal(true);
  };

  // Filter suppliers based on search
  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Clear alerts after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('');
        setSuccess('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#00231F]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#E9B308] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">กำลังตรวจสอบสิทธิ์...</p>
        </div>
      </div>
    );
  }

  // Not authorized
  if (!userProfile) {
    return null;
  }

  // Loading suppliers
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#00231F]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#E9B308] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <Layout
      title="จัดการซัพพลายเออร์"
      breadcrumbs={[
        { label: 'หน้าแรก', href: '/dashboard' },
        { label: 'จัดการซัพพลายเออร์' }
      ]}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center space-x-3">
          <Truck className="w-8 h-8 text-[#E9B308]" />
          <div>
            <p className="text-sm text-gray-500">จำนวนซัพพลายเออร์ทั้งหมด</p>
            <p className="text-2xl font-bold text-gray-900">{suppliers.length} ราย</p>
          </div>
        </div>

        <button
          onClick={() => {
            setEditingSupplier(null);
            setFormData({
              name: '',
              phone: '',
              email: '',
              address: '',
              line_id: '',
              rating: 0,
              average_price: 0,
              status: 'active',
              raw_materials: []
            });
            setShowModal(true);
          }}
          className="flex items-center px-4 py-2 bg-[#E9B308] text-[#00231F] rounded-lg hover:bg-[#E9B308]/90 font-medium transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          เพิ่มซัพพลายเออร์ใหม่
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button
            onClick={() => setError('')}
            className="text-red-500 hover:text-red-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start space-x-3">
          <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-green-700">{success}</p>
          </div>
          <button
            onClick={() => setSuccess('')}
            className="text-green-500 hover:text-green-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อ เบอร์โทร หรือที่อยู่..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
          />
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ซัพพลายเออร์
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ที่อยู่
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  คะแนน
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ราคาเฉลี่ย
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
              {filteredSuppliers.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {supplier.name}
                      </div>
                      <div className="text-sm text-gray-500 flex items-center mt-1">
                        <Phone className="w-3 h-3 mr-1" />
                        {supplier.phone}
                      </div>
                      {supplier.email && (
                        <div className="text-sm text-gray-500 flex items-center">
                          <Mail className="w-3 h-3 mr-1" />
                          {supplier.email}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-500 flex items-start max-w-xs">
                      <MapPin className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" />
                      <span className="line-clamp-2">{supplier.address}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <RatingDisplay rating={supplier.rating} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {supplier.average_price.toLocaleString('th-TH')} ฿
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={supplier.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => handleEditSupplier(supplier)}
                        className="text-[#E9B308] hover:text-[#E9B308]/80 p-1"
                        title="แก้ไข"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleSupplierStatus(supplier)}
                        className={supplier.status === 'active' ? 'text-red-600 hover:text-red-900 p-1' : 'text-green-600 hover:text-green-900 p-1'}
                        title={supplier.status === 'active' ? 'ระงับ' : 'เปิดใช้งาน'}
                      >
                        {supplier.status === 'active' ? (
                          <Ban className="w-4 h-4" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredSuppliers.length === 0 && (
            <div className="text-center py-12">
              <Truck className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">ไม่พบซัพพลายเออร์</p>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen p-4">
            <div
              className="fixed inset-0 bg-black/50 transition-opacity"
              onClick={() => setShowModal(false)}
            />

            <div className="relative bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-5 border-b">
                <h3 className="text-xl font-semibold text-gray-900">
                  {editingSupplier ? 'แก้ไขข้อมูลซัพพลายเออร์' : 'เพิ่มซัพพลายเออร์ใหม่'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveSupplier} className="p-5">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ชื่อซัพพลายเออร์ *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                      required
                      placeholder="บริษัท ABC"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      เบอร์โทร *
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                      required
                      placeholder="0812345678"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                      placeholder="supplier@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ที่อยู่ *
                    </label>
                    <textarea
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                      required
                      rows={3}
                      placeholder="123 ถนน... แขวง... เขต..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      LINE ID
                    </label>
                    <input
                      type="text"
                      value={formData.line_id}
                      onChange={(e) => setFormData({ ...formData, line_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                      placeholder="@supplier"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      คะแนน (0-5)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="5"
                      step="1"
                      value={formData.rating}
                      onChange={(e) => setFormData({ ...formData, rating: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ราคาเฉลี่ย (บาท)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.average_price}
                      onChange={(e) => setFormData({ ...formData, average_price: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      สถานะ
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'banned' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                    >
                      <option value="active">ใช้งาน</option>
                      <option value="banned">ระงับ</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      วัตถุดิบที่จัดหา
                    </label>
                    <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-lg p-3 space-y-2">
                      {rawMaterials.length === 0 ? (
                        <p className="text-sm text-gray-500">ไม่มีวัตถุดิบในระบบ</p>
                      ) : (
                        rawMaterials.map((rm) => (
                          <label key={rm.id} className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors">
                            <input
                              type="checkbox"
                              checked={formData.raw_materials.includes(rm.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData({
                                    ...formData,
                                    raw_materials: [...formData.raw_materials, rm.id]
                                  });
                                } else {
                                  setFormData({
                                    ...formData,
                                    raw_materials: formData.raw_materials.filter(id => id !== rm.id)
                                  });
                                }
                              }}
                              className="rounded border-gray-300 text-[#E9B308] focus:ring-[#E9B308] flex-shrink-0"
                            />
                            <div className="flex items-center space-x-2 flex-1">
                              <div className="flex-shrink-0 w-10 h-10">
                                {rm.image ? (
                                  <img
                                    src={getImageUrl(rm.image)}
                                    alt={rm.name}
                                    className="w-10 h-10 rounded object-cover"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                      target.nextElementSibling?.classList.remove('hidden');
                                    }}
                                  />
                                ) : null}
                                <div className={`w-10 h-10 rounded bg-[#E9B308]/20 flex items-center justify-center ${rm.image ? 'hidden' : ''}`}>
                                  <Leaf className="w-5 h-5 text-[#E9B308]" />
                                </div>
                              </div>
                              <span className="text-sm text-gray-700 font-medium">{rm.name}</span>
                            </div>
                          </label>
                        ))
                      )}
                    </div>
                    {formData.raw_materials.length > 0 && (
                      <p className="mt-2 text-xs text-gray-500">
                        เลือกแล้ว {formData.raw_materials.length} รายการ
                      </p>
                    )}
                  </div>

                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-[#E9B308] text-[#00231F] rounded-lg hover:bg-[#E9B308]/90 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    {editingSupplier ? 'บันทึก' : 'เพิ่มซัพพลายเออร์'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
