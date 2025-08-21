// Path: src/app/(protected)/production/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { collection, getDocs, query, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  Factory, Plus, Search, Clock, CheckCircle, 
  AlertCircle, Package, Calendar, FileText,
  XCircle, PlayCircle, Trash2, Filter, ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ProductionBatch } from '@/types/production';
import { ResponsiveTable, TableColumn, TableBadge, TableActions, formatDate, formatDateTime } from '@/components/ui/ResponsiveTable';

export default function ProductionPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [filteredBatches, setFilteredBatches] = useState<ProductionBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    totalBatches: 0,
    plannedBatches: 0,
    completedBatches: 0,
    cancelledBatches: 0
  });

  // Fetch production batches
  useEffect(() => {
    fetchBatches();
  }, []);

  // Filter batches
  useEffect(() => {
    let filtered = batches;

    if (searchQuery) {
      filtered = filtered.filter(batch => 
        batch.batchId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        batch.productName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(batch => batch.status === statusFilter);
    }

    setFilteredBatches(filtered);
  }, [searchQuery, statusFilter, batches]);

  // Calculate stats
  useEffect(() => {
    setStats({
      totalBatches: batches.length,
      plannedBatches: batches.filter(b => b.status === 'planned').length,
      completedBatches: batches.filter(b => b.status === 'completed').length,
      cancelledBatches: batches.filter(b => b.status === 'cancelled').length
    });
  }, [batches]);

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const batchesQuery = query(
        collection(db, 'production_batches'),
        orderBy('plannedAt', 'desc')
      );
      
      const batchesSnapshot = await getDocs(batchesQuery);
      const batchesData: ProductionBatch[] = [];
      
      batchesSnapshot.forEach((doc) => {
        const data = doc.data();
        batchesData.push({
          id: doc.id,
          batchId: data.batchId,
          productId: data.productId,
          productName: data.productName,
          productionDate: data.productionDate,
          status: data.status,
          plannedBottles: data.plannedBottles || {},
          totalJuiceNeeded: data.totalJuiceNeeded || 0,
          materialRequirements: data.materialRequirements || {},
          actualMaterialsUsed: data.actualMaterialsUsed,
          actualBottlesProduced: data.actualBottlesProduced,
          qualityTests: data.qualityTests,
          materialCost: data.materialCost,
          bottleCost: data.bottleCost,
          totalCost: data.totalCost,
          plannedBy: data.plannedBy,
          plannedByName: data.plannedByName,
          plannedAt: data.plannedAt?.toDate() || new Date(),
          startedAt: data.startedAt?.toDate(),
          startedBy: data.startedBy,
          startedByName: data.startedByName,
          completedAt: data.completedAt?.toDate(),
          completedBy: data.completedBy,
          completedByName: data.completedByName,
          notes: data.notes
        });
      });

      setBatches(batchesData);
    } catch (error) {
      console.error('Error fetching batches:', error);
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'planned':
        return (
          <TableBadge variant="info" icon={<Clock className="h-3 w-3" />}>
            วางแผนแล้ว
          </TableBadge>
        );
      case 'completed':
        return (
          <TableBadge variant="success" icon={<CheckCircle className="h-3 w-3" />}>
            เสร็จสิ้น
          </TableBadge>
        );
      case 'cancelled':
        return (
          <TableBadge variant="error" icon={<XCircle className="h-3 w-3" />}>
            ยกเลิก
          </TableBadge>
        );
      default:
        return null;
    }
  };

  const getBottlesDetail = (bottles: Record<string, number>) => {
    const details = Object.entries(bottles)
      .filter(([_, qty]) => qty > 0)
      .map(([size, qty]) => `${size}: ${qty}`);
    
    return (
      <div className="space-y-1">
        {details.map((detail, index) => (
          <div key={index} className="text-xs">
            {detail}
          </div>
        ))}
      </div>
    );
  };

  const handleCancel = async (batch: ProductionBatch) => {
    if (!window.confirm(`ต้องการยกเลิก Batch ${batch.batchId} หรือไม่?`)) {
      return;
    }

    try {
      await updateDoc(doc(db, 'production_batches', batch.id), {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
        cancelledBy: currentUser?.uid || '',
        cancelledByName: currentUser?.name || ''
      });
      
      toast.success('ยกเลิก Batch สำเร็จ');
      fetchBatches();
    } catch (error) {
      console.error('Error cancelling batch:', error);
      toast.error('เกิดข้อผิดพลาดในการยกเลิก');
    }
  };

  const getFilterOptions = () => [
    { value: 'all', label: 'ทั้งหมด', count: stats.totalBatches, icon: Package, color: 'text-gray-400' },
    { value: 'planned', label: 'วางแผนแล้ว', count: stats.plannedBatches, icon: Clock, color: 'text-blue-400' },
    { value: 'completed', label: 'เสร็จสิ้น', count: stats.completedBatches, icon: CheckCircle, color: 'text-green-400' },
    { value: 'cancelled', label: 'ยกเลิก', count: stats.cancelledBatches, icon: XCircle, color: 'text-red-400' }
  ];

  const currentFilter = getFilterOptions().find(opt => opt.value === statusFilter);

  // Define table columns
  const columns: TableColumn<ProductionBatch>[] = [
    {
      key: 'batchId',
      header: 'Batch ID',
      accessor: (item) => <p className="font-mono text-sm text-white">{item.batchId}</p>,
      mobilePriority: 1,
      mobileLabel: 'Batch ID'
    },
    {
      key: 'productName',
      header: 'ผลิตภัณฑ์',
      accessor: (item) => (
        <div>
          <p className="font-medium text-white">{item.productName}</p>
          <p className="text-xs text-gray-400">{item.totalJuiceNeeded.toFixed(1)} ลิตร</p>
        </div>
      ),
      mobilePriority: 2,
      mobileLabel: 'ผลิตภัณฑ์'
    },
    {
      key: 'productionDate',
      header: 'วันที่ผลิต',
      accessor: (item) => item.productionDate ? (
        <p className="text-sm text-white">{formatDate(item.productionDate)}</p>
      ) : (
        <span className="text-gray-500">-</span>
      ),
      align: 'center',
      mobilePriority: 3,
      mobileLabel: 'วันที่ผลิต'
    },
    {
      key: 'bottles',
      header: 'จำนวนขวด',
      accessor: (item) => getBottlesDetail(item.actualBottlesProduced || item.plannedBottles),
      mobilePriority: 4,
      mobileLabel: 'จำนวน'
    },
    {
      key: 'status',
      header: 'สถานะ',
      accessor: (item) => getStatusBadge(item.status),
      align: 'center',
      mobilePriority: 5
    },
    {
      key: 'responsible',
      header: 'ผู้รับผิดชอบ',
      accessor: (item) => {
        if (item.status === 'completed' && item.completedByName) {
          return (
            <div>
              <p className="text-sm text-white">{item.completedByName}</p>
              <p className="text-xs text-gray-400">
                {formatDateTime(item.completedAt!)}
              </p>
            </div>
          );
        }
        return (
          <div>
            <p className="text-sm text-white">{item.plannedByName}</p>
            <p className="text-xs text-gray-400">
              {formatDateTime(item.plannedAt)}
            </p>
          </div>
        );
      },
      mobilePriority: 6,
      mobileLabel: 'ผู้รับผิดชอบ'
    },
    {
      key: 'actions',
      header: 'จัดการ',
      accessor: (item) => (
        <TableActions>
          {item.status === 'planned' && (
            <>
              <button
                onClick={() => router.push(`/production/execute/${item.batchId}`)}
                className="btn btn-sm btn-primary"
              >
                <Factory className="h-4 w-4" />
                <span className="hidden sm:inline">เริ่มผลิต</span>
              </button>
              {currentUser?.role !== 'operation' && (
                <>
                  <button
                    onClick={() => router.push(`/production/planning/${item.id}`)}
                    className="btn btn-sm btn-ghost"
                  >
                    แก้ไข
                  </button>
                  <button
                    onClick={() => handleCancel(item)}
                    className="btn btn-sm btn-ghost text-red-400 hover:text-red-300"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                </>
              )}
            </>
          )}
          
          {item.status === 'completed' && (
            <button
              onClick={() => router.push(`/production/${item.id}`)}
              className="btn btn-sm btn-ghost"
            >
              ดูรายละเอียด
            </button>
          )}
        </TableActions>
      ),
      align: 'center',
      hideOnMobile: true
    }
  ];

  // Custom mobile card renderer
  const renderMobileCard = (batch: ProductionBatch) => (
    <div className="card">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-mono text-base font-semibold text-white">{batch.batchId}</p>
          <p className="text-lg font-medium text-white mt-1">{batch.productName}</p>
        </div>
        {getStatusBadge(batch.status)}
      </div>
      
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-gray-400" />
          <span className="text-gray-400">วันที่ผลิต:</span>
          <span className="text-white">
            {batch.productionDate 
              ? formatDate(batch.productionDate)
              : '-'}
          </span>
        </div>
        
        <div className="flex items-start gap-2 text-sm">
          <Package className="h-4 w-4 text-gray-400 mt-0.5" />
          <div className="flex-1">
            <span className="text-gray-400">จำนวน:</span>
            <div className="flex flex-wrap gap-3 mt-1">
              {Object.entries(batch.actualBottlesProduced || batch.plannedBottles)
                .filter(([_, qty]) => qty > 0)
                .map(([size, qty]) => (
                  <span key={size} className="text-white">
                    {size}: {qty}
                  </span>
                ))}
            </div>
          </div>
        </div>
        
        <div className="text-sm">
          <span className="text-gray-400">ผู้รับผิดชอบ:</span>
          <span className="text-white ml-2">
            {batch.status === 'completed' && batch.completedByName 
              ? batch.completedByName 
              : batch.plannedByName}
          </span>
        </div>
      </div>
      
      <div className="flex gap-2">
        {batch.status === 'planned' && (
          <>
            <button
              onClick={() => router.push(`/production/execute/${batch.batchId}`)}
              className="btn btn-primary btn-sm flex-1"
            >
              <Factory className="h-4 w-4" />
              เริ่มผลิต
            </button>
            {currentUser?.role !== 'operation' && (
              <button
                onClick={() => handleCancel(batch)}
                className="btn btn-ghost btn-sm text-red-400"
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
          </>
        )}
        
        {batch.status === 'completed' && (
          <button
            onClick={() => router.push(`/production/${batch.id}`)}
            className="btn btn-ghost btn-sm w-full"
          >
            ดูรายละเอียด
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
          <h1 className="text-2xl sm:text-3xl font-bold text-white">การผลิต</h1>
          {currentUser?.role !== 'operation' && (
            <button
              onClick={() => router.push('/production/planning/new')}
              className="btn btn-primary w-full sm:w-auto"
            >
              <Plus className="h-5 w-5" />
              วางแผนผลิต
            </button>
          )}
        </div>
        <p className="text-gray-400 text-base sm:text-lg">จัดการการผลิตทั้งหมด</p>
      </div>

      {/* Mobile Filter Dropdown */}
      <div className="block sm:hidden mb-6">
        <div className="relative">
          <button
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className="w-full btn btn-secondary flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              {currentFilter && (
                <>
                  <currentFilter.icon className={`h-5 w-5 ${currentFilter.color}`} />
                  <span>{currentFilter.label}</span>
                  <span className="text-gray-400">({currentFilter.count})</span>
                </>
              )}
            </div>
            <ChevronDown className={`h-5 w-5 transition-transform ${showFilterDropdown ? 'rotate-180' : ''}`} />
          </button>
          
          {showFilterDropdown && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10 overflow-hidden">
              {getFilterOptions().map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setStatusFilter(option.value);
                    setShowFilterDropdown(false);
                  }}
                  className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-700 transition-colors ${
                    statusFilter === option.value ? 'bg-gray-700' : ''
                  }`}
                >
                  <option.icon className={`h-5 w-5 ${option.color}`} />
                  <span className="flex-1 text-left">{option.label}</span>
                  <span className="text-gray-400">({option.count})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Desktop Status Cards */}
      <div className="hidden sm:grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {getFilterOptions().map((option) => (
          <button
            key={option.value}
            onClick={() => setStatusFilter(option.value)}
            className={`card text-center transition-all ${
              statusFilter === option.value ? 'ring-2 ring-primary' : ''
            }`}
          >
            <option.icon className={`h-8 w-8 ${option.color} mx-auto mb-2`} />
            <p className="text-2xl font-bold text-white">{option.count}</p>
            <p className="text-base text-gray-400">{option.label}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหา Batch ID, ผลิตภัณฑ์..."
            className="input pl-10 text-base sm:text-lg"
          />
        </div>
      </div>

      {/* ResponsiveTable */}
      <div className="card">
        <ResponsiveTable
          data={filteredBatches}
          columns={columns}
          keyExtractor={(item) => item.id}
          loading={loading}
          emptyMessage="ไม่พบข้อมูลการผลิต"
          emptyIcon={<Factory className="h-12 w-12 text-gray-600 mx-auto" />}
          mobileRenderCard={renderMobileCard}
        />
      </div>
    </div>
  );
}