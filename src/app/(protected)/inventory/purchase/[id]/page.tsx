// src/app/(protected)/inventory/[id]/edit/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ArrowLeft, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import InventoryPurchaseForm, { PurchaseFormData } from '@/components/inventory/InventoryPurchaseForm';
import { InventoryBatch } from '@/types/inventory';

export default function InventoryEditPage() {
  const router = useRouter();
  const params = useParams();
  const { user: currentUser } = useAuth();
  const inventoryId = params.id as string;
  
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [inventoryData, setInventoryData] = useState<InventoryBatch | null>(null);

  // Check permission - only manager and admin can edit
  useEffect(() => {
    if (currentUser && currentUser.role === 'operation') {
      toast.error('คุณไม่มีสิทธิ์แก้ไขข้อมูล');
      router.push('/inventory');
    }
  }, [currentUser, router]);

  // Fetch inventory data
  useEffect(() => {
    fetchInventoryData();
  }, [inventoryId]);

  const fetchInventoryData = async () => {
    try {
      setLoadingData(true);
      const inventoryDoc = await getDoc(doc(db, 'inventory_batches', inventoryId));
      
      if (!inventoryDoc.exists()) {
        toast.error('ไม่พบข้อมูลการซื้อ');
        router.push('/inventory');
        return;
      }

      const data = inventoryDoc.data();
      setInventoryData({
        id: inventoryDoc.id,
        ...data,
        purchaseDate: data.purchaseDate?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date(),
        finishedAt: data.finishedAt?.toDate(),
        expiryDate: data.expiryDate?.toDate()
      } as InventoryBatch);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      router.push('/inventory');
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (formData: PurchaseFormData, invoiceUrl?: string) => {
    try {
      setLoading(true);

      // Calculate new total cost
      const totalCost = formData.quantity * formData.pricePerUnit;

      // Prepare update data
      const updateData: any = {
        quantity: formData.quantity,
        pricePerUnit: formData.pricePerUnit,
        totalCost,
        invoiceNumber: formData.invoiceNumber,
        notes: formData.notes,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.uid || ''
      };

      // Update invoice URL if new one is provided
      if (invoiceUrl) {
        updateData.invoiceUrl = invoiceUrl;
      } else if (formData.invoiceUrl) {
        updateData.invoiceUrl = formData.invoiceUrl;
      }

      // Update Firestore
      await updateDoc(doc(db, 'inventory_batches', inventoryId), updateData);

      // Update supplier average price if price changed
      if (inventoryData && formData.pricePerUnit !== inventoryData.pricePerUnit) {
        // This is simplified - in production, you'd recalculate from all purchases
        await updateDoc(doc(db, 'suppliers', formData.supplierId), {
          averagePrice: formData.pricePerUnit,
          updatedAt: serverTimestamp()
        });
      }

      toast.success('แก้ไขข้อมูลสำเร็จ!');
      router.push('/inventory');
    } catch (error) {
      console.error('Error updating purchase:', error);
      toast.error('เกิดข้อผิดพลาดในการแก้ไข');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.push('/inventory');
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

  if (!inventoryData) {
    return null;
  }

  // Prepare initial data for form
  const initialData: Partial<PurchaseFormData> = {
    materialType: inventoryData.materialType,
    supplierId: inventoryData.supplier.id,
    supplierName: inventoryData.supplier.name,
    quantity: inventoryData.quantity,
    pricePerUnit: inventoryData.pricePerUnit,
    invoiceNumber: inventoryData.invoiceNumber || '',
    notes: inventoryData.notes || '',
    invoiceUrl: inventoryData.invoiceUrl
  };

  return (
    <div className="page-content">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/inventory')}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          กลับ
        </button>
        
        <h1 className="text-2xl font-bold text-white mb-2">แก้ไขข้อมูลการซื้อ</h1>
        <p className="text-gray-400">Batch ID: {inventoryData.batchId}</p>
      </div>

      {/* Warning for finished batch */}
      {inventoryData.isFinished && (
        <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-600 rounded-lg">
          <p className="text-yellow-400 text-sm">
            ⚠️ วัตถุดิบนี้ถูกใช้หมดแล้ว การแก้ไขจะมีผลกับข้อมูลในอดีตเท่านั้น
          </p>
        </div>
      )}

      {/* Form */}
      <div className="max-w-2xl mx-auto">
        <div className="card">
          <InventoryPurchaseForm
            initialData={initialData}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isEdit={true}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
}