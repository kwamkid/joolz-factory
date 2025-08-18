// src/app/(protected)/suppliers/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  Users, Plus, Search, Edit, Star, Phone, 
  MapPin, MessageCircle, Mail, Package,
  TrendingUp, Ban, AlertCircle, Filter, Trash2, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Supplier } from '@/types/supplier';

export default function SuppliersPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'banned'>('all');
  const [materialFilter, setMaterialFilter] = useState<string>('all');
  const [allMaterials, setAllMaterials] = useState<string[]>([]);

  // Check permission
  useEffect(() => {
    if (currentUser && currentUser.role === 'operation') {
      toast.error('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
      router.push('/dashboard');
    }
  }, [currentUser, router]);

  // Debug user role
  useEffect(() => {
    if (currentUser) {
      console.log('Current User:', currentUser);
      console.log('User Role:', currentUser.role);
    }
  }, [currentUser]);

  // Fetch suppliers
  useEffect(() => {
    fetchSuppliers();
  }, []);

  // Filter suppliers
  useEffect(() => {
    let filtered = suppliers;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(supplier => 
        supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        supplier.contact?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        supplier.lineId?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(supplier => supplier.status === statusFilter);
    }

    // Material filter
    if (materialFilter !== 'all') {
      filtered = filtered.filter(supplier => 
        supplier.rawMaterials.includes(materialFilter)
      );
    }

    // Sort by rating (highest first)
    filtered.sort((a, b) => b.rating - a.rating);

    setFilteredSuppliers(filtered);
  }, [searchQuery, statusFilter, materialFilter, suppliers]);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const suppliersQuery = query(collection(db, 'suppliers'), orderBy('rating', 'desc'));
      const suppliersSnapshot = await getDocs(suppliersQuery);
      const suppliersData: Supplier[] = [];
      
      suppliersSnapshot.forEach((doc) => {
        const data = doc.data();
        suppliersData.push({
          id: doc.id,
          name: data.name,
          contact: data.contact,
          address: data.address,
          lineId: data.lineId,
          email: data.email,
          rating: data.rating || 0,
          totalRatings: data.totalRatings || 0,
          averagePrice: data.averagePrice || 0,
          totalPurchases: data.totalPurchases || 0,
          totalAmount: data.totalAmount || 0,
          status: data.status || 'active',
          bannedReason: data.bannedReason,
          bannedDate: data.bannedDate?.toDate(),
          bannedBy: data.bannedBy,
          rawMaterials: data.rawMaterials || [],
          createdBy: data.createdBy,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate(),
          updatedBy: data.updatedBy,
          lastPurchase: data.lastPurchase?.toDate()
        });
      });

      setSuppliers(suppliersData);

      // Extract all unique materials
      const materials = new Set<string>();
      suppliersData.forEach(supplier => {
        supplier.rawMaterials.forEach(material => materials.add(material));
      });
      setAllMaterials(Array.from(materials).sort());

    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const handleBanSupplier = async (supplier: Supplier) => {
    const reason = prompt('เหตุผลในการระงับ:');
    if (!reason) return;

    try {
      await updateDoc(doc(db, 'suppliers', supplier.id), {
        status: 'banned',
        bannedReason: reason,
        bannedDate: new Date(),
        bannedBy: currentUser?.uid,
        updatedAt: new Date(),
        updatedBy: currentUser?.uid
      });

      toast.success('ระงับซัพพลายเออร์สำเร็จ');
      fetchSuppliers();
    } catch (error) {
      console.error('Error banning supplier:', error);
      toast.error('เกิดข้อผิดพลาดในการระงับซัพพลายเออร์');
    }
  };

  const handleUnbanSupplier = async (supplierId: string) => {
    try {
      await updateDoc(doc(db, 'suppliers', supplierId), {
        status: 'active',
        bannedReason: null,
        bannedDate: null,
        bannedBy: null,
        updatedAt: new Date(),
        updatedBy: currentUser?.uid
      });

      toast.success('ยกเลิกการระงับสำเร็จ');
      fetchSuppliers();
    } catch (error) {
      console.error('Error unbanning supplier:', error);
      toast.error('เกิดข้อผิดพลาดในการยกเลิกการระงับ');
    }
  };

  const handleDeleteSupplier = async (supplier: Supplier) => {
    // Check if supplier has purchase history
    if (supplier.totalPurchases > 0) {
      const confirmDelete = confirm(
        `⚠️ คำเตือน!\n\n` +
        `ซัพพลายเออร์ "${supplier.name}" มีประวัติการซื้อ ${supplier.totalPurchases} ครั้ง\n` +
        `มูลค่ารวม ${formatCurrency(supplier.totalAmount)}\n\n` +
        `การลบจะทำให้ข้อมูลประวัติการซื้อไม่สมบูรณ์\n` +
        `แนะนำให้ใช้การ "ระงับ" แทนการลบ\n\n` +
        `ยืนยันที่จะลบหรือไม่?`
      );
      
      if (!confirmDelete) return;
    } else {
      // No purchase history
      const confirmDelete = confirm(
        `ต้องการลบซัพพลายเออร์ "${supplier.name}" ใช่หรือไม่?`
      );
      
      if (!confirmDelete) return;
    }

    try {
      await deleteDoc(doc(db, 'suppliers', supplier.id));
      toast.success('ลบซัพพลายเออร์สำเร็จ');
      fetchSuppliers();
    } catch (error) {
      console.error('Error deleting supplier:', error);
      toast.error('เกิดข้อผิดพลาดในการลบซัพพลายเออร์');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return 'text-green-400';
    if (rating >= 3.5) return 'text-yellow-400';
    if (rating >= 2.5) return 'text-orange-400';
    return 'text-red-400';
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
          <h1 className="text-2xl font-bold text-white">ซัพพลายเออร์</h1>
          <button
            onClick={() => router.push('/suppliers/new')}
            className="btn btn-primary"
          >
            <Plus className="h-4 w-4" />
            เพิ่มซัพพลายเออร์
          </button>
        </div>
        <p className="text-gray-400">จัดการข้อมูลซัพพลายเออร์และผู้จำหน่ายวัตถุดิบ</p>
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
              placeholder="ค้นหาชื่อ, เบอร์โทร, LINE ID..."
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
            <option value="banned">ถูกระงับ</option>
          </select>

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
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="card text-center">
          <Users className="h-8 w-8 text-primary mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{suppliers.length}</p>
          <p className="text-sm text-gray-400">ทั้งหมด</p>
        </div>
        <div className="card text-center">
          <TrendingUp className="h-8 w-8 text-green-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">
            {suppliers.filter(s => s.status === 'active').length}
          </p>
          <p className="text-sm text-gray-400">ใช้งานอยู่</p>
        </div>
        <div className="card text-center">
          <Star className="h-8 w-8 text-yellow-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">
            {suppliers.filter(s => s.rating >= 4).length}
          </p>
          <p className="text-sm text-gray-400">คะแนนดี (4+)</p>
        </div>
        <div className="card text-center">
          <Ban className="h-8 w-8 text-red-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">
            {suppliers.filter(s => s.status === 'banned').length}
          </p>
          <p className="text-sm text-gray-400">ถูกระงับ</p>
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left p-4 text-sm font-medium text-gray-400">ซัพพลายเออร์</th>
                <th className="text-left p-4 text-sm font-medium text-gray-400">วัตถุดิบ</th>
                <th className="text-center p-4 text-sm font-medium text-gray-400">คะแนน</th>
                <th className="text-right p-4 text-sm font-medium text-gray-400">ราคาเฉลี่ย</th>
                <th className="text-center p-4 text-sm font-medium text-gray-400">ซื้อแล้ว</th>
                <th className="text-center p-4 text-sm font-medium text-gray-400">สถานะ</th>
                <th className="text-center p-4 text-sm font-medium text-gray-400">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.map((supplier) => (
                <tr key={supplier.id} className="border-b border-gray-700 hover:bg-gray-800/50">
                  {/* Supplier Info */}
                  <td className="p-4">
                    <div>
                      <p className="font-medium text-white">{supplier.name}</p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                        {supplier.contact && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {supplier.contact}
                          </span>
                        )}
                        {supplier.lineId && (
                          <span className="flex items-center gap-1">
                            <MessageCircle className="h-3 w-3" />
                            {supplier.lineId}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Raw Materials */}
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {supplier.rawMaterials.map(material => (
                        <span key={material} className="px-2 py-1 bg-gray-700 text-xs text-gray-300 rounded">
                          {material}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Rating */}
                  <td className="p-4 text-center">
                    {supplier.totalRatings > 0 ? (
                      <div>
                        <div className="flex items-center justify-center gap-1">
                          <Star className={`h-4 w-4 ${getRatingColor(supplier.rating)} fill-current`} />
                          <span className={`font-medium ${getRatingColor(supplier.rating)}`}>
                            {supplier.rating.toFixed(1)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          ({supplier.totalRatings} รีวิว)
                        </p>
                      </div>
                    ) : (
                      <span className="text-gray-500 text-sm">ยังไม่มีคะแนน</span>
                    )}
                  </td>

                  {/* Average Price */}
                  <td className="p-4 text-right">
                    {supplier.averagePrice > 0 ? (
                      <p className="text-white">{formatCurrency(supplier.averagePrice)}/kg</p>
                    ) : (
                      <span className="text-gray-500 text-sm">-</span>
                    )}
                  </td>

                  {/* Purchase Count */}
                  <td className="p-4 text-center">
                    <p className="text-white">{supplier.totalPurchases} ครั้ง</p>
                    {supplier.lastPurchase && (
                      <p className="text-xs text-gray-500 mt-1">
                        ล่าสุด: {new Date(supplier.lastPurchase).toLocaleDateString('th-TH')}
                      </p>
                    )}
                  </td>

                  {/* Status */}
                  <td className="p-4 text-center">
                    {supplier.status === 'active' ? (
                      <span className="px-3 py-1 bg-green-900/30 text-green-400 text-xs rounded-full">
                        ใช้งาน
                      </span>
                    ) : (
                      <div>
                        <span className="px-3 py-1 bg-red-900/30 text-red-400 text-xs rounded-full">
                          ถูกระงับ
                        </span>
                        {supplier.bannedReason && (
                          <p className="text-xs text-gray-500 mt-1">{supplier.bannedReason}</p>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => router.push(`/suppliers/${supplier.id}`)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                        title="แก้ไข"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      
                      {supplier.status === 'active' ? (
                        <button
                          onClick={() => handleBanSupplier(supplier)}
                          className="p-2 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-900/20 rounded-lg transition-colors"
                          title="ระงับ"
                        >
                          <Ban className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUnbanSupplier(supplier.id)}
                          className="p-2 text-green-400 hover:text-green-300 hover:bg-green-900/20 rounded-lg transition-colors"
                          title="ยกเลิกการระงับ"
                        >
                          <TrendingUp className="h-4 w-4" />
                        </button>
                      )}
                      
                      {/* Delete Button - Only for Admin and Manager */}
                      {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
                        <button
                          onClick={() => handleDeleteSupplier(supplier)}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
                          title="ลบ"
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

        {filteredSuppliers.length === 0 && (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">ไม่พบซัพพลายเออร์</p>
          </div>
        )}
      </div>
    </div>
  );
}