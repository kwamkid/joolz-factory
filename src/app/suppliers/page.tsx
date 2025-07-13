// src/app/suppliers/page.tsx (ใช้ AppLayout)
'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Supplier } from '@/types';
import toast from 'react-hot-toast';

import AppLayout from '@/components/ui/AppLayout';
import SupplierForm from '@/components/suppliers/SupplierForm';
import SupplierCard from '@/components/suppliers/SupplierCard';
import SupplierRating from '@/components/suppliers/SupplierRating';
import SearchInput from '@/components/ui/SearchInput';
import FilterSelect from '@/components/ui/FilterSelect';

export default function SuppliersPage() {
  const { hasRole } = useAuth();
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'banned'>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [ratingSupplier, setRatingSupplier] = useState<Supplier | null>(null);

  // ตรวจสอบสิทธิ์
  useEffect(() => {
    if (!hasRole('manager') && !hasRole('admin')) {
      router.push('/dashboard');
      return;
    }
  }, [hasRole, router]);

  // โหลดข้อมูล Suppliers
  useEffect(() => {
    const q = query(
      collection(db, 'suppliers'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const suppliersData: Supplier[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        suppliersData.push({
          id: doc.id,
          name: data.name,
          contact: data.contact,
          address: data.address || '',
          lineId: data.lineId || '',
          email: data.email || '',
          rating: data.rating || 5,
          totalRatings: data.totalRatings || 0,
          averagePrice: data.averagePrice || 0,
          status: data.status || 'active',
          bannedReason: data.bannedReason,
          bannedDate: data.bannedDate?.toDate(),
          isActive: data.status !== 'banned',
          createdBy: data.createdBy,
          createdAt: data.createdAt?.toDate() || new Date(),
        });
      });
      setSuppliers(suppliersData);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Filter suppliers
  const filteredSuppliers = suppliers.filter(supplier => {
    const matchesSearch = supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         supplier.contact.includes(searchTerm);
    
    const matchesFilter = filterStatus === 'all' || 
                         (filterStatus === 'active' && supplier.status === 'active') ||
                         (filterStatus === 'banned' && supplier.status === 'banned');
    
    return matchesSearch && matchesFilter;
  });

  const toggleSupplierStatus = async (supplier: Supplier) => {
    try {
      const newStatus = supplier.status === 'active' ? 'banned' : 'active';
      const updateData: any = {
        status: newStatus,
      };

      if (newStatus === 'banned') {
        updateData.bannedDate = new Date();
        updateData.bannedReason = 'ระงับการใช้งาน';
      }

      await updateDoc(doc(db, 'suppliers', supplier.id), updateData);
      toast.success(newStatus === 'banned' ? 'ระงับซัพพลายเออร์แล้ว' : 'เปิดใช้งานซัพพลายเออร์แล้ว');
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  // Header Actions
  const headerActions = (
    <button
      onClick={() => setShowAddForm(true)}
      className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-2 px-4 rounded-xl transition-colors flex items-center space-x-2"
    >
      <Plus className="h-5 w-5" />
      <span className="hidden sm:inline">เพิ่มซัพพลายเออร์</span>
    </button>
  );

  if (loading) {
    return (
      <AppLayout title="🏢 จัดการซัพพลายเออร์">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-yellow-500 border-t-transparent mx-auto"></div>
            <p className="mt-6 text-white text-lg font-medium">กำลังโหลดข้อมูลซัพพลายเออร์...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout 
      title="🏢 จัดการซัพพลายเออร์"
      headerActions={headerActions}
    >
      <div className="p-4 sm:p-6 space-y-6 overflow-y-auto h-full">
        
        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="ค้นหาชื่อหรือเบอร์โทร..."
            className="flex-1"
            onClear={() => setSearchTerm('')}
          />

          {/* Filter */}
          <FilterSelect
            value={filterStatus}
            onChange={(value) => setFilterStatus(value as any)}
            options={[
              { value: 'all', label: 'ทั้งหมด', count: suppliers.length },
              { value: 'active', label: 'ใช้งานได้', count: suppliers.filter(s => s.status === 'active').length },
              { value: 'banned', label: 'ถูกระงับ', count: suppliers.filter(s => s.status === 'banned').length }
            ]}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400">{suppliers.length}</div>
            <div className="text-sm text-gray-300">ทั้งหมด</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-green-400">{suppliers.filter(s => s.status === 'active').length}</div>
            <div className="text-sm text-gray-300">ใช้งานได้</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-red-400">{suppliers.filter(s => s.status === 'banned').length}</div>
            <div className="text-sm text-gray-300">ถูกระงับ</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-blue-400">
              {suppliers.length > 0 ? (suppliers.reduce((sum, s) => sum + s.rating, 0) / suppliers.length).toFixed(1) : '0.0'}
            </div>
            <div className="text-sm text-gray-300">คะแนนเฉลี่ย</div>
          </div>
        </div>

        {/* Suppliers List */}
        {filteredSuppliers.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-semibold text-white mb-2">ไม่พบซัพพลายเออร์</h3>
            <p className="text-gray-400">ลองเปลี่ยนคำค้นหาหรือเพิ่มซัพพลายเออร์ใหม่</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 pb-6">
            {filteredSuppliers.map((supplier) => (
              <SupplierCard
                key={supplier.id}
                supplier={supplier}
                onEdit={setEditingSupplier}
                onToggleStatus={toggleSupplierStatus}
                onRate={setRatingSupplier}
              />
            ))}
          </div>
        )}
      </div>

      {/* Rating Form */}
      {ratingSupplier && (
        <SupplierRating
          supplier={ratingSupplier}
          onClose={() => setRatingSupplier(null)}
          onSuccess={() => {
            // Data จะ refresh อัตโนมัติผ่าน onSnapshot
          }}
        />
      )}

      {/* Add/Edit Form Modal */}
      {(showAddForm || editingSupplier) && (
        <SupplierForm
          supplier={editingSupplier}
          onClose={() => {
            setShowAddForm(false);
            setEditingSupplier(null);
          }}
          onSuccess={() => {
            // Form จะปิดเองใน onClose
            // Data จะ refresh อัตโนมัติผ่าน onSnapshot
          }}
        />
      )}
    </AppLayout>
  );
}