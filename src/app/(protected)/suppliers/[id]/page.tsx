// src/app/(protected)/suppliers/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { doc, getDoc, setDoc, updateDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ArrowLeft, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import SupplierForm, { SupplierFormData } from '@/components/suppliers/SupplierForm';
import { Supplier } from '@/types/supplier';

export default function SupplierFormPage() {
  const router = useRouter();
  const params = useParams();
  const { user: currentUser } = useAuth();
  const supplierId = params.id as string;
  const isEdit = supplierId !== 'new';

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(isEdit);
  const [supplierData, setSupplierData] = useState<Supplier | null>(null);

  // Check permission
  useEffect(() => {
    if (currentUser && currentUser.role === 'operation') {
      toast.error('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
      router.push('/dashboard');
    }
  }, [currentUser, router]);

  // Fetch supplier data if editing
  useEffect(() => {
    if (isEdit) {
      fetchSupplierData();
    }
  }, [supplierId]);

  const fetchSupplierData = async () => {
    try {
      setLoadingData(true);
      const supplierDoc = await getDoc(doc(db, 'suppliers', supplierId));
      
      if (!supplierDoc.exists()) {
        toast.error('ไม่พบข้อมูลซัพพลายเออร์');
        router.push('/suppliers');
        return;
      }

      const data = supplierDoc.data();
      setSupplierData({
        id: supplierDoc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
        lastPurchase: data.lastPurchase?.toDate(),
        bannedDate: data.bannedDate?.toDate()
      } as Supplier);
    } catch (error) {
      console.error('Error fetching supplier:', error);
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      router.push('/suppliers');
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (formData: SupplierFormData) => {
    setLoading(true);

    try {
      // Build supplier data object, excluding undefined values
      const supplierData: any = {
        name: formData.name,
        rawMaterials: formData.rawMaterials,
        status: formData.status,
        updatedAt: new Date(),
        updatedBy: currentUser?.uid
      };

      // Only add optional fields if they have values
      if (formData.contact) supplierData.contact = formData.contact;
      if (formData.address) supplierData.address = formData.address;
      if (formData.lineId) supplierData.lineId = formData.lineId;
      if (formData.email) supplierData.email = formData.email;

      if (isEdit) {
        // Update existing supplier
        await updateDoc(doc(db, 'suppliers', supplierId), supplierData);
        toast.success('อัพเดทข้อมูลซัพพลายเออร์สำเร็จ');
      } else {
        // Create new supplier
        const newSupplierData = {
          ...supplierData,
          rating: 0,
          totalRatings: 0,
          averagePrice: 0,
          totalPurchases: 0,
          totalAmount: 0,
          createdAt: new Date(),
          createdBy: currentUser?.uid
        };
        
        await setDoc(doc(collection(db, 'suppliers')), newSupplierData);
        toast.success('เพิ่มซัพพลายเออร์สำเร็จ');
      }

      router.push('/suppliers');
    } catch (error) {
      console.error('Error saving supplier:', error);
      toast.error('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.push('/suppliers');
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
          {isEdit ? 'แก้ไขข้อมูลซัพพลายเออร์' : 'เพิ่มซัพพลายเออร์ใหม่'}
        </h1>
        <p className="text-gray-400">จัดการข้อมูลซัพพลายเออร์และผู้จำหน่ายวัตถุดิบ</p>
      </div>

      {/* Form */}
      <div className="max-w-3xl">
        <div className="card">
          <SupplierForm
            initialData={supplierData || undefined}
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