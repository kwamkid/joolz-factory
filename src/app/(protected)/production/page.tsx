// src/app/(protected)/production/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  Factory, Plus, Search, Clock, CheckCircle, 
  AlertCircle, Package, Calendar, BarChart3
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
    inProgressBatches: 0,
    completedBatches: 0
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
      inProgressBatches: batches.filter(b => b.status === 'in_progress').length,
      completedBatches: batches.filter(b => b.status === 'completed').length
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
          status: data.status,
          plannedBottles: data.plannedBottles,
          totalJuiceNeeded: data.totalJuiceNeeded,
          materialRequirements: data.materialRequirements,
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
        return <span className="px-2 py-1 bg-blue-900/30 text-blue-400 text-xs rounded-full">วางแผนแล้ว</span>;
      case 'in_progress':
        return <span className="px-2 py-1 bg-yellow-900/30 text-yellow-400 text-xs rounded-full">กำลังผลิต</span>;
      case 'completed':
        return <span className="px-2 py-1 bg-green-900/30 text-green-400 text-xs rounded-full">เสร็จสิ้น</span>;
      case 'cancelled':
        return <span className="px-2 py-1 bg-red-900/30 text-red-400 text-xs rounded-full">ยกเลิก</span>;
      default:
        return null;
    }
  };

  const getTotalBottles = (bottles: Record<string, number>) => {
    return Object.values(bottles).reduce((sum, qty) => sum + qty, 0);
  };

  const getBottlesSummary = (bottles: Record<string, number>) => {
    return Object.entries(bottles)
      .filter(([_, qty]) => qty > 0)
      .map(([size, qty]) => `${size}: ${qty}`)
      .join(', ');
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
          <div className="flex gap-3">
            {currentUser?.role !== 'operation' && (
              <button
                onClick={() => router.push('/production/planning')}
                className="btn btn-primary"
              >
                <Plus className="h-4 w-4" />
                วางแผนผลิต
              </button>
            )}
            <button
              onClick={() => router.push('/production/execute')}
              className="btn btn-secondary"
            >
              <Factory className="h-4 w-4" />
              บันทึกการผลิต
            </button>
          </div>
        </div>
        <p className="text-gray-400">จัดการการผลิตและติดตาม Batch</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="card text-center">
          <Package className="h-8 w-8 text-primary mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{stats.totalBatches}</p>
          <p className="text-sm text-gray-400">Batch ทั้งหมด</p>
        </div>
        <div className="card text-center">
          <Clock className="h-8 w-8 text-blue-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{stats.plannedBatches}</p>
          <p className="text-sm text-gray-400">รอผลิต</p>
        </div>
        <div className="card text-center">
          <Factory className="h-8 w-8 text-yellow-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{stats.inProgressBatches}</p>
          <p className="text-sm text-gray-400">กำลังผลิต</p>
        </div>
        <div className="card text-center">
          <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{stats.completedBatches}</p>
          <p className="text-sm text-gray-400">เสร็จสิ้น</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหา Batch ID, ผลิตภัณฑ์..."
              className="input pl-10"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input"
          >
            <option value="all">สถานะทั้งหมด</option>
            <option value="planned">วางแผนแล้ว</option>
            <option value="in_progress">กำลังผลิต</option>
            <option value="completed">เสร็จสิ้น</option>
            <option value="cancelled">ยกเลิก</option>
          </select>
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
                <th className="text-center p-4 text-sm font-medium text-gray-400">จำนวน</th>
                <th className="text-center p-4 text-sm font-medium text-gray-400">สถานะ</th>
                <th className="text-center p-4 text-sm font-medium text-gray-400">วันที่สร้าง</th>
                <th className="text-left p-4 text-sm font-medium text-gray-400">ผู้สร้าง</th>
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
                    <p className="text-white">
                      {getTotalBottles(batch.actualBottlesProduced || batch.plannedBottles)} ขวด
                    </p>
                    <p className="text-xs text-gray-400">
                      {getBottlesSummary(batch.actualBottlesProduced || batch.plannedBottles)}
                    </p>
                  </td>
                  
                  <td className="p-4 text-center">
                    {getStatusBadge(batch.status)}
                  </td>
                  
                  <td className="p-4 text-center">
                    <p className="text-sm text-white">
                      {batch.plannedAt.toLocaleDateString('th-TH')}
                    </p>
                    <p className="text-xs text-gray-400">
                      {batch.plannedAt.toLocaleTimeString('th-TH', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </td>
                  
                  <td className="p-4">
                    <p className="text-sm text-white">{batch.plannedByName}</p>
                  </td>
                  
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-2">
                      {batch.status === 'planned' && (
                        <button
                          onClick={() => router.push(`/production/execute?batchId=${batch.batchId}`)}
                          className="btn btn-sm btn-primary"
                        >
                          เริ่มผลิต
                        </button>
                      )}
                      {batch.status === 'completed' && (
                        <button
                          onClick={() => router.push(`/production/${batch.id}`)}
                          className="btn btn-sm btn-ghost"
                        >
                          ดูรายละเอียด
                        </button>
                      )}
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