// src/app/(protected)/production/planning/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { doc, getDoc, setDoc, updateDoc, collection, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ArrowLeft, Loader2, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import PlanningForm, { PlanningFormData } from '@/components/production/PlanningForm';

export default function PlanningFormPage() {
  const router = useRouter();
  const params = useParams();
  const { user: currentUser } = useAuth();
  const planId = params.id as string;
  const isEdit = planId !== 'new';

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(isEdit);
  const [planData, setPlanData] = useState<any>(null);

  // Check permission
  useEffect(() => {
    if (currentUser && currentUser.role === 'operation') {
      toast.error('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
      router.push('/dashboard');
    }
  }, [currentUser, router]);

  // Fetch plan data if editing
  useEffect(() => {
    if (isEdit) {
      fetchPlanData();
    }
  }, [planId]);

  const fetchPlanData = async () => {
    try {
      setLoadingData(true);
      const planDoc = await getDoc(doc(db, 'production_batches', planId));
      
      if (!planDoc.exists()) {
        toast.error('ไม่พบข้อมูลแผนการผลิต');
        router.push('/production');
        return;
      }

      const data = planDoc.data();
      
      // Check if plan is already started
      if (data.status !== 'planned') {
        toast.error('ไม่สามารถแก้ไขแผนที่เริ่มผลิตแล้ว');
        router.push('/production');
        return;
      }

      setPlanData({
        batchId: data.batchId,
        productId: data.productId,
        productName: data.productName,
        productionDate: data.productionDate,
        plannedBottles: data.plannedBottles,
        totalJuiceNeeded: data.totalJuiceNeeded,
        materialRequirements: data.materialRequirements,
        notes: data.notes
      });
    } catch (error) {
      console.error('Error fetching plan:', error);
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      router.push('/production');
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (formData: PlanningFormData) => {
    setLoading(true);

    try {
      // Calculate bottle cost
      let bottleCost = 0;
      // TODO: Calculate bottle cost from bottle types

      const planData = {
        ...formData,
        status: 'planned',
        
        // Cost estimation (admin only)
        ...(currentUser?.role === 'admin' && {
          materialCost: Object.values(formData.materialRequirements)
            .reduce((sum, req) => sum + (req.estimatedCost || 0), 0),
          bottleCost: bottleCost,
          totalCost: Object.values(formData.materialRequirements)
            .reduce((sum, req) => sum + (req.estimatedCost || 0), 0) + bottleCost
        }),
        
        // Metadata
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.uid || ''
      };

      if (isEdit) {
        // Update existing
        await updateDoc(doc(db, 'production_batches', planId), planData);
        toast.success('อัพเดทแผนการผลิตสำเร็จ');
      } else {
        // Create new
        const newPlanData = {
          ...planData,
          plannedBy: currentUser?.uid || '',
          plannedByName: currentUser?.name || '',
          plannedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          createdBy: currentUser?.uid
        };
        
        await addDoc(collection(db, 'production_batches'), newPlanData);
        toast.success(`สร้าง Batch ${formData.batchId} สำเร็จ!`);
        
        // TODO: Generate and print labels
        handlePrintLabels();
      }

      router.push('/production');
    } catch (error) {
      console.error('Error saving plan:', error);
      toast.error('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handlePrintLabels = () => {
    // TODO: Implement label printing
    toast.success('กำลังพิมพ์ label...');
  };

  const handleCancel = () => {
    router.push('/production');
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
          onClick={() => router.push('/production')}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          กลับ
        </button>
        
        <h1 className="text-2xl font-bold text-white mb-2">
          {isEdit ? 'แก้ไขแผนการผลิต' : 'สร้างแผนการผลิต'}
        </h1>
        <p className="text-gray-400">
          {isEdit ? 'แก้ไขข้อมูลแผนการผลิต' : 'สร้าง Batch ID และคำนวณวัตถุดิบที่ต้องใช้'}
        </p>
      </div>

      {/* Form */}
      <PlanningForm
        initialData={planData}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isEdit={isEdit}
        loading={loading}
      />
    </div>
  );
}