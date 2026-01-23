// Path: app/products/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { getImageUrl } from '@/lib/utils/image';
import {
  Package,
  Plus,
  Edit2,
  Search,
  AlertCircle,
  Check,
  X,
  Loader2,
  Code,
  Tag,
  Trash2
} from 'lucide-react';

// Product interface
interface Product {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  image?: string;
  is_active: boolean;
  product_type?: 'manufactured' | 'purchased';
  created_at: string;
  updated_at: string;
  recipes?: Array<{
    raw_material_id: string;
    quantity_per_unit: number;
    raw_materials: {
      id: string;
      name: string;
      unit: string;
    };
  }>;
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

// Category badge
function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
      {category}
    </span>
  );
}

// Raw material interface
interface RawMaterial {
  id: string;
  name: string;
  unit: string;
}

// Recipe ingredient
interface RecipeIngredient {
  raw_material_id: string;
  quantity_per_unit: number;
}

// Form data interface
interface ProductFormData {
  code: string;
  name: string;
  description: string;
  category: string;
  image: string;
  is_active: boolean;
  product_type: 'manufactured' | 'purchased';
  ingredients: RecipeIngredient[];
}

// Predefined categories
const PRODUCT_CATEGORIES = [
  'น้ำผลไม้',
  'น้ำผัก',
  'น้ำผสม',
  'เครื่องดื่มสุขภาพ',
  'อื่นๆ'
];

export default function ProductsPage() {
  const { userProfile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataFetched, setDataFetched] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);

  // Form state
  const [formData, setFormData] = useState<ProductFormData>({
    code: '',
    name: '',
    description: '',
    category: '',
    image: '',
    is_active: true,
    product_type: 'manufactured',
    ingredients: []
  });

  // Generate product code
  const generateProductCode = () => {
    const prefix = 'PRD';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefix}-${timestamp}${random}`;
  };

  // Fetch products function
  const fetchProducts = useCallback(async () => {
    if (dataFetched) return;

    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();

      const authHeaders = {
        'Authorization': `Bearer ${sessionData?.session?.access_token || ''}`
      };

      // Fetch products via API
      const productsResponse = await fetch('/api/products', {
        method: 'GET',
        headers: authHeaders
      });

      const productsResult = await productsResponse.json();

      if (!productsResponse.ok) {
        throw new Error(productsResult.error || 'Failed to fetch products');
      }

      if (productsResult.products) {
        setProducts(productsResult.products as Product[]);
        setDataFetched(true);
      }

      // Also fetch raw materials via API
      const materialsResponse = await fetch('/api/raw-materials', {
        method: 'GET',
        headers: authHeaders
      });

      const materialsResult = await materialsResponse.json();

      if (materialsResponse.ok && materialsResult.materials) {
        // Sort by name
        const sortedMaterials = materialsResult.materials.sort((a: RawMaterial, b: RawMaterial) =>
          a.name.localeCompare(b.name)
        );
        setRawMaterials(sortedMaterials);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      setError('ไม่สามารถโหลดข้อมูลสินค้าได้');
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

  // Fetch products
  useEffect(() => {
    if (!authLoading && userProfile && !dataFetched) {
      fetchProducts();
    }
  }, [authLoading, userProfile, dataFetched, fetchProducts]);

  // Handle create/update product
  const handleSaveProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    // Validation
    if (!formData.code.trim()) {
      setError('กรุณากรอกรหัสสินค้า');
      setSaving(false);
      return;
    }

    if (!formData.name.trim()) {
      setError('กรุณากรอกชื่อสินค้า');
      setSaving(false);
      return;
    }

    if (!formData.category.trim()) {
      setError('กรุณากรอกหมวดหมู่');
      setSaving(false);
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (editingProduct) {
        // Update existing product with recipes
        const response = await fetch('/api/products', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData?.session?.access_token || ''}`
          },
          body: JSON.stringify({
            id: editingProduct.id,
            code: formData.code,
            name: formData.name,
            description: formData.description,
            category: formData.category,
            image: formData.image,
            is_active: formData.is_active,
            product_type: formData.product_type,
            ingredients: formData.ingredients
          })
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'ไม่สามารถอัพเดทสินค้าได้');
        }

        setSuccess('อัพเดทข้อมูลสินค้าสำเร็จ');
      } else {
        // Create new product with recipes
        const response = await fetch('/api/products', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData?.session?.access_token || ''}`
          },
          body: JSON.stringify({
            code: formData.code,
            name: formData.name,
            description: formData.description,
            category: formData.category,
            image: formData.image,
            is_active: formData.is_active,
            product_type: formData.product_type,
            ingredients: formData.ingredients
          })
        });

        const result = await response.json();

        if (!response.ok) {
          if (result.error?.includes('already exists')) {
            throw new Error('รหัสสินค้านี้มีในระบบแล้ว');
          }
          throw new Error(result.error || 'ไม่สามารถสร้างสินค้าได้');
        }

        setSuccess('เพิ่มสินค้าใหม่สำเร็จ');
      }

      // Reset form and refresh
      setShowModal(false);
      setEditingProduct(null);
      setFormData({
        code: '',
        name: '',
        description: '',
        category: '',
        image: '',
        is_active: true,
        product_type: 'manufactured',
        ingredients: []
      });

      // Refetch products
      setDataFetched(false);
      fetchProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      }
    } finally {
      setSaving(false);
    }
  };

  // Handle toggle product status
  const handleToggleProductStatus = async (product: Product) => {
    const newStatus = !product.is_active;
    const action = newStatus ? 'เปิดใช้งาน' : 'ปิดใช้งาน';

    if (!confirm(`คุณต้องการ${action}สินค้านี้หรือไม่?`)) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      const response = await fetch('/api/products', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData?.session?.access_token || ''}`
        },
        body: JSON.stringify({
          id: product.id,
          code: product.code,
          name: product.name,
          description: product.description,
          category: product.category,
          image: product.image,
          is_active: newStatus
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `ไม่สามารถ${action}สินค้าได้`);
      }

      setSuccess(`${action}สินค้าสำเร็จ`);
      setDataFetched(false);
      fetchProducts();
    } catch (error) {
      console.error('Error toggling product status:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError(`ไม่สามารถ${action}สินค้าได้`);
      }
    }
  };

  // Handle delete product (admin only)
  const handleDeleteProduct = async (product: Product) => {
    if (!confirm(`คุณต้องการลบสินค้า "${product.name}" หรือไม่?\n\nการลบจะเป็นการลบถาวร ไม่สามารถกู้คืนได้`)) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      const response = await fetch(`/api/products?id=${product.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${sessionData?.session?.access_token || ''}`
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'ไม่สามารถลบสินค้าได้');
      }

      setSuccess('ลบสินค้าสำเร็จ');
      setDataFetched(false);
      fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('ไม่สามารถลบสินค้าได้');
      }
    }
  };

  // Handle edit product
  const handleEditProduct = async (product: Product) => {
    setEditingProduct(product);

    // Use existing recipes from the product (already fetched from API)
    const existingRecipes = product.recipes?.map(recipe => ({
      raw_material_id: recipe.raw_material_id,
      quantity_per_unit: recipe.quantity_per_unit
    })) || [];

    setFormData({
      code: product.code,
      name: product.name,
      description: product.description || '',
      category: product.category,
      image: product.image || '',
      is_active: product.is_active,
      product_type: product.product_type || 'manufactured',
      ingredients: existingRecipes
    });
    setShowModal(true);
  };

  // Add ingredient
  const addIngredient = () => {
    if (rawMaterials.length === 0) return;

    // Find first material not already added
    const existingIds = formData.ingredients.map(i => i.raw_material_id);
    const available = rawMaterials.find(m => !existingIds.includes(m.id));

    if (available) {
      setFormData({
        ...formData,
        ingredients: [...formData.ingredients, { raw_material_id: available.id, quantity_per_unit: 0 }]
      });
    }
  };

  // Remove ingredient
  const removeIngredient = (index: number) => {
    setFormData({
      ...formData,
      ingredients: formData.ingredients.filter((_, i) => i !== index)
    });
  };

  // Update ingredient
  const updateIngredient = (index: number, field: keyof RecipeIngredient, value: string | number) => {
    const updated = [...formData.ingredients];
    if (field === 'raw_material_id') {
      updated[index] = { ...updated[index], raw_material_id: value as string };
    } else {
      updated[index] = { ...updated[index], quantity_per_unit: parseFloat(value as string) || 0 };
    }
    setFormData({ ...formData, ingredients: updated });
  };

  // Filter products based on search
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
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

  // Loading products
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
      title="จัดการสินค้า"
      breadcrumbs={[
        { label: 'หน้าแรก', href: '/dashboard' },
        { label: 'จัดการสินค้า' }
      ]}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center space-x-3">
          <Package className="w-8 h-8 text-[#E9B308]" />
          <div>
            <p className="text-sm text-gray-500">จำนวนสินค้าทั้งหมด</p>
            <p className="text-2xl font-bold text-gray-900">{products.length} รายการ</p>
          </div>
        </div>

        <button
          onClick={() => {
            setEditingProduct(null);
            setFormData({
              code: generateProductCode(),
              name: '',
              description: '',
              category: '',
              image: '',
              is_active: true,
              product_type: 'manufactured',
              ingredients: []
            });
            setShowModal(true);
          }}
          className="flex items-center px-4 py-2 bg-[#E9B308] text-[#00231F] rounded-lg hover:bg-[#E9B308]/90 font-medium transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          เพิ่มสินค้าใหม่
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
            placeholder="ค้นหารหัส ชื่อสินค้า หรือหมวดหมู่..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
          />
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  รหัสสินค้า
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ชื่อสินค้า
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  หมวดหมู่
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  วัตถุดิบ
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
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm font-medium text-gray-900">
                      <Code className="w-4 h-4 mr-2 text-gray-400" />
                      {product.code}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        {product.image ? (
                          <img
                            src={getImageUrl(product.image)}
                            alt={product.name}
                            className="h-10 w-10 rounded-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              target.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div className={`h-10 w-10 rounded-full bg-[#E9B308]/20 flex items-center justify-center ${product.image ? 'hidden' : ''}`}>
                          <Package className="w-5 h-5 text-[#E9B308]" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {product.name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <CategoryBadge category={product.category} />
                  </td>
                  <td className="px-6 py-4">
                    {product.recipes && product.recipes.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {product.recipes.map((recipe) => (
                          <span
                            key={recipe.raw_material_id}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"
                            title={`${recipe.quantity_per_unit} ${recipe.raw_materials?.unit || ''}/ลิตร`}
                          >
                            {recipe.raw_materials?.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">ยังไม่มีสูตร</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge isActive={product.is_active} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => handleEditProduct(product)}
                        className="text-[#E9B308] hover:text-[#E9B308]/80 p-1"
                        title="แก้ไข"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleProductStatus(product)}
                        className={product.is_active ? 'text-red-600 hover:text-red-900 p-1' : 'text-green-600 hover:text-green-900 p-1'}
                        title={product.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                      >
                        {product.is_active ? (
                          <X className="w-4 h-4" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                      </button>
                      {userProfile?.role === 'admin' && (
                        <button
                          onClick={() => handleDeleteProduct(product)}
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

          {filteredProducts.length === 0 && (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">ไม่พบสินค้า</p>
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
                  {editingProduct ? 'แก้ไขข้อมูลสินค้า' : 'เพิ่มสินค้าใหม่'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveProduct} className="p-5">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      รหัสสินค้า *
                    </label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                      required
                      placeholder="OJ001"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ชื่อสินค้า *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                      required
                      placeholder="น้ำส้มคั้น"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      หมวดหมู่ *
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                      required
                    >
                      <option value="">เลือกหมวดหมู่</option>
                      {PRODUCT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      คำอธิบาย
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                      rows={3}
                      placeholder="รายละเอียดสินค้า..."
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
                      placeholder="https://example.com/image.jpg"
                    />
                    {formData.image && (
                      <div className="mt-2">
                        <img
                          src={formData.image}
                          alt="Preview"
                          className="h-20 w-20 rounded-lg object-cover border border-gray-200"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Ingredients Section - Only for manufactured products */}
                  {formData.product_type === 'manufactured' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        วัตถุดิบที่ใช้ (สูตรต่อ 1 ลิตร)
                      </label>

                    {formData.ingredients.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {formData.ingredients.map((ingredient, index) => {
                          const material = rawMaterials.find(m => m.id === ingredient.raw_material_id);
                          return (
                            <div key={index} className="flex items-center gap-2">
                              <select
                                value={ingredient.raw_material_id}
                                onChange={(e) => updateIngredient(index, 'raw_material_id', e.target.value)}
                                className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#E9B308]"
                              >
                                {rawMaterials.map((mat) => (
                                  <option key={mat.id} value={mat.id}>{mat.name}</option>
                                ))}
                              </select>
                              <input
                                type="number"
                                step="0.0001"
                                min="0"
                                value={ingredient.quantity_per_unit}
                                onChange={(e) => updateIngredient(index, 'quantity_per_unit', e.target.value)}
                                className="w-24 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#E9B308]"
                                placeholder="0"
                              />
                              <span className="text-xs text-gray-500 w-12">{material?.unit || ''}</span>
                              <button
                                type="button"
                                onClick={() => removeIngredient(index)}
                                className="text-red-500 hover:text-red-700 p-1"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {rawMaterials.length > 0 && formData.ingredients.length < rawMaterials.length && (
                      <button
                        type="button"
                        onClick={addIngredient}
                        className="flex items-center text-sm text-[#E9B308] hover:text-[#d4a307]"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        เพิ่มวัตถุดิบ
                      </button>
                    )}

                    {rawMaterials.length === 0 && (
                      <p className="text-xs text-gray-500">ยังไม่มีวัตถุดิบในระบบ</p>
                    )}
                    </div>
                  )}

                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="mr-2 rounded border-gray-300 text-[#E9B308] focus:ring-[#E9B308]"
                      />
                      <span className="text-sm text-gray-700">เปิดใช้งาน</span>
                    </label>
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
                    {editingProduct ? 'บันทึก' : 'เพิ่มสินค้า'}
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
