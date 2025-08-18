// src/app/(protected)/products/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { doc, getDoc, setDoc, updateDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ArrowLeft, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import ProductForm, { ProductFormData } from '@/components/products/ProductForm';
import { Product } from '@/types/production';

export default function ProductFormPage() {
  const router = useRouter();
  const params = useParams();
  const { user: currentUser } = useAuth();
  const productId = params.id as string;
  const isEdit = productId !== 'new';

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(isEdit);
  const [productData, setProductData] = useState<Product | null>(null);

  // Check permission
  useEffect(() => {
    if (currentUser && currentUser.role === 'operation') {
      toast.error('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
      router.push('/dashboard');
    }
  }, [currentUser, router]);

  // Fetch product data if editing
  useEffect(() => {
    if (isEdit) {
      fetchProductData();
    }
  }, [productId]);

  const fetchProductData = async () => {
    try {
      setLoadingData(true);
      const productDoc = await getDoc(doc(db, 'products', productId));
      
      if (!productDoc.exists()) {
        toast.error('ไม่พบข้อมูลผลิตภัณฑ์');
        router.push('/products');
        return;
      }

      const data = productDoc.data();
      setProductData({
        id: productDoc.id,
        name: data.name,
        nameEn: data.nameEn,
        category: data.category,
        rawMaterials: data.rawMaterials || [],
        averageRatios: data.averageRatios,
        imageUrl: data.imageUrl,
        isActive: data.isActive !== false,
        createdAt: data.createdAt?.toDate() || new Date(),
        createdBy: data.createdBy,
        updatedAt: data.updatedAt?.toDate(),
        updatedBy: data.updatedBy
      });
    } catch (error) {
      console.error('Error fetching product:', error);
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      router.push('/products');
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (formData: ProductFormData, imageUrl: string) => {
    setLoading(true);

    try {
      const productData = {
        ...formData,
        imageUrl,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.uid
      };

      if (isEdit) {
        // Update existing
        await updateDoc(doc(db, 'products', productId), productData);
        toast.success('อัพเดทข้อมูลผลิตภัณฑ์สำเร็จ');
      } else {
        // Create new
        const newProductData = {
          ...productData,
          createdAt: serverTimestamp(),
          createdBy: currentUser?.uid
        };
        
        await setDoc(doc(collection(db, 'products')), newProductData);
        toast.success('เพิ่มผลิตภัณฑ์ใหม่สำเร็จ');
      }

      router.push('/products');
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.push('/products');
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
          {isEdit ? 'แก้ไขข้อมูลผลิตภัณฑ์' : 'เพิ่มผลิตภัณฑ์ใหม่'}
        </h1>
        <p className="text-gray-400">กรอกข้อมูลผลิตภัณฑ์และวัตถุดิบที่ใช้</p>
      </div>

      {/* Form */}
      <div className="max-w-3xl">
        <div className="card">
          <ProductForm
            initialData={productData || undefined}
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