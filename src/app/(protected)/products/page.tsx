// src/app/(protected)/products/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { collection, getDocs, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  Package, Plus, Search, Edit, ToggleLeft, ToggleRight,
  Image, Loader2, BarChart3, Beaker
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Product } from '@/types/production';

export default function ProductsPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Check permission
  useEffect(() => {
    if (currentUser && currentUser.role === 'operation') {
      toast.error('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
      router.push('/dashboard');
    }
  }, [currentUser, router]);

  // Fetch products
  useEffect(() => {
    fetchProducts();
  }, []);

  // Filter products
  useEffect(() => {
    let filtered = products;

    if (searchQuery) {
      filtered = filtered.filter(product => 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredProducts(filtered);
  }, [searchQuery, products]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const productsQuery = query(collection(db, 'products'), orderBy('name', 'asc'));
      const productsSnapshot = await getDocs(productsQuery);
      const productsData: Product[] = [];
      
      productsSnapshot.forEach((doc) => {
        const data = doc.data();
        productsData.push({
          id: doc.id,
          name: data.name,
          nameEn: data.nameEn,
          category: data.category,
          rawMaterials: data.rawMaterials || [],
          averageRatios: data.averageRatios,
          imageUrl: data.imageUrl,
          isActive: data.isActive !== false,
          createdAt: data.createdAt?.toDate() || new Date(),
          createdBy: data.createdBy,
          updatedAt: data.updatedAt?.toDate(),
          updatedBy: data.updatedBy
        });
      });

      setProducts(productsData);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (productId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'products', productId), {
        isActive: !currentStatus,
        updatedAt: new Date(),
        updatedBy: currentUser?.uid
      });

      toast.success(`${currentStatus ? 'ปิด' : 'เปิด'}การใช้งานสำเร็จ`);
      fetchProducts();
    } catch (error) {
      console.error('Error updating product status:', error);
      toast.error('เกิดข้อผิดพลาดในการอัพเดทสถานะ');
    }
  };

  if (loading) {
    return (
      <div className="page-content">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
            <p className="mt-4 text-gray-400">กำลังโหลดข้อมูล...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-white">จัดการผลิตภัณฑ์</h1>
          <button
            onClick={() => router.push('/products/new')}
            className="btn btn-primary"
          >
            <Plus className="h-4 w-4" />
            เพิ่มผลิตภัณฑ์ใหม่
          </button>
        </div>
        <p className="text-gray-400">จัดการข้อมูลผลิตภัณฑ์และสูตรการผลิต</p>
      </div>

      {/* Search */}
      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาผลิตภัณฑ์..."
            className="input pl-10"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card text-center">
          <Package className="h-8 w-8 text-primary mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{products.length}</p>
          <p className="text-sm text-gray-400">ผลิตภัณฑ์ทั้งหมด</p>
        </div>
        <div className="card text-center">
          <ToggleRight className="h-8 w-8 text-green-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">
            {products.filter(p => p.isActive).length}
          </p>
          <p className="text-sm text-gray-400">ใช้งานอยู่</p>
        </div>
        <div className="card text-center">
          <ToggleLeft className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">
            {products.filter(p => !p.isActive).length}
          </p>
          <p className="text-sm text-gray-400">ปิดใช้งาน</p>
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredProducts.map((product) => (
          <div 
            key={product.id} 
            className={`card ${!product.isActive ? 'opacity-60' : ''}`}
          >
            {/* Image */}
            <div className="h-48 bg-gray-800 rounded-lg mb-4 overflow-hidden">
              {product.imageUrl ? (
                <img 
                  src={product.imageUrl} 
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Beaker className="h-16 w-16 text-gray-600" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-white mb-1">{product.name}</h3>
              <p className="text-sm text-gray-400">{product.nameEn}</p>
              {product.category && (
                <span className="inline-block px-2 py-1 bg-gray-700 text-xs text-gray-300 rounded mt-2">
                  {product.category}
                </span>
              )}
            </div>

            {/* Raw Materials */}
            <div className="mb-4">
              <p className="text-xs text-gray-400 mb-1">วัตถุดิบ:</p>
              <div className="flex flex-wrap gap-1">
                {product.rawMaterials.length > 0 ? (
                  product.rawMaterials.map(material => (
                    <span key={material} className="px-2 py-1 bg-gray-700 text-xs text-gray-300 rounded">
                      {material}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-gray-500">ยังไม่ระบุ</span>
                )}
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-400">สถานะ:</span>
              <button
                onClick={() => handleToggleActive(product.id, product.isActive)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  product.isActive 
                    ? 'bg-green-900/30 text-green-400' 
                    : 'bg-gray-900/30 text-gray-400'
                }`}
              >
                {product.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => router.push(`/products/${product.id}`)}
                className="btn btn-secondary flex-1"
              >
                <Edit className="h-4 w-4" />
                แก้ไข
              </button>
              {product.averageRatios && (
                <button
                  onClick={() => router.push(`/products/${product.id}/analytics`)}
                  className="btn btn-ghost"
                  title="ดูสถิติ"
                >
                  <BarChart3 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">
            {searchQuery ? 'ไม่พบผลิตภัณฑ์ที่ค้นหา' : 'ยังไม่มีผลิตภัณฑ์'}
          </p>
        </div>
      )}
    </div>
  );
}