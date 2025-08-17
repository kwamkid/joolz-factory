// Path: src/components/suppliers/SupplierForm.tsx
'use client';

import { useState, useEffect } from 'react';
import { Plus, X, AlertCircle } from 'lucide-react';

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
  availableMaterials?: string[];
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

// แก้ interface FormData ให้ status รองรับทั้ง 'active' และ 'banned'
interface FormData {
  name: string;
  contact: string;
  address: string;
  lineId: string;
  email: string;
  status: 'active' | 'banned';  // แก้ตรงนี้
}

export default function SupplierForm({
  initialData,
  onSubmit,
  onCancel,
  isEdit = false,
  loading = false,
  availableMaterials = ['ส้ม', 'เลม่อน', 'เก๊กฮวย', 'อัญชัญ', 'น้ำผึ้ง', 'น้ำตาล']
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
  const [newMaterial, setNewMaterial] = useState('');
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  const handleMaterialToggle = (material: string) => {
    setSelectedMaterials(prev => {
      if (prev.includes(material)) {
        return prev.filter(m => m !== material);
      }
      return [...prev, material];
    });
  };

  const handleAddNewMaterial = () => {
    if (newMaterial.trim() && !selectedMaterials.includes(newMaterial.trim())) {
      setSelectedMaterials([...selectedMaterials, newMaterial.trim()]);
      setNewMaterial('');
      setShowAddMaterial(false);
    }
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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
          {availableMaterials.map((material) => (
            <button
              key={material}
              type="button"
              onClick={() => handleMaterialToggle(material)}
              className={`p-3 rounded-lg border-2 transition-all ${
                selectedMaterials.includes(material)
                  ? 'bg-primary text-black border-primary'
                  : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-gray-600'
              }`}
            >
              {material}
            </button>
          ))}
          
          {/* Add New Material Button */}
          {!showAddMaterial && (
            <button
              type="button"
              onClick={() => setShowAddMaterial(true)}
              className="p-3 rounded-lg border-2 border-dashed border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              เพิ่มวัตถุดิบใหม่
            </button>
          )}
        </div>

        {/* Add New Material Input */}
        {showAddMaterial && (
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newMaterial}
              onChange={(e) => setNewMaterial(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddNewMaterial())}
              className="input flex-1"
              placeholder="ชื่อวัตถุดิบใหม่"
              autoFocus
            />
            <button
              type="button"
              onClick={handleAddNewMaterial}
              className="btn btn-primary"
            >
              เพิ่ม
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddMaterial(false);
                setNewMaterial('');
              }}
              className="btn btn-ghost"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
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