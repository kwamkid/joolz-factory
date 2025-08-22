// Path: src/components/suppliers/SupplierForm.tsx
'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Plus, X, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { RawMaterial } from '@/types/raw-material';
import Link from 'next/link';

interface Supplier {
  id?: string;
  name: string;
  contact?: string;
  address?: string;
  lineId?: string;
  email?: string;
  rawMaterials: string[];
  status: 'active' | 'banned';
  rating?: number;
  totalRatings?: number;
  averagePrice?: number;
  lastPurchase?: Date;
}

interface SupplierFormProps {
  initialData?: Partial<Supplier>;
  onSubmit: (data: SupplierFormData) => Promise<void>;
  onCancel: () => void;
  isEdit?: boolean;
  loading?: boolean;
}

export interface SupplierFormData {
  name: string;
  contact?: string;
  address?: string;
  lineId?: string;
  email?: string;
  rawMaterials: string[];
  status: 'active' | 'banned';
}

interface FormData {
  name: string;
  contact: string;
  address: string;
  lineId: string;
  email: string;
  status: 'active' | 'banned';
}

export default function SupplierForm({
  initialData,
  onSubmit,
  onCancel,
  isEdit = false,
  loading = false
}: SupplierFormProps) {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    contact: '',
    address: '',
    lineId: '',
    email: '',
    status: 'active'
  });
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Raw materials from database
  const [availableMaterials, setAvailableMaterials] = useState<RawMaterial[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(true);

  // Initialize form data
  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        contact: initialData.contact || '',
        address: initialData.address || '',
        lineId: initialData.lineId || '',
        email: initialData.email || '',
        status: initialData.status || 'active'
      });
      setSelectedMaterials(initialData.rawMaterials || []);
    }
  }, [initialData]);

  // Load raw materials from database
  useEffect(() => {
    loadRawMaterials();
  }, []);

  const loadRawMaterials = async () => {
    try {
      setLoadingMaterials(true);
      const materialsQuery = query(
        collection(db, 'raw_materials'),
        where('isActive', '==', true),
        orderBy('name', 'asc')
      );
      
      const snapshot = await getDocs(materialsQuery);
      const materials: RawMaterial[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        materials.push({
          id: doc.id,
          name: data.name,
          unit: data.unit || 'kg',
          minStockLevel: data.minStockLevel || 50,  // เพิ่มบรรทัดนี้
          imageUrl: data.imageUrl,
          isActive: data.isActive,
          createdAt: data.createdAt?.toDate() || new Date(),
          createdBy: data.createdBy,
          updatedAt: data.updatedAt?.toDate(),
          updatedBy: data.updatedBy
        });
      });
      
      setAvailableMaterials(materials);
      
      // ถ้ายังไม่มีวัตถุดิบในระบบ ใช้ default ไปก่อน
      if (materials.length === 0) {
        const defaultMaterials = ['ส้ม', 'เลม่อน', 'เก๊กฮวย', 'อัญชัญ', 'น้ำผึ้ง', 'น้ำตาล'];
        setAvailableMaterials(defaultMaterials.map((name, index) => ({
          id: `default-${index}`,
          name,
          unit: 'kg',
          minStockLevel: 50,  // เพิ่มบรรทัดนี้
          isActive: true,
          createdAt: new Date()
        })));
      }
    } catch (error) {
      console.error('Error loading raw materials:', error);
    } finally {
      setLoadingMaterials(false);
    }
  };

  const handleMaterialToggle = (material: string) => {
    setSelectedMaterials(prev => {
      if (prev.includes(material)) {
        return prev.filter(m => m !== material);
      }
      return [...prev, material];
    });
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'กรุณาระบุชื่อซัพพลายเออร์';
    }

    if (!formData.contact && !formData.lineId && !formData.email) {
      newErrors.contact = 'กรุณาระบุช่องทางติดต่ออย่างน้อย 1 ช่องทาง';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'รูปแบบอีเมลไม่ถูกต้อง';
    }

    if (selectedMaterials.length === 0) {
      newErrors.materials = 'กรุณาเลือกวัตถุดิบอย่างน้อย 1 รายการ';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const submitData: SupplierFormData = {
      name: formData.name,
      contact: formData.contact || undefined,
      address: formData.address || undefined,
      lineId: formData.lineId || undefined,
      email: formData.email || undefined,
      rawMaterials: selectedMaterials,
      status: formData.status
    };

    await onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name */}
      <div>
        <label className="label">ชื่อซัพพลายเออร์ *</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
          className={`input ${errors.name ? 'input-error' : ''}`}
          placeholder="ชื่อบริษัทหรือร้านค้า"
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {errors.name}
          </p>
        )}
      </div>

      {/* Contact */}
      <div>
        <label className="label">เบอร์โทรศัพท์</label>
        <input
          type="tel"
          value={formData.contact}
          onChange={(e) => setFormData({...formData, contact: e.target.value})}
          className="input"
          placeholder="081-234-5678"
        />
      </div>

      {/* Address */}
      <div>
        <label className="label">ที่อยู่</label>
        <textarea
          value={formData.address}
          onChange={(e) => setFormData({...formData, address: e.target.value})}
          rows={3}
          className="input resize-none"
          placeholder="ที่อยู่สำหรับติดต่อ"
        />
      </div>

      {/* LINE ID */}
      <div>
        <label className="label">LINE ID</label>
        <input
          type="text"
          value={formData.lineId}
          onChange={(e) => setFormData({...formData, lineId: e.target.value})}
          className="input"
          placeholder="@supplier"
        />
      </div>

      {/* Email */}
      <div>
        <label className="label">อีเมล</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({...formData, email: e.target.value})}
          className={`input ${errors.email ? 'input-error' : ''}`}
          placeholder="email@example.com"
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-400">{errors.email}</p>
        )}
      </div>

      {/* Contact Warning */}
      {errors.contact && (
        <div className="bg-red-900/20 border border-red-900 p-3 rounded-lg">
          <p className="text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {errors.contact}
          </p>
        </div>
      )}

      {/* Raw Materials */}
      <div>
        <label className="label">วัตถุดิบที่จำหน่าย *</label>
        
        {loadingMaterials ? (
          <div className="flex items-center justify-center py-8 bg-gray-800 rounded-lg">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-gray-400">กำลังโหลดวัตถุดิบ...</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
              {availableMaterials.map((material) => (
                <button
                  key={material.id}
                  type="button"
                  onClick={() => handleMaterialToggle(material.name)}
                  className={`p-3 rounded-lg border-2 transition-all flex items-center gap-2 ${
                    selectedMaterials.includes(material.name)
                      ? 'bg-primary text-black border-primary'
                      : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  {material.imageUrl && (
                    <img 
                      src={material.imageUrl} 
                      alt={material.name}
                      className="w-6 h-6 object-cover rounded"
                    />
                  )}
                  <span>{material.name}</span>
                </button>
              ))}
              
              {/* Add New Material Button - Link to Raw Materials Page */}
              <Link
                href="/raw-materials/new"
                target="_blank"
                className="p-3 rounded-lg border-2 border-dashed border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                <span>เพิ่มวัตถุดิบใหม่</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </>
        )}

        {errors.materials && (
          <p className="mt-1 text-sm text-red-400">{errors.materials}</p>
        )}
      </div>

      {/* Performance Info - Only show in edit mode */}
      {isEdit && initialData && (
        <div className="bg-gray-800 rounded-lg p-4 space-y-2">
          <h3 className="font-medium text-white mb-3">ข้อมูลผลการดำเนินงาน</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400">คะแนนเฉลี่ย</p>
              <p className="text-white font-medium">
                {initialData.rating ? `${initialData.rating.toFixed(1)} / 5.0` : 'ยังไม่มีการให้คะแนน'}
              </p>
            </div>
            <div>
              <p className="text-gray-400">จำนวนครั้งที่ให้คะแนน</p>
              <p className="text-white font-medium">
                {initialData.totalRatings || 0} ครั้ง
              </p>
            </div>
            <div>
              <p className="text-gray-400">ราคาเฉลี่ย</p>
              <p className="text-white font-medium">
                {initialData.averagePrice 
                  ? `฿${initialData.averagePrice.toFixed(2)}/kg` 
                  : 'ยังไม่มีข้อมูล'}
              </p>
            </div>
            <div>
              <p className="text-gray-400">ซื้อล่าสุด</p>
              <p className="text-white font-medium">
                {initialData.lastPurchase 
                  ? new Date(initialData.lastPurchase).toLocaleDateString('th-TH')
                  : 'ยังไม่เคยซื้อ'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary flex-1"
        >
          {loading ? 'กำลังบันทึก...' : (isEdit ? 'บันทึกการเปลี่ยนแปลง' : 'เพิ่มซัพพลายเออร์')}
        </button>
        
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="btn btn-ghost"
        >
          ยกเลิก
        </button>
      </div>
    </form>
  );
}