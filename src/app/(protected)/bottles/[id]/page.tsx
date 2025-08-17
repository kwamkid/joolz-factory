// src/app/(protected)/bottles/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { doc, getDoc, setDoc, updateDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ArrowLeft, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import BottleForm, { BottleFormData } from '@/components/bottles/BottleForm';
import { BottleType } from '@/types/bottle';

export default function BottleFormPage() {
  const router = useRouter();
  const params = useParams();
  const { user: currentUser } = useAuth();
  const bottleId = params.id as string;
  const isEdit = bottleId !== 'new';

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(isEdit);
  const [bottleData, setBottleData] = useState<BottleType | null>(null);

  // Check permission
  useEffect(() => {
    if (currentUser && currentUser.role === 'operation') {
      toast.error('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
      router.push('/dashboard');
    }
  }, [currentUser, router]);

  // Fetch bottle data if editing
  useEffect(() => {
    if (isEdit) {
      fetchBottleData();
    }
  }, [bottleId]);

  const fetchBottleData = async () => {
    try {
      setLoadingData(true);
      const bottleDoc = await getDoc(doc(db, 'bottles', bottleId));
      
      if (!bottleDoc.exists()) {
        toast.error('ไม่พบข้อมูลขวด');
        router.push('/bottles');
        return;
      }

      setBottleData({ id: bottleDoc.id, ...bottleDoc.data() } as BottleType);
    } catch (error) {
      console.error('Error fetching bottle:', error);
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      router.push('/bottles');
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (formData: BottleFormData, imageUrl: string) => {
    setLoading(true);

    try {
      const bottleData = {
        ...formData,
        imageUrl,
        updatedAt: new Date(),
        updatedBy: currentUser?.uid
      };

      if (isEdit) {
        // Update existing
        await updateDoc(doc(db, 'bottles', bottleId), bottleData);
        toast.success('อัพเดทข้อมูลขวดสำเร็จ');
      } else {
        // Create new
        const newBottleData = {
          ...bottleData,
          currentStock: 0,
          createdAt: new Date(),
          createdBy: currentUser?.uid
        };
        
        await setDoc(doc(collection(db, 'bottles')), newBottleData);
        toast.success('เพิ่มขวดใหม่สำเร็จ');
      }

      router.push('/bottles');
    } catch (error) {
      console.error('Error saving bottle:', error);
      toast.error('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.push('/bottles');
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
          {isEdit ? 'แก้ไขข้อมูลขวด' : 'เพิ่มขวดใหม่'}
        </h1>
        <p className="text-gray-400">กรอกข้อมูลขวดและราคา</p>
      </div>

      {/* Form */}
      <div className="max-w-2xl">
        <div className="card">
          <BottleForm
            initialData={bottleData || undefined}
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