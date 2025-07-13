// src/components/suppliers/SupplierForm.tsx
'use client';

import { useState } from 'react';
import { X, Save } from 'lucide-react';
import StarRating from '@/components/ui/StarRating';
import { addDoc, collection, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { Supplier } from '@/types';
import toast from 'react-hot-toast';

interface SupplierFormProps {
  supplier?: Supplier | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SupplierForm({ supplier, onClose, onSuccess }: SupplierFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: supplier?.name || '',
    contact: supplier?.contact || '',
    address: supplier?.address || '',
    lineId: supplier?.lineId || '',
    email: supplier?.email || '',
    rating: supplier?.rating || 5,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'กรุณากรอกชื่อซัพพลายเออร์';
    }

    if (!formData.contact.trim()) {
      newErrors.contact = 'กรุณากรอกเบอร์โทรศัพท์';
    } else if (!/^[0-9-+\s()]+$/.test(formData.contact)) {
      newErrors.contact = 'รูปแบบเบอร์โทรไม่ถูกต้อง';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'รูปแบบอีเมลไม่ถูกต้อง';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // หากยังมี error อีก ใช้วิธีนี้แทน (Type-safe approach)

// แทนที่ส่วน handleSubmit ใน SupplierForm.tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  if (!validateForm()) return;
  if (!user) return;

  setLoading(true);
  
  try {
    // สร้าง base data
    const baseData = {
      name: formData.name.trim(),
      contact: formData.contact.trim(),
      rating: formData.rating,
      totalRatings: supplier?.totalRatings || 0,
      averagePrice: supplier?.averagePrice || 0,
      status: supplier?.status || 'active',
      isActive: true,
    };

    // เพิ่ม optional fields เฉพาะที่มีค่า
    const supplierData: any = { ...baseData };
    
    if (formData.address.trim()) {
      supplierData.address = formData.address.trim();
    }
    
    if (formData.lineId.trim()) {
      supplierData.lineId = formData.lineId.trim();
    }
    
    if (formData.email.trim()) {
      supplierData.email = formData.email.trim();
    }
    
    // เพิ่ม metadata สำหรับ supplier ใหม่
    if (!supplier) {
      supplierData.createdBy = user.id;
      supplierData.createdAt = new Date();
    }

    if (supplier) {
      // แก้ไขซัพพลายเออร์
      await updateDoc(doc(db, 'suppliers', supplier.id), {
        ...supplierData,
        updatedAt: new Date(),
      });
      toast.success('แก้ไขซัพพลายเออร์สำเร็จ!');
    } else {
      // เพิ่มซัพพลายเออร์ใหม่
      await addDoc(collection(db, 'suppliers'), supplierData);
      toast.success('เพิ่มซัพพลายเออร์สำเร็จ!');
    }

    onSuccess();
    onClose();
  } catch (error) {
    console.error('Error saving supplier:', error);
    toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่');
  } finally {
    setLoading(false);
  }
};

  const StarRatingInput = () => {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-white">
          คะแนนเริ่มต้น
        </label>
        <div className="flex justify-center">
          <StarRating
            rating={formData.rating}
            onRatingChange={(rating) => setFormData({ ...formData, rating })}
            readOnly={false}
            size="lg"
            showValue={true}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">
            {supplier ? 'แก้ไขซัพพลายเออร์' : 'เพิ่มซัพพลายเออร์ใหม่'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ชื่อซัพพลายเออร์ */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              ชื่อซัพพลายเออร์ *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`w-full px-4 py-3 bg-gray-700 border rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-yellow-500 transition-colors ${
                errors.name ? 'border-red-500' : 'border-gray-600'
              }`}
              placeholder="เช่น บริษัท ส้มสดภูเก็ต จำกัด"
            />
            {errors.name && (
              <p className="text-red-400 text-sm mt-1">{errors.name}</p>
            )}
          </div>

          {/* เบอร์โทร */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              เบอร์โทรศัพท์ *
            </label>
            <input
              type="tel"
              value={formData.contact}
              onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
              className={`w-full px-4 py-3 bg-gray-700 border rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-yellow-500 transition-colors ${
                errors.contact ? 'border-red-500' : 'border-gray-600'
              }`}
              placeholder="081-234-5678"
            />
            {errors.contact && (
              <p className="text-red-400 text-sm mt-1">{errors.contact}</p>
            )}
          </div>

          {/* ที่อยู่ */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              ที่อยู่
            </label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-yellow-500 transition-colors resize-none"
              placeholder="ที่อยู่ของซัพพลายเออร์"
            />
          </div>

          {/* LINE ID */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              LINE ID
            </label>
            <input
              type="text"
              value={formData.lineId}
              onChange={(e) => setFormData({ ...formData, lineId: e.target.value })}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-yellow-500 transition-colors"
              placeholder="line_id_ของซัพพลายเออร์"
            />
          </div>

          {/* อีเมล */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              อีเมล
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={`w-full px-4 py-3 bg-gray-700 border rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-yellow-500 transition-colors ${
                errors.email ? 'border-red-500' : 'border-gray-600'
              }`}
              placeholder="email@example.com"
            />
            {errors.email && (
              <p className="text-red-400 text-sm mt-1">{errors.email}</p>
            )}
          </div>

          {/* คะแนนเริ่มต้น */}
          <StarRatingInput />

          {/* Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl transition-colors font-medium"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-black py-3 rounded-xl transition-colors font-semibold flex items-center justify-center space-x-2"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-black border-t-transparent"></div>
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  <span>{supplier ? 'บันทึก' : 'เพิ่ม'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}