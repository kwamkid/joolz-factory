// src/app/(protected)/bottles/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  FlaskConical, Plus, Search, Edit, Trash2, 
  Package, AlertCircle, TrendingUp, TrendingDown,
  History, MoreVertical
} from 'lucide-react';
import toast from 'react-hot-toast';
import { BottleType } from '@/types/bottle';

export default function BottlesPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [bottles, setBottles] = useState<BottleType[]>([]);
  const [filteredBottles, setFilteredBottles] = useState<BottleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState<string | null>(null);

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

    setFilteredBottles(filtered);
  }, [searchQuery, bottles]);

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
      return { color: 'text-red-400', bg: 'bg-red-900/20', label: 'วิกฤต' };
    } else if (percentage <= 50) {
      return { color: 'text-yellow-400', bg: 'bg-yellow-900/20', label: 'ต่ำ' };
    } else {
      return { color: 'text-green-400', bg: 'bg-green-900/20', label: 'ปกติ' };
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 2
    }).format(amount);
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
          <h1 className="text-2xl font-bold text-white">จัดการขวด</h1>
          <button
            onClick={() => router.push('/bottles/new')}
            className="btn btn-primary"
          >
            <Plus className="h-4 w-4" />
            เพิ่มขวดใหม่
          </button>
        </div>
        <p className="text-gray-400">จัดการประเภทขวดและราคา</p>
      </div>

      {/* Search */}
      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาขนาดขวด..."
            className="input pl-10"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="card text-center">
          <FlaskConical className="h-8 w-8 text-primary mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{bottles.length}</p>
          <p className="text-sm text-gray-400">ประเภททั้งหมด</p>
        </div>
        <div className="card text-center">
          <Package className="h-8 w-8 text-green-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">
            {bottles.filter(b => b.isActive).length}
          </p>
          <p className="text-sm text-gray-400">ใช้งานอยู่</p>
        </div>
        <div className="card text-center">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">
            {bottles.filter(b => b.currentStock < (b.minStockLevel || 0)).length}
          </p>
          <p className="text-sm text-gray-400">สต็อกต่ำ</p>
        </div>
        <div className="card text-center">
          <TrendingUp className="h-8 w-8 text-blue-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">
            {bottles.reduce((sum, b) => sum + b.currentStock, 0).toLocaleString()}
          </p>
          <p className="text-sm text-gray-400">ขวดทั้งหมด</p>
        </div>
      </div>

      {/* Bottles Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left p-4 text-sm font-medium text-gray-400">ขวด</th>
                <th className="text-left p-4 text-sm font-medium text-gray-400">ขนาด</th>
                <th className="text-right p-4 text-sm font-medium text-gray-400">ราคา</th>
                <th className="text-center p-4 text-sm font-medium text-gray-400">สต็อก</th>
                <th className="text-center p-4 text-sm font-medium text-gray-400">สถานะสต็อก</th>
                <th className="text-center p-4 text-sm font-medium text-gray-400">การใช้งาน</th>
                <th className="text-center p-4 text-sm font-medium text-gray-400">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredBottles.map((bottle) => {
                const stockStatus = getStockStatus(bottle.currentStock, bottle.minStockLevel || 0);
                
                return (
                  <tr key={bottle.id} className="border-b border-gray-700 hover:bg-gray-800/50">
                    {/* Bottle Name with Image */}
                    <td className="p-4">
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
                          <p className="font-medium text-white">{bottle.name}</p>
                        </div>
                      </div>
                    </td>

                    {/* Size */}
                    <td className="p-4">
                      <p className="text-white">{bottle.sizeInMl} ml</p>
                    </td>

                    {/* Price */}
                    <td className="p-4 text-right">
                      <p className="text-white">{formatCurrency(bottle.pricePerUnit)}</p>
                    </td>

                    {/* Stock */}
                    <td className="p-4">
                      <div className="text-center">
                        <p className="text-white font-medium">{bottle.currentStock.toLocaleString()}</p>
                        <p className="text-xs text-gray-400">/ {(bottle.minStockLevel || 0).toLocaleString()}</p>
                      </div>
                    </td>

                    {/* Stock Status */}
                    <td className="p-4">
                      <div className="flex justify-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium ${stockStatus.bg} ${stockStatus.color} rounded-full`}>
                          {stockStatus.label}
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2">
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
                    </td>

                    {/* Active Status */}
                    <td className="p-4 text-center">
                      <button
                        onClick={() => handleToggleActive(bottle.id, bottle.isActive)}
                        className={`px-3 py-1 text-xs rounded-full transition-colors ${
                          bottle.isActive 
                            ? 'bg-green-900/30 text-green-400 hover:bg-green-900/50' 
                            : 'bg-gray-900/30 text-gray-400 hover:bg-gray-900/50'
                        }`}
                      >
                        {bottle.isActive ? 'เปิด' : 'ปิด'}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => router.push(`/bottles/${bottle.id}/stock`)}
                          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                          title="จัดการสต็อก"
                        >
                          <Package className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => router.push(`/bottles/${bottle.id}`)}
                          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                          title="แก้ไข"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        {currentUser?.role === 'admin' && (
                          <button
                            onClick={() => handleDelete(bottle.id, bottle.name)}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
                            title="ลบ"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredBottles.length === 0 && (
          <div className="text-center py-12">
            <FlaskConical className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">ไม่พบข้อมูลขวด</p>
          </div>
        )}
      </div>
    </div>
  );
}