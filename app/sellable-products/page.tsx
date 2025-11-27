// Path: app/sellable-products/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { getImageUrl } from '@/lib/utils/image';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  Loader2,
  X,
  Check,
  Package2,
  Wine,
  DollarSign
} from 'lucide-react';

// Variation interface
interface Variation {
  variation_id?: string;
  bottle_type_id: string;
  bottle_size: string;
  bottle_capacity_ml: number;
  default_price: number;
  discount_price: number;
  stock: number;
  min_stock: number;
  is_active: boolean;
}

// Sellable Product interface (with variations from view)
interface SellableProduct {
  sellable_product_id: string;
  code: string;
  name: string;
  description?: string;
  image?: string;
  product_type: 'simple' | 'variation';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Product info
  product_id: string;
  product_code: string;
  product_name: string;
  product_category: string;
  // Simple product fields
  simple_bottle_type_id?: string;
  simple_bottle_size?: string;
  simple_bottle_capacity_ml?: number;
  simple_default_price?: number;
  simple_discount_price?: number;
  simple_stock?: number;
  simple_min_stock?: number;
  // Variations array
  variations: Variation[];
}

// Product interface
interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
}

// Bottle type interface
interface BottleType {
  id: string;
  size: string;
  capacity_ml: number;
  price: number;
  image?: string;
}

// Form data interface
interface SellableProductFormData {
  product_id: string;
  code: string;
  name: string;
  description: string;
  image: string;
  product_type: 'simple' | 'variation';
  is_active: boolean;

  // Simple product fields
  bottle_type_id: string;
  default_price: number;
  discount_price: number;
  stock: number;
  min_stock: number;

  // Variation product fields
  variations: VariationFormData[];
}

interface VariationFormData {
  id?: string;
  bottle_type_id: string;
  default_price: number;
  discount_price: number;
  stock: number;
  min_stock: number;
  is_active: boolean;
}

// Active status badge
function ActiveBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="flex items-center text-green-600">
      <Check className="w-4 h-4 mr-1" />
      <span className="text-sm">ใช้งาน</span>
    </span>
  ) : (
    <span className="flex items-center text-gray-600">
      <X className="w-4 h-4 mr-1" />
      <span className="text-sm">ปิดใช้งาน</span>
    </span>
  );
}

export default function SellableProductsPage() {
  const { userProfile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [sellableProducts, setSellableProducts] = useState<SellableProduct[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [bottleTypes, setBottleTypes] = useState<BottleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataFetched, setDataFetched] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SellableProduct | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [formData, setFormData] = useState<SellableProductFormData>({
    product_id: '',
    code: '',
    name: '',
    description: '',
    image: '',
    product_type: 'simple',
    is_active: true,
    // Simple fields
    bottle_type_id: '',
    default_price: 0,
    discount_price: 0,
    stock: 0,
    min_stock: 0,
    // Variation fields
    variations: []
  });

  // Check auth
  useEffect(() => {
    if (authLoading) return;
    if (!userProfile) {
      router.push('/login');
      return;
    }
  }, [userProfile, authLoading, router]);

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (dataFetched) return;

    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || '';

      // Fetch sellable products with variations
      const sellableResponse = await fetch('/api/sellable-products', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const sellableData = await sellableResponse.json();

      // Fetch products
      const productsResponse = await fetch('/api/products', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const productsData = await productsResponse.json();

      // Fetch bottle types
      const bottlesResponse = await fetch('/api/bottle-types', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const bottlesData = await bottlesResponse.json();

      setSellableProducts(sellableData.sellable_products || []);
      setProducts(productsData.products || []);
      setBottleTypes(bottlesData.bottle_types || []);
      setDataFetched(true);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  }, [dataFetched]);

  // Fetch data on mount
  useEffect(() => {
    if (!authLoading && userProfile && !dataFetched) {
      fetchData();
    }
  }, [authLoading, userProfile, dataFetched, fetchData]);

  // Auto-generate code and name when product is selected
  useEffect(() => {
    if (formData.product_id && !editingProduct) {
      const product = products.find(p => p.id === formData.product_id);
      if (product) {
        setFormData(prev => ({
          ...prev,
          code: product.code,
          name: product.name
        }));
      }
    }
  }, [formData.product_id, products, editingProduct]);

  // Add variation to form
  const addVariation = () => {
    setFormData(prev => ({
      ...prev,
      variations: [
        ...prev.variations,
        {
          bottle_type_id: '',
          default_price: 0,
          discount_price: 0,
          stock: 0,
          min_stock: 0,
          is_active: true
        }
      ]
    }));
  };

  // Remove variation from form
  const removeVariation = (index: number) => {
    setFormData(prev => ({
      ...prev,
      variations: prev.variations.filter((_, i) => i !== index)
    }));
  };

  // Update variation in form
  const updateVariation = (index: number, field: keyof VariationFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      variations: prev.variations.map((v, i) =>
        i === index ? { ...v, [field]: value } : v
      )
    }));
  };

  // Handle save
  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    // Validation
    if (!formData.product_id) {
      setError('กรุณาเลือกสินค้า');
      setSaving(false);
      return;
    }

    if (!formData.code.trim() || !formData.name.trim()) {
      setError('กรุณากรอกรหัสและชื่อ');
      setSaving(false);
      return;
    }

    // Validate based on product type
    if (formData.product_type === 'simple') {
      if (!formData.bottle_type_id) {
        setError('กรุณาเลือกขวด');
        setSaving(false);
        return;
      }
      if (formData.default_price <= 0) {
        setError('ราคาต้องมากกว่า 0');
        setSaving(false);
        return;
      }
    } else if (formData.product_type === 'variation') {
      if (formData.variations.length === 0) {
        setError('กรุณาเพิ่มอย่างน้อย 1 variation');
        setSaving(false);
        return;
      }

      // Validate variations
      for (let i = 0; i < formData.variations.length; i++) {
        const v = formData.variations[i];
        if (!v.bottle_type_id) {
          setError(`กรุณาเลือกขวดสำหรับ variation ที่ ${i + 1}`);
          setSaving(false);
          return;
        }
        if (v.default_price <= 0) {
          setError(`ราคาต้องมากกว่า 0 สำหรับ variation ที่ ${i + 1}`);
          setSaving(false);
          return;
        }
      }
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || '';

      const method = editingProduct ? 'PUT' : 'POST';
      const body = editingProduct
        ? { id: editingProduct.sellable_product_id, ...formData }
        : formData;

      const response = await fetch('/api/sellable-products', {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'ไม่สามารถบันทึกข้อมูลได้');
      }

      setSuccess(editingProduct ? 'แก้ไขสินค้าสำเร็จ' : 'เพิ่มสินค้าสำเร็จ');
      setShowModal(false);
      setEditingProduct(null);
      resetForm();

      setDataFetched(false);
      fetchData();
    } catch (error) {
      console.error('Error saving:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('เกิดข้อผิดพลาดในการบันทึก');
      }
    } finally {
      setSaving(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      product_id: '',
      code: '',
      name: '',
      description: '',
      image: '',
      product_type: 'simple',
      is_active: true,
      bottle_type_id: '',
      default_price: 0,
      discount_price: 0,
      stock: 0,
      min_stock: 0,
      variations: []
    });
  };

  // Handle delete
  const handleDelete = async (product: SellableProduct) => {
    if (!confirm(`คุณต้องการลบ ${product.name} หรือไม่?`)) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || '';

      const response = await fetch(`/api/sellable-products?id=${product.sellable_product_id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'ไม่สามารถลบได้');
      }

      setSuccess('ลบสินค้าสำเร็จ');
      setDataFetched(false);
      fetchData();
    } catch (error) {
      console.error('Error deleting:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('ไม่สามารถลบได้');
      }
    }
  };

  // Handle edit
  const handleEdit = (product: SellableProduct) => {
    setEditingProduct(product);

    if (product.product_type === 'simple') {
      setFormData({
        product_id: product.product_id,
        code: product.code,
        name: product.name,
        description: product.description || '',
        image: product.image || '',
        product_type: 'simple',
        is_active: product.is_active,
        bottle_type_id: product.simple_bottle_type_id || '',
        default_price: product.simple_default_price || 0,
        discount_price: product.simple_discount_price || 0,
        stock: product.simple_stock || 0,
        min_stock: product.simple_min_stock || 0,
        variations: []
      });
    } else {
      setFormData({
        product_id: product.product_id,
        code: product.code,
        name: product.name,
        description: product.description || '',
        image: product.image || '',
        product_type: 'variation',
        is_active: product.is_active,
        bottle_type_id: '',
        default_price: 0,
        discount_price: 0,
        stock: 0,
        min_stock: 0,
        variations: product.variations.map(v => ({
          id: v.variation_id,
          bottle_type_id: v.bottle_type_id,
          default_price: v.default_price,
          discount_price: v.discount_price,
          stock: v.stock,
          min_stock: v.min_stock,
          is_active: v.is_active
        }))
      });
    }

    setShowModal(true);
  };

  // Filter products
  const filteredProducts = sellableProducts.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.product_name.toLowerCase().includes(searchTerm.toLowerCase())
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

  // Loading
  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#00231F]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#E9B308] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return null;
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">สินค้าพร้อมขาย</h1>
            <p className="text-gray-600 mt-1">จัดการสินค้าพร้อมขาย (Simple หรือ Variation)</p>
          </div>
          <button
            onClick={() => {
              setEditingProduct(null);
              resetForm();
              setShowModal(true);
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-[#E9B308] hover:bg-[#d4a307] text-[#00231F] rounded-lg font-semibold transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>เพิ่มสินค้า</span>
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')}>
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center justify-between">
            <span>{success}</span>
            <button onClick={() => setSuccess('')}>
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="ค้นหาสินค้า..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
          />
        </div>

        {/* Products List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  รูปภาพ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  รหัส/ชื่อ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  สินค้าผลิต
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ประเภท
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ข้อมูล
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
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    ไม่พบข้อมูลสินค้า
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.sellable_product_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {product.image ? (
                        <img
                          src={getImageUrl(product.image)}
                          alt={product.name}
                          className="w-16 h-16 object-cover rounded"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center">
                          <Package2 className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{product.code}</div>
                      <div className="text-sm text-gray-500">{product.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{product.product_name}</div>
                      <div className="text-sm text-gray-500">{product.product_code}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        product.product_type === 'simple'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {product.product_type === 'simple' ? 'Simple' : 'Variation'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {product.product_type === 'simple' ? (
                        <div className="space-y-1">
                          <div className="text-sm flex items-center space-x-2">
                            <Wine className="w-4 h-4 text-gray-400" />
                            <span>{product.simple_bottle_size}</span>
                          </div>
                          <div className="text-sm flex items-center space-x-2">
                            <DollarSign className="w-4 h-4 text-gray-400" />
                            <span>฿{product.simple_default_price}</span>
                            {product.simple_discount_price && product.simple_discount_price > 0 && (
                              <span className="text-red-600">(฿{product.simple_discount_price})</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {product.variations && product.variations.length > 0 ? (
                            product.variations.map((v) => (
                              <div key={v.variation_id || `${product.sellable_product_id}-${v.bottle_type_id}`} className="text-sm flex items-center space-x-2">
                                <Wine className="w-4 h-4 text-gray-400" />
                                <span>{v.bottle_size}</span>
                                <DollarSign className="w-4 h-4 text-gray-400 ml-2" />
                                <span>฿{v.default_price}</span>
                                {v.discount_price > 0 && (
                                  <span className="text-red-600">(฿{v.discount_price})</span>
                                )}
                              </div>
                            ))
                          ) : (
                            <span className="text-sm text-gray-400">ไม่มี variation</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <ActiveBadge isActive={product.is_active} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleEdit(product)}
                        className="text-[#E9B308] hover:text-[#d4a307] inline-flex items-center"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(product)}
                        className="text-red-600 hover:text-red-700 inline-flex items-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto relative">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingProduct ? 'แก้ไขสินค้าพร้อมขาย' : 'เพิ่มสินค้าพร้อมขาย'}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                  type="button"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-6 space-y-6">
                {/* Product Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      สินค้าผลิต *
                    </label>
                    <select
                      value={formData.product_id}
                      onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                      required
                    >
                      <option value="">เลือกสินค้า</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code} - {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      รหัสสินค้า *
                    </label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                {/* Name and Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ชื่อสินค้า *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    คำอธิบาย
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                    rows={3}
                  />
                </div>

                {/* Image URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    URL รูปภาพ (รองรับ Google Drive)
                  </label>
                  <input
                    type="text"
                    value={formData.image}
                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                    placeholder="https://drive.google.com/file/d/..."
                  />
                </div>

                {/* Product Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ประเภทสินค้า *
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="product_type"
                        value="simple"
                        checked={formData.product_type === 'simple'}
                        onChange={(e) => setFormData({ ...formData, product_type: 'simple', variations: [] })}
                        className="w-4 h-4 text-[#E9B308] border-gray-300 focus:ring-[#E9B308]"
                      />
                      <span className="ml-2 text-sm text-gray-700">Simple Product (สินค้าแบบเดี่ยว)</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="product_type"
                        value="variation"
                        checked={formData.product_type === 'variation'}
                        onChange={(e) => setFormData({ ...formData, product_type: 'variation' })}
                        className="w-4 h-4 text-[#E9B308] border-gray-300 focus:ring-[#E9B308]"
                      />
                      <span className="ml-2 text-sm text-gray-700">Variation Product (หลายขนาด)</span>
                    </label>
                  </div>
                </div>

                {/* Simple Product Fields */}
                {formData.product_type === 'simple' && (
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">ข้อมูลสินค้า</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          ขวด *
                        </label>
                        <select
                          value={formData.bottle_type_id}
                          onChange={(e) => setFormData({ ...formData, bottle_type_id: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                          required={formData.product_type === 'simple'}
                        >
                          <option value="">เลือกขวด</option>
                          {bottleTypes.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.size} ({b.capacity_ml}ml)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          ราคาปกติ *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.default_price}
                          onChange={(e) => setFormData({ ...formData, default_price: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                          required={formData.product_type === 'simple'}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          ราคาลด
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.discount_price}
                          onChange={(e) => setFormData({ ...formData, discount_price: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          สต็อก
                        </label>
                        <input
                          type="number"
                          value={formData.stock}
                          onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          สต็อกขั้นต่ำ
                        </label>
                        <input
                          type="number"
                          value={formData.min_stock}
                          onChange={(e) => setFormData({ ...formData, min_stock: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Variation Product Fields */}
                {formData.product_type === 'variation' && (
                  <div className="border-t pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Variations (ขนาดขวด)</h3>
                      <button
                        type="button"
                        onClick={addVariation}
                        className="flex items-center space-x-2 px-3 py-1.5 bg-[#E9B308] hover:bg-[#d4a307] text-[#00231F] rounded-lg font-semibold transition-colors text-sm"
                      >
                        <Plus className="w-4 h-4" />
                        <span>เพิ่ม Variation</span>
                      </button>
                    </div>

                    {formData.variations.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">ยังไม่มี variation</p>
                    ) : (
                      <div className="space-y-4">
                        {formData.variations.map((variation, index) => {
                          const selectedBottle = bottleTypes.find(b => b.id === variation.bottle_type_id);
                          return (
                            <div key={index} className="border border-gray-200 rounded-lg p-4 relative">
                              <button
                                type="button"
                                onClick={() => removeVariation(index)}
                                className="absolute top-2 right-2 text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    ขวด *
                                  </label>
                                  <select
                                    value={variation.bottle_type_id}
                                    onChange={(e) => updateVariation(index, 'bottle_type_id', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                                    required
                                  >
                                    <option value="">เลือกขวด</option>
                                    {bottleTypes.map((b) => (
                                      <option key={b.id} value={b.id}>
                                        {b.size} ({b.capacity_ml}ml)
                                      </option>
                                    ))}
                                  </select>
                                  {selectedBottle && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      ราคาขวด: ฿{selectedBottle.price}
                                    </p>
                                  )}
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    ราคาปกติ *
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={variation.default_price}
                                    onChange={(e) => updateVariation(index, 'default_price', parseFloat(e.target.value) || 0)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                                    required
                                  />
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    ราคาลด
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={variation.discount_price}
                                    onChange={(e) => updateVariation(index, 'discount_price', parseFloat(e.target.value) || 0)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                                  />
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    สต็อก
                                  </label>
                                  <input
                                    type="number"
                                    value={variation.stock}
                                    onChange={(e) => updateVariation(index, 'stock', parseInt(e.target.value) || 0)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                                  />
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    สต็อกขั้นต่ำ
                                  </label>
                                  <input
                                    type="number"
                                    value={variation.min_stock}
                                    onChange={(e) => updateVariation(index, 'min_stock', parseInt(e.target.value) || 0)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                                  />
                                </div>

                                <div className="flex items-end">
                                  <label className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={variation.is_active}
                                      onChange={(e) => updateVariation(index, 'is_active', e.target.checked)}
                                      className="w-4 h-4 text-[#E9B308] border-gray-300 rounded focus:ring-[#E9B308]"
                                    />
                                    <span className="text-sm font-medium text-gray-700">เปิดใช้งาน</span>
                                  </label>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Active Status */}
                <div className="border-t pt-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-4 h-4 text-[#E9B308] border-gray-300 rounded focus:ring-[#E9B308]"
                    />
                    <span className="text-sm font-medium text-gray-700">เปิดใช้งาน</span>
                  </label>
                </div>

                {/* Form Actions */}
                <div className="flex items-center justify-end space-x-3 pt-6 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingProduct(null);
                      resetForm();
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-[#E9B308] hover:bg-[#d4a307] text-[#00231F] rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
