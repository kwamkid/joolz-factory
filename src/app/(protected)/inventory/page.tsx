// Path: src/app/(protected)/inventory/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  Package, Edit, Plus, Search, TrendingDown, AlertTriangle,
  Calendar, DollarSign, ShoppingCart, Trash2,
  Filter, ChevronDown, Clock, CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { InventoryBatch } from '@/types/inventory';
import { ResponsiveTable, TableColumn, TableBadge, TableActions, formatDate } from '@/components/ui/ResponsiveTable';

export default function InventoryPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [inventory, setInventory] = useState<InventoryBatch[]>([]);
  const [filteredInventory, setFilteredInventory] = useState<InventoryBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [materialFilter, setMaterialFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [allMaterials, setAllMaterials] = useState<string[]>([]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Summary stats
  const [stats, setStats] = useState({
    totalValue: 0,
    totalItems: 0,
    lowStockItems: 0
  });

  // Check permission
  useEffect(() => {
    if (currentUser && currentUser.role === 'operation') {
      toast.error('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
      router.push('/dashboard');
    }
  }, [currentUser, router]);

  // Fetch inventory
  useEffect(() => {
    fetchInventory();
  }, []);

  // Filter inventory
  useEffect(() => {
    let filtered = inventory;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(item => 
        item.materialType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Material filter
    if (materialFilter !== 'all') {
      filtered = filtered.filter(item => item.materialType === materialFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => {
        if (statusFilter === 'active') return item.remainingQuantity > 0 && item.status === 'active';
        if (statusFilter === 'finished') return item.isFinished;
        if (statusFilter === 'low') return item.remainingQuantity > 0 && item.remainingQuantity < 10;
        return item.status === statusFilter;
      });
    }

    setFilteredInventory(filtered);
  }, [searchQuery, materialFilter, statusFilter, inventory]);

  // Calculate stats
  useEffect(() => {
    const value = inventory.reduce((sum, item) => 
      sum + (item.remainingQuantity * item.pricePerUnit), 0
    );
    const active = inventory.filter(item => item.remainingQuantity > 0);
    const lowStock = active.filter(item => item.remainingQuantity < 10);

    setStats({
      totalValue: value,
      totalItems: active.length,
      lowStockItems: lowStock.length
    });
  }, [inventory]);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const inventoryQuery = query(
        collection(db, 'inventory_batches'),
        orderBy('createdAt', 'desc')
      );
      const inventorySnapshot = await getDocs(inventoryQuery);
      const inventoryData: InventoryBatch[] = [];
      
      inventorySnapshot.forEach((doc) => {
        const data = doc.data();
        inventoryData.push({
          id: doc.id,
          batchId: data.batchId,
          materialType: data.materialType,
          materialId: data.materialId,
          supplier: data.supplier,
          purchaseDate: data.purchaseDate?.toDate() || new Date(),
          quantity: data.quantity,
          remainingQuantity: data.remainingQuantity,
          pricePerUnit: data.pricePerUnit,
          totalCost: data.totalCost,
          invoiceNumber: data.invoiceNumber,
          invoiceUrl: data.invoiceUrl,
          notes: data.notes,
          status: data.status || 'active',
          isFinished: data.isFinished || false,
          finishedAt: data.finishedAt?.toDate(),
          createdBy: data.createdBy,
          createdByName: data.createdByName,
          createdAt: data.createdAt?.toDate() || new Date(),
          expiryDate: data.expiryDate?.toDate()
        });
      });

      setInventory(inventoryData);

      // Extract unique materials
      const materials = new Set<string>();
      inventoryData.forEach(item => materials.add(item.materialType));
      setAllMaterials(Array.from(materials).sort());

    } catch (error) {
      console.error('Error fetching inventory:', error);
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getStatusBadge = (item: InventoryBatch) => {
    if (item.isFinished) {
      return <TableBadge variant="default">หมด</TableBadge>;
    }
    if (item.status === 'damaged') {
      return <TableBadge variant="error">เสียหาย</TableBadge>;
    }
    if (item.status === 'expired') {
      return <TableBadge variant="warning">หมดอายุ</TableBadge>;
    }
    if (item.remainingQuantity < 10) {
      return <TableBadge variant="warning">ใกล้หมด</TableBadge>;
    }
    return <TableBadge variant="success">พร้อมใช้</TableBadge>;
  };

  const isExpiringSoon = (expiryDate?: Date) => {
    if (!expiryDate) return false;
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  };

  const isExpired = (expiryDate?: Date) => {
    if (!expiryDate) return false;
    return new Date() > expiryDate;
  };

  // Define table columns
  const columns: TableColumn<InventoryBatch>[] = [
    {
      key: 'batchId',
      header: 'Batch ID',
      accessor: (item) => <p className="font-mono text-base text-white">{item.batchId}</p>,
      mobilePriority: 1,
      mobileLabel: 'Batch ID'
    },
    {
      key: 'materialType',
      header: 'วัตถุดิบ',
      accessor: (item) => <p className="font-medium text-base text-white">{item.materialType}</p>,
      mobilePriority: 2,
      mobileLabel: 'วัตถุดิบ'
    },
    {
      key: 'supplier',
      header: 'ซัพพลายเออร์',
      accessor: (item) => (
        <div>
          <p className="text-base text-white">{item.supplier.name}</p>
          <p className="text-sm text-gray-400">⭐ {item.supplier.rating.toFixed(1)}</p>
        </div>
      ),
      mobilePriority: 4,
      mobileLabel: 'ซัพพลายเออร์'
    },
    {
      key: 'remaining',
      header: 'คงเหลือ',
      accessor: (item) => (
        <div>
          <p className="text-base text-white font-medium">
            {item.remainingQuantity.toFixed(1)} / {item.quantity.toFixed(1)} kg
          </p>
          <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1">
            <div 
              className={`h-1.5 rounded-full transition-all ${
                item.remainingQuantity === 0 ? 'bg-gray-500' :
                item.remainingQuantity < 10 ? 'bg-yellow-500' :
                'bg-green-500'
              }`}
              style={{ width: `${(item.remainingQuantity / item.quantity) * 100}%` }}
            />
          </div>
        </div>
      ),
      align: 'center',
      mobilePriority: 3,
      mobileLabel: 'คงเหลือ'
    },
    {
      key: 'cost',
      header: 'ต้นทุน',
      accessor: (item) => (
        <div>
          <p className="text-base text-white">{formatCurrency(item.pricePerUnit)}/kg</p>
          <p className="text-sm text-gray-400">
            รวม: {formatCurrency(item.remainingQuantity * item.pricePerUnit)}
          </p>
        </div>
      ),
      align: 'right',
      mobilePriority: 5,
      mobileLabel: 'ต้นทุน'
    },
    {
      key: 'purchaseDate',
      header: 'วันที่ซื้อ',
      accessor: (item) => (
        <p className="text-base text-white">{formatDate(item.purchaseDate)}</p>
      ),
      align: 'center',
      hideOnMobile: true
    },
    {
      key: 'status',
      header: 'สถานะ',
      accessor: (item) => getStatusBadge(item),
      align: 'center',
      mobilePriority: 7
    },
    {
      key: 'actions',
      header: 'จัดการ',
      accessor: (item) => (
        <TableActions>
          <button
            onClick={() => router.push(`/inventory/${item.id}`)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="ดูรายละเอียด"
          >
            <Package className="h-4 w-4" />
          </button>
          {currentUser?.role !== 'operation' && !item.isFinished && (
            <button
              onClick={() => router.push(`/inventory/purchase/${item.id}`)}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="แก้ไข"
            >
              <Edit className="h-4 w-4" />
            </button>
          )}
        </TableActions>
      ),
      align: 'center',
      hideOnMobile: true
    }
  ];

  // Custom mobile card renderer
  const renderMobileCard = (item: InventoryBatch) => (
    <div className="card">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <p className="font-mono text-sm font-semibold text-white">{item.batchId}</p>
          <p className="text-lg font-medium text-white mt-1">{item.materialType}</p>
        </div>
        {getStatusBadge(item)}
      </div>
      
      <div className="space-y-3">
        {/* Remaining Stock */}
        <div>
          <p className="text-sm text-gray-400 mb-1">คงเหลือ</p>
          <p className="text-white font-medium">
            {item.remainingQuantity.toFixed(1)} / {item.quantity.toFixed(1)} kg
          </p>
          <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1">
            <div 
              className={`h-1.5 rounded-full transition-all ${
                item.remainingQuantity === 0 ? 'bg-gray-500' :
                item.remainingQuantity < 10 ? 'bg-yellow-500' :
                'bg-green-500'
              }`}
              style={{ width: `${(item.remainingQuantity / item.quantity) * 100}%` }}
            />
          </div>
        </div>

        {/* Supplier & Cost */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-400">ซัพพลายเออร์</p>
            <p className="text-white">{item.supplier.name}</p>
            <p className="text-xs text-gray-400">⭐ {item.supplier.rating.toFixed(1)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">ต้นทุน</p>
            <p className="text-white">{formatCurrency(item.pricePerUnit)}/kg</p>
            <p className="text-xs text-gray-400">
              รวม: {formatCurrency(item.remainingQuantity * item.pricePerUnit)}
            </p>
          </div>
        </div>

        {/* Date */}
        <div className="text-sm">
          <p className="text-gray-400">วันที่ซื้อ</p>
          <p className="text-white">{formatDate(item.purchaseDate)}</p>
        </div>
      </div>
      
      <div className="flex gap-2 mt-4">
        <button
          onClick={() => router.push(`/inventory/${item.id}`)}
          className="btn btn-ghost btn-sm flex-1"
        >
          ดูรายละเอียด
        </button>
        {currentUser?.role !== 'operation' && !item.isFinished && (
          <button
            onClick={() => router.push(`/inventory/purchase/${item.id}`)}
            className="btn btn-ghost btn-sm"
          >
            <Edit className="h-4 w-4" />
            แก้ไข
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
          <h1 className="text-2xl sm:text-3xl font-bold text-white">คลังวัตถุดิบ</h1>
          <div className="flex gap-2 sm:gap-3">
            <button
              onClick={() => router.push('/inventory/purchase')}
              className="btn btn-primary flex-1 sm:flex-initial"
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">ซื้อของเข้า</span>
              <span className="sm:hidden">ซื้อเข้า</span>
            </button>
            <button
              onClick={() => router.push('/inventory/damage')}
              className="btn bg-red-600 hover:bg-red-700 text-white flex-1 sm:flex-initial"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">ตัดของเสีย</span>
              <span className="sm:hidden">ตัดเสีย</span>
            </button>
          </div>
        </div>
        <p className="text-gray-400">จัดการวัตถุดิบและติดตามสต็อกคงเหลือ</p>
      </div>

      {/* Stats - Responsive Grid */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
        <div className="card text-center p-4 sm:p-6">
          <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-primary mx-auto mb-2" />
          <p className="text-lg sm:text-2xl font-bold text-white">{formatCurrency(stats.totalValue)}</p>
          <p className="text-xs sm:text-sm text-gray-400">มูลค่ารวม</p>
        </div>
        <div className="card text-center p-4 sm:p-6">
          <Package className="h-6 w-6 sm:h-8 sm:w-8 text-green-400 mx-auto mb-2" />
          <p className="text-lg sm:text-2xl font-bold text-white">{stats.totalItems}</p>
          <p className="text-xs sm:text-sm text-gray-400">รายการที่ใช้ได้</p>
        </div>
        <div className="card text-center p-4 sm:p-6">
          <TrendingDown className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-400 mx-auto mb-2" />
          <p className="text-lg sm:text-2xl font-bold text-white">{stats.lowStockItems}</p>
          <p className="text-xs sm:text-sm text-gray-400">ใกล้หมด</p>
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
              placeholder="ค้นหาวัตถุดิบ, ซัพพลายเออร์..."
              className="input pl-10"
            />
          </div>

          {/* Material Filter */}
          <select
            value={materialFilter}
            onChange={(e) => setMaterialFilter(e.target.value)}
            className="input"
          >
            <option value="all">วัตถุดิบทั้งหมด</option>
            {allMaterials.map(material => (
              <option key={material} value={material}>{material}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input"
          >
            <option value="all">สถานะทั้งหมด</option>
            <option value="active">พร้อมใช้</option>
            <option value="low">ใกล้หมด</option>
            <option value="finished">หมด</option>
            <option value="damaged">เสียหาย</option>
            <option value="expired">หมดอายุ</option>
          </select>
        </div>
      </div>

      {/* ResponsiveTable */}
      <div className="card">
        <ResponsiveTable
          data={filteredInventory}
          columns={columns}
          keyExtractor={(item) => item.id}
          loading={loading}
          emptyMessage="ไม่พบข้อมูลวัตถุดิบ"
          emptyIcon={<Package className="h-12 w-12 text-gray-600 mx-auto" />}
          mobileRenderCard={renderMobileCard}
        />
      </div>
    </div>
  );
}