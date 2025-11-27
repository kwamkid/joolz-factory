// Path: app/bottles/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import {
  Wine,
  Plus,
  Edit2,
  Search,
  AlertCircle,
  Check,
  X,
  Loader2,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { getImageUrl } from '@/lib/utils/image';

// Bottle interface
interface Bottle {
  id: string;
  size: string;
  capacity_ml: number;
  price: number;
  stock: number;
  min_stock: number;
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
interface BottleFormData {
  size: string;
  capacity_ml: number;
  price: number;
  stock: number;
  min_stock: number;
  image: string;
}

export default function BottlesPage() {
  const { userProfile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [bottles, setBottles] = useState<Bottle[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataFetched, setDataFetched] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingBottle, setEditingBottle] = useState<Bottle | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [formData, setFormData] = useState<BottleFormData>({
    size: '',
    capacity_ml: 0,
    price: 0,
    stock: 0,
    min_stock: 0,
    image: ''
  });

  // Fetch bottles function
  const fetchBottles = useCallback(async () => {
    if (dataFetched) return;

    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();

      const response = await fetch('/api/bottle-types', {
        headers: {
          'Authorization': `Bearer ${sessionData?.session?.access_token || ''}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch bottles');
      }

      const result = await response.json();
      setBottles(result.bottle_types || []);
      setDataFetched(true);
    } catch (error) {
      console.error('Error fetching bottles:', error);
      setError('ไม่สามารถโหลดข้อมูลขวดได้');
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

  // Fetch bottles
  useEffect(() => {
    if (!authLoading && userProfile && !dataFetched) {
      fetchBottles();
    }
  }, [authLoading, userProfile, dataFetched, fetchBottles]);

  // Handle create/update bottle
  const handleSaveBottle = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    // Validation
    if (!formData.size.trim()) {
      setError('กรุณากรอกขนาดขวด');
      setSaving(false);
      return;
    }

    if (formData.price <= 0) {
      setError('ราคาต้องมากกว่า 0');
      setSaving(false);
      return;
    }

    if (formData.stock < 0) {
      setError('จำนวนสต็อกต้องไม่ติดลบ');
      setSaving(false);
      return;
    }

    if (formData.min_stock < 0) {
      setError('สต็อกขั้นต่ำต้องไม่ติดลบ');
      setSaving(false);
      return;
    }

    if (formData.capacity_ml <= 0) {
      setError('ความจุ (ml) ต้องมากกว่า 0');
      setSaving(false);
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (editingBottle) {
        // Update existing bottle
        const response = await fetch('/api/bottle-types', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData?.session?.access_token || ''}`
          },
          body: JSON.stringify({
            id: editingBottle.id,
            size: formData.size,
            capacity_ml: formData.capacity_ml,
            price: formData.price,
            stock: formData.stock,
            min_stock: formData.min_stock,
            image: formData.image
          })
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'ไม่สามารถอัพเดทขวดได้');
        }

        setSuccess('อัพเดทข้อมูลขวดสำเร็จ');
      } else {
        // Create new bottle
        const response = await fetch('/api/bottle-types', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData?.session?.access_token || ''}`
          },
          body: JSON.stringify({
            size: formData.size,
            capacity_ml: formData.capacity_ml,
            price: formData.price,
            stock: formData.stock,
            min_stock: formData.min_stock,
            image: formData.image
          })
        });

        const result = await response.json();

        if (!response.ok) {
          if (result.error?.includes('already exists')) {
            throw new Error('ขนาดขวดนี้มีในระบบแล้ว');
          }
          throw new Error(result.error || 'ไม่สามารถสร้างขวดได้');
        }

        setSuccess('เพิ่มขวดใหม่สำเร็จ');
      }

      // Reset form and refresh
      setShowModal(false);
      setEditingBottle(null);
      setFormData({
        size: '',
        capacity_ml: 0,
        price: 0,
        stock: 0,
        min_stock: 0,
        image: ''
      });

      // Refetch bottles
      setDataFetched(false);
      fetchBottles();
    } catch (error) {
      console.error('Error saving bottle:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      }
    } finally {
      setSaving(false);
    }
  };

  // Handle delete bottle
  const handleDeleteBottle = async (bottle: Bottle) => {
    if (!confirm(`คุณต้องการลบขวดขนาด ${bottle.size} หรือไม่?`)) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      const response = await fetch(`/api/bottle-types?id=${bottle.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${sessionData?.session?.access_token || ''}`
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'ไม่สามารถลบขวดได้');
      }

      setSuccess('ลบขวดสำเร็จ');
      setDataFetched(false);
      fetchBottles();
    } catch (error) {
      console.error('Error deleting bottle:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('ไม่สามารถลบขวดได้');
      }
    }
  };

  // Handle edit bottle
  const handleEditBottle = (bottle: Bottle) => {
    setEditingBottle(bottle);
    setFormData({
      size: bottle.size,
      capacity_ml: bottle.capacity_ml || 0,
      price: bottle.price,
      stock: bottle.stock,
      min_stock: bottle.min_stock,
      image: bottle.image || ''
    });
    setShowModal(true);
  };

  // Filter bottles based on search
  const filteredBottles = bottles.filter(bottle =>
    bottle.size.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate stats
  const lowStockCount = bottles.filter(b => b.stock <= b.min_stock).length;
  const totalStock = bottles.reduce((sum, b) => sum + b.stock, 0);

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

  // Loading bottles
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
      title="จัดการขวด"
      breadcrumbs={[
        { label: 'หน้าแรก', href: '/dashboard' },
        { label: 'จัดการขวด' }
      ]}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center space-x-3">
            <Wine className="w-8 h-8 text-[#E9B308]" />
            <div>
              <p className="text-sm text-gray-500">จำนวนขวดทั้งหมด</p>
              <p className="text-2xl font-bold text-gray-900">{bottles.length} ขนาด</p>
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
            setEditingBottle(null);
            setFormData({
              size: '',
              capacity_ml: 0,
              price: 0,
              stock: 0,
              min_stock: 0,
              image: ''
            });
            setShowModal(true);
          }}
          className="flex items-center px-4 py-2 bg-[#E9B308] text-[#00231F] rounded-lg hover:bg-[#E9B308]/90 font-medium transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          เพิ่มขวดใหม่
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
            placeholder="ค้นหาขนาดขวด..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
          />
        </div>
      </div>

      {/* Bottles Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ขนาด
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ความจุ (ml)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ราคา
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  สต็อก
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  สต็อกขั้นต่ำ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  สถานะสต็อก
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  จัดการ
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredBottles.map((bottle) => (
                <tr key={bottle.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        {bottle.image ? (
                          <img
                            src={getImageUrl(bottle.image)}
                            alt={bottle.size}
                            className="h-10 w-10 rounded-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              target.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div className={`h-10 w-10 rounded-full bg-[#E9B308]/20 flex items-center justify-center ${bottle.image ? 'hidden' : ''}`}>
                          <Wine className="w-5 h-5 text-[#E9B308]" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {bottle.size}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {bottle.capacity_ml ? bottle.capacity_ml.toLocaleString('th-TH') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {bottle.price.toLocaleString('th-TH')} ฿
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-medium ${bottle.stock <= bottle.min_stock ? 'text-red-600' : 'text-gray-900'}`}>
                      {bottle.stock.toLocaleString('th-TH')} ขวด
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {bottle.min_stock.toLocaleString('th-TH')} ขวด
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StockStatusBadge stock={bottle.stock} minStock={bottle.min_stock} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => handleEditBottle(bottle)}
                        className="text-[#E9B308] hover:text-[#E9B308]/80 p-1"
                        title="แก้ไข"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {userProfile?.role === 'admin' && (
                        <button
                          onClick={() => handleDeleteBottle(bottle)}
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

          {filteredBottles.length === 0 && (
            <div className="text-center py-12">
              <Wine className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">ไม่พบขวด</p>
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
                  {editingBottle ? 'แก้ไขข้อมูลขวด' : 'เพิ่มขวดใหม่'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveBottle} className="p-5">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ชื่อขนาดขวด *
                    </label>
                    <input
                      type="text"
                      value={formData.size}
                      onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                      required
                      placeholder="250ml, 350ml, 1L"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ความจุ (ml) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={formData.capacity_ml}
                      onChange={(e) => setFormData({ ...formData, capacity_ml: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                      required
                      placeholder="250, 350, 1000"
                    />
                    <p className="text-xs text-gray-500 mt-1">ตัวอย่าง: 250ml = 250, 1L = 1000</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ราคา (บาท) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      จำนวนสต็อก *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) })}
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
                      step="1"
                      value={formData.min_stock}
                      onChange={(e) => setFormData({ ...formData, min_stock: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                      required
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
                    {editingBottle ? 'บันทึก' : 'เพิ่มขวด'}
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
