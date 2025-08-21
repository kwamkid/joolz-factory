// Path: src/app/(protected)/raw-materials/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { doc, getDoc, setDoc, updateDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ArrowLeft, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import RawMaterialForm, { RawMaterialFormData } from '@/components/raw-materials/RawMaterialForm';
import { RawMaterial } from '@/types/raw-material';

export default function RawMaterialFormPage() {
  const router = useRouter();
  const params = useParams();
  const { user: currentUser } = useAuth();
  const materialId = params.id as string;
  const isEdit = materialId !== 'new';

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(isEdit);
  const [materialData, setMaterialData] = useState<RawMaterial | null>(null);

  // Check permission
  useEffect(() => {
    if (currentUser && currentUser.role === 'operation') {
      toast.error('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
      router.push('/dashboard');
    }
  }, [currentUser, router]);

  // Fetch material data if editing
  useEffect(() => {
    if (isEdit) {
      fetchMaterialData();
    }
  }, [materialId]);

  const fetchMaterialData = async () => {
    try {
      setLoadingData(true);
      const materialDoc = await getDoc(doc(db, 'raw_materials', materialId));
      
      if (!materialDoc.exists()) {
        toast.error('ไม่พบข้อมูลวัตถุดิบ');
        router.push('/raw-materials');
        return;
      }

      const data = materialDoc.data();
      setMaterialData({
        id: materialDoc.id,
        name: data.name,
        unit: data.unit || 'kg',
        minStockLevel: data.minStockLevel || 50,
        imageUrl: data.imageUrl,
        isActive: data.isActive !== false,
        createdAt: data.createdAt?.toDate() || new Date(),
        createdBy: data.createdBy,
        updatedAt: data.updatedAt?.toDate(),
        updatedBy: data.updatedBy
      });
    } catch (error) {
      console.error('Error fetching material:', error);
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      router.push('/raw-materials');
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (formData: RawMaterialFormData, imageUrl: string) => {
    setLoading(true);

    try {
      const materialData = {
        ...formData,
        imageUrl,
        updatedAt: new Date(),
        updatedBy: currentUser?.uid
      };

      if (isEdit) {
        // Update existing
        await updateDoc(doc(db, 'raw_materials', materialId), materialData);
        toast.success('อัพเดทข้อมูลวัตถุดิบสำเร็จ');
      } else {
        // Create new
        const newMaterialData = {
          ...materialData,
          createdAt: new Date(),
          createdBy: currentUser?.uid
        };
        
        await setDoc(doc(collection(db, 'raw_materials')), newMaterialData);
        toast.success('เพิ่มวัตถุดิบใหม่สำเร็จ');
      }

      router.push('/raw-materials');
    } catch (error) {
      console.error('Error saving material:', error);
      toast.error('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.push('/raw-materials');
  };

  if (loadingData) {
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
        <button
          onClick={handleCancel}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          กลับ
        </button>
        
        <h1 className="text-2xl font-bold text-white mb-2">
          {isEdit ? 'แก้ไขข้อมูลวัตถุดิบ' : 'เพิ่มวัตถุดิบใหม่'}
        </h1>
        <p className="text-gray-400">กรอกข้อมูลวัตถุดิบ</p>
      </div>

      {/* Form */}
      <div className="max-w-3xl">
        <div className="card">
          <RawMaterialForm
            initialData={materialData || undefined}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isEdit={isEdit}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
}