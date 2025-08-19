// src/app/(protected)/production/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { collection, getDocs, query, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  Factory, Plus, Search, Clock, CheckCircle, 
  AlertCircle, Package, Calendar, FileText,
  XCircle, PlayCircle, Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ProductionBatch } from '@/types/production';

export default function ProductionPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [filteredBatches, setFilteredBatches] = useState<ProductionBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

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
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-900/30 text-blue-400 text-xs rounded-full">
            <Clock className="h-3 w-3" />
            วางแผนแล้ว
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-900/30 text-green-400 text-xs rounded-full">
            <CheckCircle className="h-3 w-3" />
            เสร็จสิ้น
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-900/30 text-red-400 text-xs rounded-full">
            <XCircle className="h-3 w-3" />
            ยกเลิก
          </span>
        );
      default:
        return null;
    }
  };

  const getBottlesDetail = (bottles: Record<string, number>) => {
    return Object.entries(bottles)
      .filter(([_, qty]) => qty > 0)
      .map(([size, qty]) => (
        <div key={size} className="flex items-center gap-1 text-xs">
          <span className="text-gray-400">{size}:</span>
          <span className="text-white font-medium">{qty}</span>
        </div>
      ));
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

  const getActionButtons = (batch: ProductionBatch) => {
    switch (batch.status) {
      case 'planned':
        return (
          <>
            <button
              onClick={() => router.push(`/production/execute/${batch.batchId}`)}
              className="btn btn-sm btn-primary"
            >
              <Factory className="h-4 w-4" />
              เริ่มผลิต
            </button>
            {currentUser?.role !== 'operation' && (
              <>
                <button
                  onClick={() => router.push(`/production/planning/${batch.id}`)}
                  className="btn btn-sm btn-ghost"
                >
                  แก้ไข
                </button>
                <button
                  onClick={() => handleCancel(batch)}
                  className="btn btn-sm btn-ghost text-red-400 hover:text-red-300"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </>
            )}
          </>
        );
      case 'completed':
        return (
          <button
            onClick={() => router.push(`/production/${batch.id}`)}
            className="btn btn-sm btn-ghost"
          >
            ดูรายละเอียด
          </button>
        );
      default:
        return null;
    }
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
          <h1 className="text-2xl font-bold text-white">การผลิต</h1>
          {currentUser?.role !== 'operation' && (
            <button
              onClick={() => router.push('/production/planning/new')}
              className="btn btn-primary"
            >
              <Plus className="h-4 w-4" />
              วางแผนผลิต
            </button>
          )}
        </div>
        <p className="text-gray-400">จัดการการผลิตทั้งหมด</p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <button
          onClick={() => setStatusFilter('all')}
          className={`card text-center transition-all ${
            statusFilter === 'all' ? 'ring-2 ring-primary' : ''
          }`}
        >
          <Package className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{stats.totalBatches}</p>
          <p className="text-sm text-gray-400">ทั้งหมด</p>
        </button>
        
        <button
          onClick={() => setStatusFilter('planned')}
          className={`card text-center transition-all ${
            statusFilter === 'planned' ? 'ring-2 ring-blue-400' : ''
          }`}
        >
          <Clock className="h-8 w-8 text-blue-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{stats.plannedBatches}</p>
          <p className="text-sm text-gray-400">วางแผนแล้ว</p>
        </button>
        
        <button
          onClick={() => setStatusFilter('completed')}
          className={`card text-center transition-all ${
            statusFilter === 'completed' ? 'ring-2 ring-green-400' : ''
          }`}
        >
          <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{stats.completedBatches}</p>
          <p className="text-sm text-gray-400">เสร็จสิ้น</p>
        </button>
        
        <button
          onClick={() => setStatusFilter('cancelled')}
          className={`card text-center transition-all ${
            statusFilter === 'cancelled' ? 'ring-2 ring-red-400' : ''
          }`}
        >
          <XCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{stats.cancelledBatches}</p>
          <p className="text-sm text-gray-400">ยกเลิก</p>
        </button>
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
            className="input pl-10"
          />
        </div>
      </div>

      {/* Batches Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left p-4 text-sm font-medium text-gray-400">Batch ID</th>
                <th className="text-left p-4 text-sm font-medium text-gray-400">ผลิตภัณฑ์</th>
                <th className="text-center p-4 text-sm font-medium text-gray-400">วันที่ผลิต</th>
                <th className="text-left p-4 text-sm font-medium text-gray-400">จำนวนขวด</th>
                <th className="text-center p-4 text-sm font-medium text-gray-400">สถานะ</th>
                <th className="text-left p-4 text-sm font-medium text-gray-400">ผู้รับผิดชอบ</th>
                <th className="text-center p-4 text-sm font-medium text-gray-400">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredBatches.map((batch) => (
                <tr key={batch.id} className="border-b border-gray-700 hover:bg-gray-800/50">
                  <td className="p-4">
                    <p className="font-mono text-sm text-white">{batch.batchId}</p>
                  </td>
                  
                  <td className="p-4">
                    <p className="font-medium text-white">{batch.productName}</p>
                    <p className="text-xs text-gray-400">{batch.totalJuiceNeeded.toFixed(1)} ลิตร</p>
                  </td>
                  
                  <td className="p-4 text-center">
                    {batch.productionDate ? (
                      <p className="text-sm text-white">
                        {new Date(batch.productionDate).toLocaleDateString('th-TH')}
                      </p>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>
                  
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      {getBottlesDetail(batch.actualBottlesProduced || batch.plannedBottles)}
                    </div>
                  </td>
                  
                  <td className="p-4 text-center">
                    {getStatusBadge(batch.status)}
                  </td>
                  
                  <td className="p-4">
                    {batch.status === 'completed' && batch.completedByName ? (
                      <div>
                        <p className="text-sm text-white">{batch.completedByName}</p>
                        <p className="text-xs text-gray-400">
                          {batch.completedAt?.toLocaleDateString('th-TH', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-white">{batch.plannedByName}</p>
                        <p className="text-xs text-gray-400">
                          {batch.plannedAt.toLocaleDateString('th-TH', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                    )}
                  </td>
                  
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-2">
                      {getActionButtons(batch)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredBatches.length === 0 && (
          <div className="text-center py-12">
            <Factory className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">ไม่พบข้อมูลการผลิต</p>
          </div>
        )}
      </div>
    </div>
  );
}