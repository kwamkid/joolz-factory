// src/app/(protected)/raw-materials/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  Package, Plus, Search, Edit, Trash2, 
  ToggleLeft, ToggleRight, Image, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';

interface RawMaterial {
  id: string;
  name: string;
  unit: string;
  imageUrl?: string;
  isActive: boolean;
  createdAt: Date;
  createdBy?: string;
  updatedAt?: Date;
  updatedBy?: string;
}

export default function RawMaterialsPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [filteredMaterials, setFilteredMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Check permission
  useEffect(() => {
    if (currentUser && currentUser.role === 'operation') {
      toast.error('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
      router.push('/dashboard');
    }
  }, [currentUser, router]);

  // Fetch materials
  useEffect(() => {
    fetchMaterials();
  }, []);

  // Filter materials
  useEffect(() => {
    let filtered = materials;

    if (searchQuery) {
      filtered = filtered.filter(material => 
        material.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredMaterials(filtered);
  }, [searchQuery, materials]);

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      const materialsQuery = query(collection(db, 'raw_materials'), orderBy('name', 'asc'));
      const materialsSnapshot = await getDocs(materialsQuery);
      const materialsData: RawMaterial[] = [];
      
      materialsSnapshot.forEach((doc) => {
        const data = doc.data();
        materialsData.push({
          id: doc.id,
          name: data.name,
          unit: data.unit || 'kg',
          imageUrl: data.imageUrl,
          isActive: data.isActive !== false,
          createdAt: data.createdAt?.toDate() || new Date(),
          createdBy: data.createdBy,
          updatedAt: data.updatedAt?.toDate(),
          updatedBy: data.updatedBy
        });
      });

      setMaterials(materialsData);
    } catch (error) {
      console.error('Error fetching materials:', error);
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (materialId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'raw_materials', materialId), {
        isActive: !currentStatus,
        updatedAt: new Date(),
        updatedBy: currentUser?.uid
      });

      toast.success(`${currentStatus ? 'ปิด' : 'เปิด'}การใช้งานสำเร็จ`);
      fetchMaterials();
    } catch (error) {
      console.error('Error updating material status:', error);
      toast.error('เกิดข้อผิดพลาดในการอัพเดทสถานะ');
    }
  };

  const handleDelete = async (materialId: string, materialName: string) => {
    if (!confirm(`ยืนยันการลบวัตถุดิบ ${materialName}?\n\nคำเตือน: การลบจะส่งผลต่อประวัติการซื้อและการผลิต`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'raw_materials', materialId));
      toast.success('ลบวัตถุดิบสำเร็จ');
      fetchMaterials();
    } catch (error) {
      console.error('Error deleting material:', error);
      toast.error('เกิดข้อผิดพลาดในการลบข้อมูล');
    }
  };

  if (loading) {
    return (
      <div className="page-content">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
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
          <h1 className="text-2xl font-bold text-white">จัดการวัตถุดิบ</h1>
          <button
            onClick={() => router.push('/raw-materials/new')}
            className="btn btn-primary"
          >
            <Plus className="h-4 w-4" />
            เพิ่มวัตถุดิบใหม่
          </button>
        </div>
        <p className="text-gray-400">จัดการประเภทและข้อมูลวัตถุดิบ</p>
      </div>

      {/* Search */}
      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาวัตถุดิบ..."
            className="input pl-10"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card text-center">
          <Package className="h-8 w-8 text-primary mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{materials.length}</p>
          <p className="text-sm text-gray-400">วัตถุดิบทั้งหมด</p>
        </div>
        <div className="card text-center">
          <ToggleRight className="h-8 w-8 text-green-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">
            {materials.filter(m => m.isActive).length}
          </p>
          <p className="text-sm text-gray-400">ใช้งานอยู่</p>
        </div>
        <div className="card text-center">
          <ToggleLeft className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">
            {materials.filter(m => !m.isActive).length}
          </p>
          <p className="text-sm text-gray-400">ปิดใช้งาน</p>
        </div>
      </div>

      {/* Materials Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredMaterials.map((material) => (
          <div 
            key={material.id} 
            className={`card ${!material.isActive ? 'opacity-60' : ''}`}
          >
            {/* Image */}
            <div className="h-48 bg-gray-800 rounded-lg mb-4 overflow-hidden">
              {material.imageUrl ? (
                <img 
                  src={material.imageUrl} 
                  alt={material.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Image className="h-16 w-16 text-gray-600" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-white mb-1">{material.name}</h3>
              <p className="text-sm text-gray-400">หน่วย: {material.unit}</p>
            </div>

            {/* Status */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-400">สถานะ:</span>
              <button
                onClick={() => handleToggleActive(material.id, material.isActive)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  material.isActive 
                    ? 'bg-green-900/30 text-green-400' 
                    : 'bg-gray-900/30 text-gray-400'
                }`}
              >
                {material.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => router.push(`/raw-materials/${material.id}`)}
                className="btn btn-secondary flex-1"
              >
                <Edit className="h-4 w-4" />
                แก้ไข
              </button>
              {currentUser?.role === 'admin' && (
                <button
                  onClick={() => handleDelete(material.id, material.name)}
                  className="btn bg-red-600 hover:bg-red-700 text-white"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredMaterials.length === 0 && (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">
            {searchQuery ? 'ไม่พบวัตถุดิบที่ค้นหา' : 'ยังไม่มีวัตถุดิบ'}
          </p>
        </div>
      )}
    </div>
  );
}