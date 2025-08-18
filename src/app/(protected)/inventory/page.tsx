// src/app/(protected)/inventory/page.tsx
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

  // Summary stats
  const [stats, setStats] = useState({
    totalValue: 0,
    totalItems: 0,
    lowStockItems: 0,
    expiringItems: 0
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
    
    // Check expiring (within 7 days)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const expiring = active.filter(item => 
      item.expiryDate && new Date(item.expiryDate) <= sevenDaysFromNow
    );

    setStats({
      totalValue: value,
      totalItems: active.length,
      lowStockItems: lowStock.length,
      expiringItems: expiring.length
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
      return <span className="px-2 py-1 bg-gray-900/30 text-gray-400 text-xs rounded-full">หมด</span>;
    }
    if (item.status === 'damaged') {
      return <span className="px-2 py-1 bg-red-900/30 text-red-400 text-xs rounded-full">เสียหาย</span>;
    }
    if (item.status === 'expired') {
      return <span className="px-2 py-1 bg-orange-900/30 text-orange-400 text-xs rounded-full">หมดอายุ</span>;
    }
    if (item.remainingQuantity < 10) {
      return <span className="px-2 py-1 bg-yellow-900/30 text-yellow-400 text-xs rounded-full">ใกล้หมด</span>;
    }
    return <span className="px-2 py-1 bg-green-900/30 text-green-400 text-xs rounded-full">พร้อมใช้</span>;
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

  if (loading) {
    return (
      <div className="page-content">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
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
          <h1 className="text-2xl font-bold text-white">คลังวัตถุดิบ</h1>
          <button
            onClick={() => router.push('/inventory/purchase')}
            className="btn btn-primary"
          >
            <ShoppingCart className="h-4 w-4" />
            บันทึกการซื้อ
          </button>
        </div>
        <p className="text-gray-400">จัดการวัตถุดิบและติดตามสต็อกคงเหลือ</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="card text-center">
          <DollarSign className="h-8 w-8 text-primary mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{formatCurrency(stats.totalValue)}</p>
          <p className="text-sm text-gray-400">มูลค่ารวม</p>
        </div>
        <div className="card text-center">
          <Package className="h-8 w-8 text-green-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{stats.totalItems}</p>
          <p className="text-sm text-gray-400">รายการที่ใช้ได้</p>
        </div>
        <div className="card text-center">
          <TrendingDown className="h-8 w-8 text-yellow-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{stats.lowStockItems}</p>
          <p className="text-sm text-gray-400">ใกล้หมด</p>
        </div>
        <div className="card text-center">
          <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{stats.expiringItems}</p>
          <p className="text-sm text-gray-400">ใกล้หมดอายุ</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาวัตถุดิบ, ซัพพลายเออร์, เลขที่ใบเสร็จ..."
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

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <button
          onClick={() => router.push('/inventory/damage')}
          className="card card-hover text-center"
        >
          <Trash2 className="h-8 w-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-white">บันทึกของเสีย</p>
        </button>
        <button
          onClick={() => router.push('/inventory/history')}
          className="card card-hover text-center"
        >
          <Clock className="h-8 w-8 text-blue-400 mx-auto mb-2" />
          <p className="text-sm text-white">ประวัติการเคลื่อนไหว</p>
        </button>
        <button
          onClick={() => router.push('/inventory/report')}
          className="card card-hover text-center"
        >
          <TrendingDown className="h-8 w-8 text-yellow-400 mx-auto mb-2" />
          <p className="text-sm text-white">รายงานสต็อก</p>
        </button>
        <button
          onClick={() => router.push('/inventory/expiry')}
          className="card card-hover text-center"
        >
          <Calendar className="h-8 w-8 text-orange-400 mx-auto mb-2" />
          <p className="text-sm text-white">ตรวจสอบวันหมดอายุ</p>
        </button>
      </div>

      {/* Inventory Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left p-4 text-sm font-medium text-gray-400">Batch ID</th>
                <th className="text-left p-4 text-sm font-medium text-gray-400">วัตถุดิบ</th>
                <th className="text-left p-4 text-sm font-medium text-gray-400">ซัพพลายเออร์</th>
                <th className="text-center p-4 text-sm font-medium text-gray-400">คงเหลือ</th>
                <th className="text-right p-4 text-sm font-medium text-gray-400">ต้นทุน</th>
                <th className="text-center p-4 text-sm font-medium text-gray-400">วันที่ซื้อ</th>
                <th className="text-center p-4 text-sm font-medium text-gray-400">หมดอายุ</th>
                <th className="text-center p-4 text-sm font-medium text-gray-400">สถานะ</th>
                <th className="text-center p-4 text-sm font-medium text-gray-400">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory.map((item) => (
                <tr key={item.id} className="border-b border-gray-700 hover:bg-gray-800/50">
                  {/* Batch ID */}
                  <td className="p-4">
                    <p className="font-mono text-sm text-white">{item.batchId}</p>
                  </td>

                  {/* Material */}
                  <td className="p-4">
                    <p className="font-medium text-white">{item.materialType}</p>
                  </td>

                  {/* Supplier */}
                  <td className="p-4">
                    <p className="text-white">{item.supplier.name}</p>
                    <p className="text-xs text-gray-400">⭐ {item.supplier.rating.toFixed(1)}</p>
                  </td>

                  {/* Remaining */}
                  <td className="p-4 text-center">
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
                  </td>

                  {/* Cost */}
                  <td className="p-4 text-right">
                    <p className="text-white">{formatCurrency(item.pricePerUnit)}/kg</p>
                    <p className="text-xs text-gray-400">
                      รวม: {formatCurrency(item.remainingQuantity * item.pricePerUnit)}
                    </p>
                  </td>

                  {/* Purchase Date */}
                  <td className="p-4 text-center">
                    <p className="text-sm text-white">
                      {new Date(item.purchaseDate).toLocaleDateString('th-TH')}
                    </p>
                  </td>

                  {/* Expiry Date */}
                  <td className="p-4 text-center">
                    {item.expiryDate ? (
                      <div>
                        <p className={`text-sm ${
                          isExpired(item.expiryDate) ? 'text-red-400' :
                          isExpiringSoon(item.expiryDate) ? 'text-yellow-400' :
                          'text-white'
                        }`}>
                          {new Date(item.expiryDate).toLocaleDateString('th-TH')}
                        </p>
                        {isExpiringSoon(item.expiryDate) && (
                          <p className="text-xs text-yellow-400">
                            อีก {Math.ceil((item.expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} วัน
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="p-4 text-center">
                    {getStatusBadge(item)}
                  </td>

                  {/* Actions */}
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => router.push(`/inventory/${item.id}`)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                        title="ดูรายละเอียด"
                      >
                        <Package className="h-4 w-4" />
                      </button>
                      {/* Edit button - only for manager and admin */}
                      {currentUser?.role !== 'operation' && !item.isFinished && (
                        <button
                          onClick={() => router.push(`/inventory/${item.id}/edit`)}
                          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                          title="แก้ไข"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      )}
                      {item.remainingQuantity > 0 && (
                        <button
                          onClick={() => router.push(`/inventory/${item.id}/damage`)}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
                          title="บันทึกของเสีย"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredInventory.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">ไม่พบข้อมูลวัตถุดิบ</p>
          </div>
        )}
      </div>
    </div>
  );
}