// src/app/(protected)/inventory/purchase/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { 
  collection, addDoc, doc, updateDoc, getDoc, getDocs, query, where, serverTimestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import InventoryPurchaseForm, { PurchaseFormData } from '@/components/inventory/InventoryPurchaseForm';

export default function InventoryPurchasePage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(false);

  // Check permission
  useEffect(() => {
    if (currentUser && currentUser.role === 'operation') {
      toast.error('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
      router.push('/dashboard');
    }
  }, [currentUser, router]);

  const handleSubmit = async (formData: PurchaseFormData, invoiceUrl?: string) => {
    try {
      setLoading(true);

      // Get supplier data
      const supplierDoc = await getDoc(doc(db, 'suppliers', formData.supplierId));
      const supplierData = supplierDoc.data();

      // Generate Batch ID
      const date = new Date();
      const dateStr = date.toISOString().slice(2, 10).replace(/-/g, '');
      const sequence = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      const batchId = `INV${dateStr}${sequence}`;

      // Create inventory batch
      const inventoryData: any = {
        batchId,
        materialType: formData.materialType,
        supplier: {
          id: formData.supplierId,
          name: supplierData?.name || formData.supplierName || '',
          rating: supplierData?.rating || 0
        },
        purchaseDate: serverTimestamp(),
        quantity: formData.quantity,
        remainingQuantity: formData.quantity,
        pricePerUnit: formData.pricePerUnit,
        totalCost: formData.quantity * formData.pricePerUnit,
        invoiceNumber: formData.invoiceNumber || '',
        notes: formData.notes || '',
        status: 'active',
        isFinished: false,
        createdBy: currentUser?.uid || '',
        createdByName: currentUser?.name || '',
        createdAt: serverTimestamp()
      };

      // Only add invoiceUrl if it exists
      if (invoiceUrl || formData.invoiceUrl) {
        inventoryData.invoiceUrl = invoiceUrl || formData.invoiceUrl;
      }

      await addDoc(collection(db, 'inventory_batches'), inventoryData);

      // Calculate new average price for the supplier
      // Get all purchases for this supplier and material
      const purchasesQuery = query(
        collection(db, 'inventory_batches'),
        where('supplier.id', '==', formData.supplierId),
        where('materialType', '==', formData.materialType)
      );
      
      const purchasesSnapshot = await getDocs(purchasesQuery);
      
      let totalQuantity = formData.quantity;
      let totalAmount = formData.quantity * formData.pricePerUnit;
      
      purchasesSnapshot.forEach((doc) => {
        const data = doc.data();
        totalQuantity += data.quantity || 0;
        totalAmount += data.totalCost || 0;
      });
      
      // Calculate average price per unit
      const newAveragePrice = totalAmount / totalQuantity;
      
      // Update supplier statistics
      const newTotalPurchases = (supplierData?.totalPurchases || 0) + 1;
      const newTotalAmount = (supplierData?.totalAmount || 0) + inventoryData.totalCost;

      await updateDoc(doc(db, 'suppliers', formData.supplierId), {
        totalPurchases: newTotalPurchases,
        totalAmount: newTotalAmount,
        averagePrice: newAveragePrice,
        lastPurchase: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      toast.success('บันทึกการซื้อสำเร็จ!');
      router.push('/inventory');
    } catch (error) {
      console.error('Error saving purchase:', error);
      toast.error('เกิดข้อผิดพลาดในการบันทึก');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.push('/inventory');
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
        
        <h1 className="text-2xl font-bold text-white mb-2">บันทึกการซื้อวัตถุดิบ</h1>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto">
        <div className="card">
          <InventoryPurchaseForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
}