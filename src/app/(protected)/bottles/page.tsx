// Path: src/app/(protected)/bottles/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  FlaskConical, Plus, Search, Edit, Trash2, 
  Package, AlertCircle, TrendingUp, TrendingDown,
  History, MoreVertical, ChevronDown, Filter
} from 'lucide-react';
import toast from 'react-hot-toast';
import { BottleType } from '@/types/bottle';
import { ResponsiveTable, TableColumn, TableBadge, TableActions } from '@/components/ui/ResponsiveTable';

export default function BottlesPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [bottles, setBottles] = useState<BottleType[]>([]);
  const [filteredBottles, setFilteredBottles] = useState<BottleType[]>([]);
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

  // Fetch bottles
  useEffect(() => {
    fetchBottles();
  }, []);

  // Filter bottles
  useEffect(() => {
    let filtered = bottles;

    if (searchQuery) {
      filtered = filtered.filter(bottle => 
        bottle.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(bottle => 
        statusFilter === 'active' ? bottle.isActive : !bottle.isActive
      );
    }

    setFilteredBottles(filtered);
  }, [searchQuery, statusFilter, bottles]);

  const fetchBottles = async () => {
    try {
      setLoading(true);
      const bottlesQuery = query(collection(db, 'bottles'), orderBy('sizeInMl', 'asc'));
      const bottlesSnapshot = await getDocs(bottlesQuery);
      const bottlesData: BottleType[] = [];
      
      bottlesSnapshot.forEach((doc) => {
        const data = doc.data();
        bottlesData.push({
          id: doc.id,
          name: data.name,
          sizeInMl: data.sizeInMl,
          pricePerUnit: data.pricePerUnit,
          imageUrl: data.imageUrl,
          minStockLevel: data.minStockLevel || 0,
          currentStock: data.currentStock || 0,
          isActive: data.isActive !== false,
          createdAt: data.createdAt?.toDate() || new Date(),
          createdBy: data.createdBy,
          updatedAt: data.updatedAt?.toDate(),
          updatedBy: data.updatedBy
        });
      });

      setBottles(bottlesData);
    } catch (error) {
      console.error('Error fetching bottles:', error);
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (bottleId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'bottles', bottleId), {
        isActive: !currentStatus,
        updatedAt: new Date(),
        updatedBy: currentUser?.uid
      });

      toast.success(`${currentStatus ? 'ปิด' : 'เปิด'}การใช้งานสำเร็จ`);
      fetchBottles();
    } catch (error) {
      console.error('Error updating bottle status:', error);
      toast.error('เกิดข้อผิดพลาดในการอัพเดทสถานะ');
    }
  };

  const handleDelete = async (bottleId: string, bottleName: string) => {
    if (!confirm(`ยืนยันการลบขวด ${bottleName}?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'bottles', bottleId));
      toast.success('ลบข้อมูลขวดสำเร็จ');
      fetchBottles();
    } catch (error) {
      console.error('Error deleting bottle:', error);
      toast.error('เกิดข้อผิดพลาดในการลบข้อมูล');
    }
  };

  const getStockStatus = (current: number, min: number) => {
    const percentage = min > 0 ? (current / min) * 100 : 100;
    
    if (percentage <= 25) {
      return { color: 'text-red-400', bg: 'bg-red-900/20', label: 'วิกฤต', variant: 'error' as const };
    } else if (percentage <= 50) {
      return { color: 'text-yellow-400', bg: 'bg-yellow-900/20', label: 'ต่ำ', variant: 'warning' as const };
    } else {
      return { color: 'text-green-400', bg: 'bg-green-900/20', label: 'ปกติ', variant: 'success' as const };
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 2
    }).format(amount);
  };

  // Define table columns
  const columns: TableColumn<BottleType>[] = [
    {
      key: 'name',
      header: 'ขวด',
      accessor: (item) => (
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
            {item.imageUrl ? (
              <img 
                src={item.imageUrl} 
                alt={item.name}
                className="h-10 w-10 object-contain"
              />
            ) : (
              <FlaskConical className="h-6 w-6 text-gray-600" />
            )}
          </div>
          <div>
            <p className="font-medium text-base text-white">{item.name}</p>
          </div>
        </div>
      ),
      mobilePriority: 1,
      mobileLabel: 'ขวด'
    },
    {
      key: 'size',
      header: 'ขนาด',
      accessor: (item) => <p className="text-base text-white">{item.sizeInMl} ml</p>,
      mobilePriority: 2,
      mobileLabel: 'ขนาด'
    },
    {
      key: 'price',
      header: 'ราคา',
      accessor: (item) => <p className="text-base text-white">{formatCurrency(item.pricePerUnit)}</p>,
      align: 'right',
      mobilePriority: 3,
      mobileLabel: 'ราคา'
    },
    {
      key: 'stock',
      header: 'สต็อก',
      accessor: (item) => (
        <div className="text-center">
          <p className="text-base text-white font-medium">{item.currentStock.toLocaleString()}</p>
          <p className="text-sm text-gray-400">/ {(item.minStockLevel || 0).toLocaleString()}</p>
        </div>
      ),
      align: 'center',
      mobilePriority: 4,
      mobileLabel: 'สต็อก'
    },
    {
      key: 'stockStatus',
      header: 'สถานะสต็อก',
      accessor: (item) => {
        const stockStatus = getStockStatus(item.currentStock, item.minStockLevel || 0);
        return (
          <div>
            <TableBadge variant={stockStatus.variant}>{stockStatus.label}</TableBadge>
            <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2">
              <div 
                className={`h-1.5 rounded-full transition-all ${
                  stockStatus.label === 'วิกฤต' ? 'bg-red-500' :
                  stockStatus.label === 'ต่ำ' ? 'bg-yellow-500' :
                  'bg-green-500'
                }`}
                style={{ 
                  width: `${Math.min(100, item.minStockLevel ? (item.currentStock / item.minStockLevel) * 100 : 0)}%` 
                }}
              />
            </div>
          </div>
        );
      },
      align: 'center',
      mobilePriority: 5,
      mobileLabel: 'สถานะ'
    },
    {
      key: 'isActive',
      header: 'การใช้งาน',
      accessor: (item) => (
        <button
          onClick={() => handleToggleActive(item.id, item.isActive)}
          className={`px-3 py-1 text-sm rounded-full transition-colors ${
            item.isActive 
              ? 'bg-green-900/30 text-green-400 hover:bg-green-900/50' 
              : 'bg-gray-900/30 text-gray-400 hover:bg-gray-900/50'
          }`}
        >
          {item.isActive ? 'เปิด' : 'ปิด'}
        </button>
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
            onClick={() => router.push(`/bottles/${item.id}/stock`)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="จัดการสต็อก"
          >
            <Package className="h-4 w-4" />
          </button>
          <button
            onClick={() => router.push(`/bottles/${item.id}`)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="แก้ไข"
          >
            <Edit className="h-4 w-4" />
          </button>
          {currentUser?.role === 'admin' && (
            <button
              onClick={() => handleDelete(item.id, item.name)}
              className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
              title="ลบ"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </TableActions>
      ),
      align: 'center',
      hideOnMobile: true
    }
  ];

  // Custom mobile card renderer
  const renderMobileCard = (bottle: BottleType) => {
    const stockStatus = getStockStatus(bottle.currentStock, bottle.minStockLevel || 0);
    
    return (
      <div className="card">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
              {bottle.imageUrl ? (
                <img 
                  src={bottle.imageUrl} 
                  alt={bottle.name}
                  className="h-10 w-10 object-contain"
                />
              ) : (
                <FlaskConical className="h-6 w-6 text-gray-600" />
              )}
            </div>
            <div>
              <p className="font-medium text-lg text-white">{bottle.name}</p>
              <p className="text-sm text-gray-400">{bottle.sizeInMl} ml</p>
            </div>
          </div>
          <button
            onClick={() => handleToggleActive(bottle.id, bottle.isActive)}
            className={`px-3 py-1 text-sm rounded-full transition-colors ${
              bottle.isActive 
                ? 'bg-green-900/30 text-green-400 hover:bg-green-900/50' 
                : 'bg-gray-900/30 text-gray-400 hover:bg-gray-900/50'
            }`}
          >
            {bottle.isActive ? 'เปิด' : 'ปิด'}
          </button>
        </div>

        <div className="space-y-3">
          {/* Price */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">ราคา</span>
            <span className="text-white font-medium">{formatCurrency(bottle.pricePerUnit)}</span>
          </div>

          {/* Stock */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-400">สต็อก</span>
              <span className="text-white font-medium">
                {bottle.currentStock.toLocaleString()} / {(bottle.minStockLevel || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <div className="w-full bg-gray-700 rounded-full h-1.5">
                  <div 
                    className={`h-1.5 rounded-full transition-all ${
                      stockStatus.label === 'วิกฤต' ? 'bg-red-500' :
                      stockStatus.label === 'ต่ำ' ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{ 
                      width: `${Math.min(100, bottle.minStockLevel ? (bottle.currentStock / bottle.minStockLevel) * 100 : 0)}%` 
                    }}
                  />
                </div>
              </div>
              <TableBadge variant={stockStatus.variant}>{stockStatus.label}</TableBadge>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => router.push(`/bottles/${bottle.id}/stock`)}
            className="btn btn-ghost btn-sm flex-1"
          >
            <Package className="h-4 w-4" />
            จัดการสต็อก
          </button>
          <button
            onClick={() => router.push(`/bottles/${bottle.id}`)}
            className="btn btn-ghost btn-sm"
          >
            <Edit className="h-4 w-4" />
            แก้ไข
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="page-content">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">จัดการขวด</h1>
          <button
            onClick={() => router.push('/bottles/new')}
            className="btn btn-primary w-full sm:w-auto"
          >
            <Plus className="h-5 w-5" />
            เพิ่มขวดใหม่
          </button>
        </div>
        <p className="text-gray-400">จัดการประเภทขวดและราคา</p>
      </div>

      {/* Stats - Responsive Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div className="card text-center p-4 sm:p-6">
          <FlaskConical className="h-6 w-6 sm:h-8 sm:w-8 text-primary mx-auto mb-2" />
          <p className="text-lg sm:text-2xl font-bold text-white">{bottles.length}</p>
          <p className="text-xs sm:text-sm text-gray-400">ประเภททั้งหมด</p>
        </div>
        <div className="card text-center p-4 sm:p-6">
          <Package className="h-6 w-6 sm:h-8 sm:w-8 text-green-400 mx-auto mb-2" />
          <p className="text-lg sm:text-2xl font-bold text-white">
            {bottles.filter(b => b.isActive).length}
          </p>
          <p className="text-xs sm:text-sm text-gray-400">ใช้งานอยู่</p>
        </div>
        <div className="card text-center p-4 sm:p-6">
          <AlertCircle className="h-6 w-6 sm:h-8 sm:w-8 text-red-400 mx-auto mb-2" />
          <p className="text-lg sm:text-2xl font-bold text-white">
            {bottles.filter(b => b.currentStock < (b.minStockLevel || 0)).length}
          </p>
          <p className="text-xs sm:text-sm text-gray-400">สต็อกต่ำ</p>
        </div>
        <div className="card text-center p-4 sm:p-6">
          <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-blue-400 mx-auto mb-2" />
          <p className="text-lg sm:text-2xl font-bold text-white">
            {bottles.reduce((sum, b) => sum + b.currentStock, 0).toLocaleString()}
          </p>
          <p className="text-xs sm:text-sm text-gray-400">ขวดทั้งหมด</p>
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
              placeholder="ค้นหาขนาดขวด..."
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
            <option value="active">ใช้งานอยู่</option>
            <option value="inactive">ปิดการใช้งาน</option>
          </select>
        </div>
      </div>

      {/* ResponsiveTable */}
      <div className="card">
        <ResponsiveTable
          data={filteredBottles}
          columns={columns}
          keyExtractor={(item) => item.id}
          loading={loading}
          emptyMessage="ไม่พบข้อมูลขวด"
          emptyIcon={<FlaskConical className="h-12 w-12 text-gray-600 mx-auto" />}
          mobileRenderCard={renderMobileCard}
        />
      </div>
    </div>
  );
}