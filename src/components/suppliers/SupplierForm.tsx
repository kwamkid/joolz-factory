// src/components/suppliers/SupplierForm.tsx
'use client';

import { useState, useEffect } from 'react';
import { 
  Save, Loader2, Users, Phone, MapPin, 
  MessageCircle, Mail, Package, X, Plus
} from 'lucide-react';
import { Supplier } from '@/types/supplier';

interface SupplierFormProps {
  initialData?: Partial<Supplier>;
  onSubmit: (data: SupplierFormData) => Promise<void>;
  onCancel: () => void;
  isEdit?: boolean;
  loading?: boolean;
  availableMaterials?: string[]; // รายการวัตถุดิบที่มีในระบบ
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

export default function SupplierForm({
  initialData,
  onSubmit,
  onCancel,
  isEdit = false,
  loading = false,
  availableMaterials = ['ส้ม', 'เลม่อน', 'เก๊กฮวย', 'อัญชัญ', 'น้ำผึ้ง', 'น้ำตาล']
}: SupplierFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    address: '',
    lineId: '',
    email: '',
    status: 'active' as const
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

    const supplierData: SupplierFormData = {
      name: formData.name.trim(),
      contact: formData.contact.trim() || undefined,
      address: formData.address.trim() || undefined,
      lineId: formData.lineId.trim() || undefined,
      email: formData.email.trim() || undefined,
      rawMaterials: selectedMaterials,
      status: formData.status
    };

    await onSubmit(supplierData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-6">
        {/* Basic Information */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">ข้อมูลพื้นฐาน</h3>
          
          {/* Name */}
          <div className="mb-4">
            <label className="label">ชื่อซัพพลายเออร์ *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className={`input ${errors.name ? 'input-error' : ''}`}
              placeholder="บริษัท สวนส้มภูเก็ต จำกัด"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-400">{errors.name}</p>
            )}
          </div>

          {/* Address */}
          <div>
            <label className="label">ที่อยู่</label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              className="input min-h-[80px]"
              placeholder="123 หมู่ 5 ต.ป่าตอง อ.กะทู้ จ.ภูเก็ต"
            />
          </div>
        </div>

        {/* Contact Information */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">ช่องทางติดต่อ</h3>
          {errors.contact && (
            <p className="mb-3 text-sm text-red-400">{errors.contact}</p>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Phone */}
            <div>
              <label className="label">
                <Phone className="inline h-4 w-4 mr-1" />
                เบอร์โทรศัพท์
              </label>
              <input
                type="text"
                value={formData.contact}
                onChange={(e) => setFormData({...formData, contact: e.target.value})}
                className="input"
                placeholder="081-234-5678"
              />
            </div>

            {/* LINE ID */}
            <div>
              <label className="label">
                <MessageCircle className="inline h-4 w-4 mr-1" />
                LINE ID
              </label>
              <input
                type="text"
                value={formData.lineId}
                onChange={(e) => setFormData({...formData, lineId: e.target.value})}
                className="input"
                placeholder="@orangefarm"
              />
            </div>

            {/* Email */}
            <div>
              <label className="label">
                <Mail className="inline h-4 w-4 mr-1" />
                อีเมล
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className={`input ${errors.email ? 'input-error' : ''}`}
                placeholder="contact@orangefarm.com"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-400">{errors.email}</p>
              )}
            </div>

            {/* Status (Edit only) */}
            {isEdit && (
              <div>
                <label className="label">สถานะ</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                  className="input"
                >
                  <option value="active">ใช้งาน</option>
                  <option value="banned">ระงับ</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Raw Materials */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">
            <Package className="inline h-5 w-5 mr-2" />
            วัตถุดิบที่จำหน่าย *
          </h3>
          {errors.materials && (
            <p className="mb-3 text-sm text-red-400">{errors.materials}</p>
          )}
          
          <div className="space-y-3">
            {/* Available Materials */}
            <div className="flex flex-wrap gap-2">
              {availableMaterials.map(material => (
                <button
                  key={material}
                  type="button"
                  onClick={() => handleMaterialToggle(material)}
                  className={`px-4 py-2 rounded-lg border-2 transition-all ${
                    selectedMaterials.includes(material)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-gray-700 hover:border-gray-600 text-gray-400'
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
                  className="px-4 py-2 rounded-lg border-2 border-dashed border-gray-700 hover:border-gray-600 text-gray-400 transition-all"
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Add New Material Input */}
            {showAddMaterial && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMaterial}
                  onChange={(e) => setNewMaterial(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddNewMaterial()}
                  className="input flex-1"
                  placeholder="ชื่อวัตถุดิบใหม่..."
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleAddNewMaterial}
                  disabled={!newMaterial.trim()}
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

            {/* Selected Materials Display */}
            {selectedMaterials.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-2">วัตถุดิบที่เลือก:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedMaterials.map(material => (
                    <span key={material} className="px-3 py-1 bg-primary/20 text-primary text-sm rounded-full">
                      {material}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Performance Info (Edit only) */}
        {isEdit && initialData && (
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">ข้อมูลผลการดำเนินงาน</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-gray-400">คะแนนเฉลี่ย</p>
                <p className="text-xl font-semibold text-white">
                  {initialData.rating?.toFixed(1) || '-'} / 5
                </p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-gray-400">จำนวนรีวิว</p>
                <p className="text-xl font-semibold text-white">
                  {initialData.totalRatings || 0}
                </p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-gray-400">ราคาเฉลี่ย</p>
                <p className="text-xl font-semibold text-white">
                  ฿{initialData.averagePrice?.toFixed(0) || 0}/kg
                </p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-gray-400">ซื้อแล้ว</p>
                <p className="text-xl font-semibold text-white">
                  {initialData.totalPurchases || 0} ครั้ง
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-8 pt-6 border-t border-gray-700">
        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary flex-1"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              กำลังบันทึก...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              {isEdit ? 'บันทึกการเปลี่ยนแปลง' : 'เพิ่มซัพพลายเออร์'}
            </>
          )}
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