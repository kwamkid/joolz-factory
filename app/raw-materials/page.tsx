// Path: app/raw-materials/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import {
  Box,
  Plus,
  Edit2,
  Search,
  AlertCircle,
  Check,
  X,
  Loader2,
  Trash2,
  AlertTriangle,
  Package
} from 'lucide-react';
import { getImageUrl } from '@/lib/utils/image';

// Raw Material interface
interface RawMaterial {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  average_price: number;
  image?: string;
  created_at: string;
  updated_at: string;
}

// Stock status badge
function StockStatusBadge({ stock, minStock }: { stock: number; minStock: number }) {
  const isLow = stock <= minStock;
  return isLow ? (
    <span className="flex items-center text-red-600">
      <AlertTriangle className="w-4 h-4 mr-1" />
      <span className="text-sm">สต็อกต่ำ</span>
    </span>
  ) : (
    <span className="flex items-center text-green-600">
      <Check className="w-4 h-4 mr-1" />
      <span className="text-sm">ปกติ</span>
    </span>
  );
}

// Form data interface
interface RawMaterialFormData {
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  average_price: number;
  image: string;
}

export default function RawMaterialsPage() {
  const { userProfile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataFetched, setDataFetched] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [formData, setFormData] = useState<RawMaterialFormData>({
    name: '',
    unit: 'kg',
    current_stock: 0,
    min_stock: 0,
    average_price: 0,
    image: ''
  });

  // Fetch materials function
  const fetchMaterials = useCallback(async () => {
    if (dataFetched) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('raw_materials')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setMaterials(data as RawMaterial[]);
        setDataFetched(true);
      }
    } catch (error) {
      console.error('Error fetching materials:', error);
      setError('ไม่สามารถโหลดข้อมูลวัตถุดิบได้');
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

  // Fetch materials
  useEffect(() => {
    if (!authLoading && userProfile && !dataFetched) {
      fetchMaterials();
    }
  }, [authLoading, userProfile, dataFetched, fetchMaterials]);

  // Handle create/update material
  const handleSaveMaterial = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    // Validation
    if (!formData.name.trim()) {
      setError('กรุณากรอกชื่อวัตถุดิบ');
      setSaving(false);
      return;
    }

    if (!formData.unit.trim()) {
      setError('กรุณาเลือกหน่วย');
      setSaving(false);
      return;
    }

    if (formData.current_stock < 0) {
      setError('จำนวนสต็อกต้องไม่ติดลบ');
      setSaving(false);
      return;
    }

    if (formData.min_stock < 0) {
      setError('สต็อกขั้นต่ำต้องไม่ติดลบ');
      setSaving(false);
      return;
    }

    if (formData.average_price < 0) {
      setError('ราคาเฉลี่ยต้องไม่ติดลบ');
      setSaving(false);
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (editingMaterial) {
        // Update existing material
        const response = await fetch('/api/raw-materials', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData?.session?.access_token || ''}`
          },
          body: JSON.stringify({
            id: editingMaterial.id,
            name: formData.name,
            unit: formData.unit,
            current_stock: formData.current_stock,
            min_stock: formData.min_stock,
            average_price: formData.average_price,
            image: formData.image
          })
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'ไม่สามารถอัพเดทวัตถุดิบได้');
        }

        setSuccess('อัพเดทข้อมูลวัตถุดิบสำเร็จ');
      } else {
        // Create new material
        const response = await fetch('/api/raw-materials', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData?.session?.access_token || ''}`
          },
          body: JSON.stringify({
            name: formData.name,
            unit: formData.unit,
            current_stock: formData.current_stock,
            min_stock: formData.min_stock,
            average_price: formData.average_price,
            image: formData.image
          })
        });

        const result = await response.json();

        if (!response.ok) {
          if (result.error?.includes('already exists')) {
            throw new Error('วัตถุดิบนี้มีในระบบแล้ว');
          }
          throw new Error(result.error || 'ไม่สามารถสร้างวัตถุดิบได้');
        }

        setSuccess('เพิ่มวัตถุดิบใหม่สำเร็จ');
      }

      // Reset form and refresh
      setShowModal(false);
      setEditingMaterial(null);
      setFormData({
        name: '',
        unit: 'kg',
        current_stock: 0,
        min_stock: 0,
        average_price: 0,
        image: ''
      });

      // Refetch materials
      setDataFetched(false);
      fetchMaterials();
    } catch (error) {
      console.error('Error saving material:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      }
    } finally {
      setSaving(false);
    }
  };

  // Handle delete material
  const handleDeleteMaterial = async (material: RawMaterial) => {
    if (!confirm(`คุณต้องการลบวัตถุดิบ ${material.name} หรือไม่?`)) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      const response = await fetch(`/api/raw-materials?id=${material.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${sessionData?.session?.access_token || ''}`
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'ไม่สามารถลบวัตถุดิบได้');
      }

      setSuccess('ลบวัตถุดิบสำเร็จ');
      setDataFetched(false);
      fetchMaterials();
    } catch (error) {
      console.error('Error deleting material:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('ไม่สามารถลบวัตถุดิบได้');
      }
    }
  };

  // Handle edit material
  const handleEditMaterial = (material: RawMaterial) => {
    setEditingMaterial(material);
    setFormData({
      name: material.name,
      unit: material.unit,
      current_stock: material.current_stock,
      min_stock: material.min_stock,
      average_price: material.average_price,
      image: material.image || ''
    });
    setShowModal(true);
  };

  // Filter materials based on search
  const filteredMaterials = materials.filter(material =>
    material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    material.unit.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate stats
  const lowStockCount = materials.filter(m => m.current_stock <= m.min_stock).length;

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

  // Loading materials
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
      title="จัดการวัตถุดิบ"
      breadcrumbs={[
        { label: 'หน้าแรก', href: '/dashboard' },
        { label: 'จัดการวัตถุดิบ' }
      ]}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center space-x-3">
            <Box className="w-8 h-8 text-[#E9B308]" />
            <div>
              <p className="text-sm text-gray-500">จำนวนวัตถุดิบทั้งหมด</p>
              <p className="text-2xl font-bold text-gray-900">{materials.length} รายการ</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-8 h-8 text-red-500" />
            <div>
              <p className="text-sm text-gray-500">สต็อกต่ำ</p>
              <p className="text-2xl font-bold text-red-600">{lowStockCount} รายการ</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setEditingMaterial(null);
            setFormData({
              name: '',
              unit: 'kg',
              current_stock: 0,
              min_stock: 0,
              average_price: 0,
              image: ''
            });
            setShowModal(true);
          }}
          className="flex items-center px-4 py-2 bg-[#E9B308] text-[#00231F] rounded-lg hover:bg-[#E9B308]/90 font-medium transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          เพิ่มวัตถุดิบใหม่
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
            placeholder="ค้นหาชื่อวัตถุดิบหรือหน่วย..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
          />
        </div>
      </div>

      {/* Raw Materials Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  วัตถุดิบ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  หน่วย
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  สต็อกปัจจุบัน
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  สต็อกขั้นต่ำ
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
              {filteredMaterials.map((material) => (
                <tr key={material.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        {material.image ? (
                          <img
                            src={getImageUrl(material.image)}
                            alt={material.name}
                            className="h-10 w-10 rounded-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              target.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div className={`h-10 w-10 rounded-full bg-[#E9B308]/20 flex items-center justify-center ${material.image ? 'hidden' : ''}`}>
                          <Package className="w-5 h-5 text-[#E9B308]" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {material.name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {material.unit}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-medium ${material.current_stock <= material.min_stock ? 'text-red-600' : 'text-gray-900'}`}>
                      {material.current_stock.toLocaleString('th-TH')} {material.unit}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {material.min_stock.toLocaleString('th-TH')} {material.unit}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {material.average_price.toLocaleString('th-TH')} ฿/{material.unit}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StockStatusBadge stock={material.current_stock} minStock={material.min_stock} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => handleEditMaterial(material)}
                        className="text-[#E9B308] hover:text-[#E9B308]/80 p-1"
                        title="แก้ไข"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {userProfile?.role === 'admin' && (
                        <button
                          onClick={() => handleDeleteMaterial(material)}
                          className="text-red-600 hover:text-red-900 p-1"
                          title="ลบ (Admin เท่านั้น)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredMaterials.length === 0 && (
            <div className="text-center py-12">
              <Box className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">ไม่พบวัตถุดิบ</p>
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

            <div className="relative bg-white rounded-lg max-w-md w-full">
              <div className="flex items-center justify-between p-5 border-b">
                <h3 className="text-xl font-semibold text-gray-900">
                  {editingMaterial ? 'แก้ไขข้อมูลวัตถุดิบ' : 'เพิ่มวัตถุดิบใหม่'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveMaterial} className="p-5">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ชื่อวัตถุดิบ *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                      required
                      placeholder="น้ำส้มสด"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      หน่วย *
                    </label>
                    <select
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                      required
                    >
                      <option value="kg">กิโลกรัม (kg)</option>
                      <option value="liter">ลิตร (liter)</option>
                      <option value="unit">หน่วย (unit)</option>
                      <option value="pack">แพ็ค (pack)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      จำนวนสต็อกปัจจุบัน *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.current_stock}
                      onChange={(e) => setFormData({ ...formData, current_stock: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      สต็อกขั้นต่ำ *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.min_stock}
                      onChange={(e) => setFormData({ ...formData, min_stock: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ราคาเฉลี่ย (บาท/{formData.unit})
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
                      URL รูปภาพ
                    </label>
                    <input
                      type="text"
                      value={formData.image}
                      onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                      placeholder="https://..."
                    />
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
                    {editingMaterial ? 'บันทึก' : 'เพิ่มวัตถุดิบ'}
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
