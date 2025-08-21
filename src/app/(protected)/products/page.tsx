// Path: src/app/(protected)/products/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { collection, getDocs, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  Package, Plus, Search, Edit, ToggleLeft, ToggleRight,
  Image, Loader2, BarChart3, Beaker, Filter, ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Product } from '@/types/production';
import { ResponsiveTable, TableColumn, TableBadge, TableActions } from '@/components/ui/ResponsiveTable';

export default function ProductsPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

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

    if (statusFilter !== 'all') {
      filtered = filtered.filter(product => 
        statusFilter === 'active' ? product.isActive : !product.isActive
      );
    }

    setFilteredProducts(filtered);
  }, [searchQuery, statusFilter, products]);

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

  // Define table columns
  const columns: TableColumn<Product>[] = [
    {
      key: 'product',
      header: 'ผลิตภัณฑ์',
      accessor: (item) => (
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 bg-gray-800 rounded-lg overflow-hidden flex-shrink-0">
            {item.imageUrl ? (
              <img 
                src={item.imageUrl} 
                alt={item.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Beaker className="h-6 w-6 text-gray-600" />
              </div>
            )}
          </div>
          <div>
            <p className="font-medium text-base text-white">{item.name}</p>
            <p className="text-sm text-gray-400">{item.nameEn}</p>
          </div>
        </div>
      ),
      mobilePriority: 1,
      mobileLabel: 'ผลิตภัณฑ์'
    },
    {
      key: 'category',
      header: 'หมวดหมู่',
      accessor: (item) => item.category ? (
        <span className="inline-block px-2 py-1 bg-gray-700 text-sm text-gray-300 rounded">
          {item.category}
        </span>
      ) : (
        <span className="text-gray-500 text-base">-</span>
      ),
      mobilePriority: 3,
      mobileLabel: 'หมวดหมู่'
    },
    {
      key: 'rawMaterials',
      header: 'วัตถุดิบ',
      accessor: (item) => (
        <div className="flex flex-wrap gap-1">
          {item.rawMaterials.length > 0 ? (
            item.rawMaterials.map(material => (
              <span key={material} className="px-2 py-1 bg-gray-700 text-sm text-gray-300 rounded">
                {material}
              </span>
            ))
          ) : (
            <span className="text-gray-500 text-base">ยังไม่ระบุ</span>
          )}
        </div>
      ),
      mobilePriority: 4,
      mobileLabel: 'วัตถุดิบ'
    },
    {
      key: 'status',
      header: 'สถานะ',
      accessor: (item) => (
        <button
          onClick={() => handleToggleActive(item.id, item.isActive)}
          className={`px-3 py-1 text-sm rounded-full transition-colors ${
            item.isActive 
              ? 'bg-green-900/30 text-green-400 hover:bg-green-900/50' 
              : 'bg-gray-900/30 text-gray-400 hover:bg-gray-900/50'
          }`}
        >
          {item.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
        </button>
      ),
      align: 'center',
      mobilePriority: 2,
      mobileLabel: 'สถานะ'
    },
    {
      key: 'analytics',
      header: 'สถิติ',
      accessor: (item) => item.averageRatios ? (
        <div className="text-center">
          <span className="text-green-400 text-base">มีข้อมูล</span>
        </div>
      ) : (
        <div className="text-center">
          <span className="text-gray-500 text-base">ยังไม่มี</span>
        </div>
      ),
      align: 'center',
      hideOnMobile: true
    },
    {
      key: 'actions',
      header: 'จัดการ',
      accessor: (item) => (
        <TableActions>
          <button
            onClick={() => router.push(`/products/${item.id}`)}
            className="btn btn-sm btn-ghost"
          >
            <Edit className="h-4 w-4" />
            แก้ไข
          </button>
          {item.averageRatios && (
            <button
              onClick={() => router.push(`/products/${item.id}/analytics`)}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="ดูสถิติ"
            >
              <BarChart3 className="h-4 w-4" />
            </button>
          )}
        </TableActions>
      ),
      align: 'center',
      hideOnMobile: true
    }
  ];

  // Custom mobile card renderer
  const renderMobileCard = (product: Product) => (
    <div className={`card ${!product.isActive ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-4">
        {/* Image */}
        <div className="h-16 w-16 bg-gray-800 rounded-lg overflow-hidden flex-shrink-0">
          {product.imageUrl ? (
            <img 
              src={product.imageUrl} 
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Beaker className="h-8 w-8 text-gray-600" />
            </div>
          )}
        </div>
        
        {/* Info */}
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white">{product.name}</h3>
          <p className="text-sm text-gray-400">{product.nameEn}</p>
          {product.category && (
            <span className="inline-block px-2 py-1 bg-gray-700 text-xs text-gray-300 rounded mt-1">
              {product.category}
            </span>
          )}
        </div>

        {/* Status */}
        <button
          onClick={() => handleToggleActive(product.id, product.isActive)}
          className={`px-3 py-1 text-sm rounded-full transition-colors flex-shrink-0 ${
            product.isActive 
              ? 'bg-green-900/30 text-green-400' 
              : 'bg-gray-900/30 text-gray-400'
          }`}
        >
          {product.isActive ? 'เปิด' : 'ปิด'}
        </button>
      </div>

      {/* Raw Materials */}
      <div className="mt-4">
        <p className="text-sm text-gray-400 mb-2">วัตถุดิบ:</p>
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

      {/* Actions */}
      <div className="flex gap-2 mt-4">
        <button
          onClick={() => router.push(`/products/${product.id}`)}
          className="btn btn-ghost btn-sm flex-1"
        >
          <Edit className="h-4 w-4" />
          แก้ไข
        </button>
        {product.averageRatios && (
          <button
            onClick={() => router.push(`/products/${product.id}/analytics`)}
            className="btn btn-ghost btn-sm"
            title="ดูสถิติ"
          >
            <BarChart3 className="h-4 w-4" />
            สถิติ
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="page-content">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">จัดการผลิตภัณฑ์</h1>
          <button
            onClick={() => router.push('/products/new')}
            className="btn btn-primary w-full sm:w-auto"
          >
            <Plus className="h-5 w-5" />
            เพิ่มผลิตภัณฑ์ใหม่
          </button>
        </div>
        <p className="text-gray-400">จัดการข้อมูลผลิตภัณฑ์และสูตรการผลิต</p>
      </div>

      {/* Stats - Responsive Grid */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
        <div className="card text-center p-4 sm:p-6">
          <Package className="h-6 w-6 sm:h-8 sm:w-8 text-primary mx-auto mb-2" />
          <p className="text-lg sm:text-2xl font-bold text-white">{products.length}</p>
          <p className="text-xs sm:text-sm text-gray-400">ทั้งหมด</p>
        </div>
        <div className="card text-center p-4 sm:p-6">
          <ToggleRight className="h-6 w-6 sm:h-8 sm:w-8 text-green-400 mx-auto mb-2" />
          <p className="text-lg sm:text-2xl font-bold text-white">
            {products.filter(p => p.isActive).length}
          </p>
          <p className="text-xs sm:text-sm text-gray-400">ใช้งานอยู่</p>
        </div>
        <div className="card text-center p-4 sm:p-6">
          <ToggleLeft className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-lg sm:text-2xl font-bold text-white">
            {products.filter(p => !p.isActive).length}
          </p>
          <p className="text-xs sm:text-sm text-gray-400">ปิดใช้งาน</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        {/* Mobile Filter Toggle */}
        <div className="block sm:hidden mb-4">
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="btn btn-ghost w-full flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              ตัวกรอง
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${showMobileFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Filters Content */}
        <div className={`${showMobileFilters ? 'block' : 'hidden'} sm:block space-y-4 sm:space-y-0 sm:flex sm:gap-4`}>
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาผลิตภัณฑ์..."
              className="input pl-10"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="input"
          >
            <option value="all">ทั้งหมด</option>
            <option value="active">เปิดใช้งาน</option>
            <option value="inactive">ปิดใช้งาน</option>
          </select>
        </div>
      </div>

      {/* ResponsiveTable */}
      <div className="card">
        <ResponsiveTable
          data={filteredProducts}
          columns={columns}
          keyExtractor={(item) => item.id}
          loading={loading}
          emptyMessage={searchQuery ? 'ไม่พบผลิตภัณฑ์ที่ค้นหา' : 'ยังไม่มีผลิตภัณฑ์'}
          emptyIcon={<Package className="h-12 w-12 text-gray-600 mx-auto" />}
          mobileRenderCard={renderMobileCard}
        />
      </div>
    </div>
  );
}