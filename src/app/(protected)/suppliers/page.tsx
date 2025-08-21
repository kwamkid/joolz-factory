// Path: src/app/(protected)/suppliers/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  Users, Plus, Search, Edit, Star, Phone, 
  MapPin, MessageCircle, Mail, Package,
  TrendingUp, Ban, AlertCircle, Filter, Trash2, Loader2, ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Supplier } from '@/types/supplier';
import { ResponsiveTable, TableColumn, TableBadge, TableActions, formatDate } from '@/components/ui/ResponsiveTable';

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
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Check permission
  useEffect(() => {
    if (currentUser && currentUser.role === 'operation') {
      toast.error('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
      router.push('/dashboard');
    }
  }, [currentUser, router]);

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

  // Define table columns
  const columns: TableColumn<Supplier>[] = [
    {
      key: 'name',
      header: 'ซัพพลายเออร์',
      accessor: (item) => (
        <div>
          <p className="font-medium text-base text-white">{item.name}</p>
          <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
            {item.contact && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {item.contact}
              </span>
            )}
            {item.lineId && (
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3" />
                {item.lineId}
              </span>
            )}
          </div>
        </div>
      ),
      mobilePriority: 1,
      mobileLabel: 'ซัพพลายเออร์'
    },
    {
      key: 'rawMaterials',
      header: 'วัตถุดิบ',
      accessor: (item) => (
        <div className="flex flex-wrap gap-1">
          {item.rawMaterials.map(material => (
            <span key={material} className="px-2 py-1 bg-gray-700 text-sm text-gray-300 rounded">
              {material}
            </span>
          ))}
        </div>
      ),
      mobilePriority: 3,
      mobileLabel: 'วัตถุดิบ'
    },
    {
      key: 'rating',
      header: 'คะแนน',
      accessor: (item) => item.totalRatings > 0 ? (
        <div>
          <div className="flex items-center justify-center gap-1">
            <Star className={`h-4 w-4 ${getRatingColor(item.rating)} fill-current`} />
            <span className={`font-medium text-base ${getRatingColor(item.rating)}`}>
              {item.rating.toFixed(1)}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            ({item.totalRatings} รีวิว)
          </p>
        </div>
      ) : (
        <span className="text-gray-500 text-base">ยังไม่มีคะแนน</span>
      ),
      align: 'center',
      mobilePriority: 2,
      mobileLabel: 'คะแนน'
    },
    {
      key: 'averagePrice',
      header: 'ราคาเฉลี่ย',
      accessor: (item) => item.averagePrice > 0 ? (
        <p className="text-base text-white">{formatCurrency(item.averagePrice)}/kg</p>
      ) : (
        <span className="text-gray-500 text-base">-</span>
      ),
      align: 'right',
      mobilePriority: 4,
      mobileLabel: 'ราคาเฉลี่ย'
    },
    {
      key: 'purchases',
      header: 'ซื้อแล้ว',
      accessor: (item) => (
        <div>
          <p className="text-base text-white">{item.totalPurchases} ครั้ง</p>
          {item.lastPurchase && (
            <p className="text-sm text-gray-500 mt-1">
              ล่าสุด: {formatDate(item.lastPurchase)}
            </p>
          )}
        </div>
      ),
      align: 'center',
      hideOnMobile: true
    },
    {
      key: 'status',
      header: 'สถานะ',
      accessor: (item) => item.status === 'active' ? (
        <TableBadge variant="success">ใช้งาน</TableBadge>
      ) : (
        <div>
          <TableBadge variant="error">ถูกระงับ</TableBadge>
          {item.bannedReason && (
            <p className="text-sm text-gray-500 mt-1">{item.bannedReason}</p>
          )}
        </div>
      ),
      align: 'center',
      mobilePriority: 5
    },
    {
      key: 'actions',
      header: 'จัดการ',
      accessor: (item) => (
        <TableActions>
          <button
            onClick={() => router.push(`/suppliers/${item.id}`)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="แก้ไข"
          >
            <Edit className="h-4 w-4" />
          </button>
          
          {item.status === 'active' ? (
            <button
              onClick={() => handleBanSupplier(item)}
              className="p-2 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-900/20 rounded-lg transition-colors"
              title="ระงับ"
            >
              <Ban className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => handleUnbanSupplier(item.id)}
              className="p-2 text-green-400 hover:text-green-300 hover:bg-green-900/20 rounded-lg transition-colors"
              title="ยกเลิกการระงับ"
            >
              <TrendingUp className="h-4 w-4" />
            </button>
          )}
          
          {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
            <button
              onClick={() => handleDeleteSupplier(item)}
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
  const renderMobileCard = (supplier: Supplier) => (
    <div className="card">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <p className="font-medium text-lg text-white">{supplier.name}</p>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
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
        {supplier.status === 'active' ? (
          <TableBadge variant="success">ใช้งาน</TableBadge>
        ) : (
          <TableBadge variant="error">ถูกระงับ</TableBadge>
        )}
      </div>

      <div className="space-y-3">
        {/* Rating */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">คะแนน</span>
          {supplier.totalRatings > 0 ? (
            <div className="flex items-center gap-1">
              <Star className={`h-4 w-4 ${getRatingColor(supplier.rating)} fill-current`} />
              <span className={`font-medium ${getRatingColor(supplier.rating)}`}>
                {supplier.rating.toFixed(1)}
              </span>
              <span className="text-sm text-gray-500">({supplier.totalRatings})</span>
            </div>
          ) : (
            <span className="text-gray-500">ยังไม่มีคะแนน</span>
          )}
        </div>

        {/* Raw Materials */}
        <div>
          <p className="text-sm text-gray-400 mb-2">วัตถุดิบที่ขาย</p>
          <div className="flex flex-wrap gap-1">
            {supplier.rawMaterials.map(material => (
              <span key={material} className="px-2 py-1 bg-gray-700 text-sm text-gray-300 rounded">
                {material}
              </span>
            ))}
          </div>
        </div>

        {/* Price & Purchase Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-400">ราคาเฉลี่ย</p>
            <p className="text-white">
              {supplier.averagePrice > 0 ? `${formatCurrency(supplier.averagePrice)}/kg` : '-'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-400">ซื้อแล้ว</p>
            <p className="text-white">{supplier.totalPurchases} ครั้ง</p>
          </div>
        </div>

        {supplier.bannedReason && (
          <div className="pt-2 border-t border-gray-700">
            <p className="text-sm text-red-400">เหตุผล: {supplier.bannedReason}</p>
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={() => router.push(`/suppliers/${supplier.id}`)}
          className="btn btn-ghost btn-sm flex-1"
        >
          <Edit className="h-4 w-4" />
          แก้ไข
        </button>
        
        {supplier.status === 'active' ? (
          <button
            onClick={() => handleBanSupplier(supplier)}
            className="btn btn-ghost btn-sm text-yellow-400"
          >
            <Ban className="h-4 w-4" />
            ระงับ
          </button>
        ) : (
          <button
            onClick={() => handleUnbanSupplier(supplier.id)}
            className="btn btn-ghost btn-sm text-green-400"
          >
            <TrendingUp className="h-4 w-4" />
            ยกเลิกระงับ
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
          <h1 className="text-2xl sm:text-3xl font-bold text-white">ซัพพลายเออร์</h1>
          <button
            onClick={() => router.push('/suppliers/new')}
            className="btn btn-primary w-full sm:w-auto"
          >
            <Plus className="h-5 w-5" />
            เพิ่มซัพพลายเออร์
          </button>
        </div>
        <p className="text-gray-400">จัดการข้อมูลซัพพลายเออร์และผู้จำหน่ายวัตถุดิบ</p>
      </div>

      {/* Stats - Responsive Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div className="card text-center p-4 sm:p-6">
          <Users className="h-6 w-6 sm:h-8 sm:w-8 text-primary mx-auto mb-2" />
          <p className="text-lg sm:text-2xl font-bold text-white">{suppliers.length}</p>
          <p className="text-xs sm:text-sm text-gray-400">ทั้งหมด</p>
        </div>
        <div className="card text-center p-4 sm:p-6">
          <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-green-400 mx-auto mb-2" />
          <p className="text-lg sm:text-2xl font-bold text-white">
            {suppliers.filter(s => s.status === 'active').length}
          </p>
          <p className="text-xs sm:text-sm text-gray-400">ใช้งานอยู่</p>
        </div>
        <div className="card text-center p-4 sm:p-6">
          <Star className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-400 mx-auto mb-2" />
          <p className="text-lg sm:text-2xl font-bold text-white">
            {suppliers.filter(s => s.rating >= 4).length}
          </p>
          <p className="text-xs sm:text-sm text-gray-400">คะแนนดี (4+)</p>
        </div>
        <div className="card text-center p-4 sm:p-6">
          <Ban className="h-6 w-6 sm:h-8 sm:w-8 text-red-400 mx-auto mb-2" />
          <p className="text-lg sm:text-2xl font-bold text-white">
            {suppliers.filter(s => s.status === 'banned').length}
          </p>
          <p className="text-xs sm:text-sm text-gray-400">ถูกระงับ</p>
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

      {/* ResponsiveTable */}
      <div className="card">
        <ResponsiveTable
          data={filteredSuppliers}
          columns={columns}
          keyExtractor={(item) => item.id}
          loading={loading}
          emptyMessage="ไม่พบซัพพลายเออร์"
          emptyIcon={<Users className="h-12 w-12 text-gray-600 mx-auto" />}
          mobileRenderCard={renderMobileCard}
        />
      </div>
    </div>
  );
}