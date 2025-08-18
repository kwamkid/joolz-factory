// src/components/products/ProductForm.tsx
'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Camera, X, Loader2, AlertCircle, Plus } from 'lucide-react';
import { uploadImage, deleteImage, validateImageFile } from '@/utils/image-upload';
import toast from 'react-hot-toast';
import { RawMaterial } from '@/types/raw-material';

interface ProductFormProps {
  initialData?: {
    name: string;
    nameEn: string;
    category?: string;
    rawMaterials: string[];
    imageUrl?: string;
    isActive: boolean;
  };
  onSubmit: (data: ProductFormData, imageUrl: string) => Promise<void>;
  onCancel: () => void;
  isEdit?: boolean;
  loading?: boolean;
}

export interface ProductFormData {
  name: string;
  nameEn: string;
  category?: string;
  rawMaterials: string[];
  isActive: boolean;
}

export default function ProductForm({
  initialData,
  onSubmit,
  onCancel,
  isEdit = false,
  loading = false
}: ProductFormProps) {
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string>('');
  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    category: '',
    isActive: true
  });
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [availableMaterials, setAvailableMaterials] = useState<RawMaterial[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Categories
  const categories = ['น้ำผลไม้', 'น้ำสมุนไพร', 'น้ำผสม', 'อื่นๆ'];

  // Initialize form data
  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        nameEn: initialData.nameEn || '',
        category: initialData.category || '',
        isActive: initialData.isActive !== false
      });
      setSelectedMaterials(initialData.rawMaterials || []);

      if (initialData.imageUrl) {
        setExistingImageUrl(initialData.imageUrl);
        setImagePreview(initialData.imageUrl);
      }
    }
  }, [initialData]);

  // Load raw materials
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
          imageUrl: data.imageUrl,
          isActive: data.isActive,
          createdAt: data.createdAt?.toDate() || new Date(),
          createdBy: data.createdBy,
          updatedAt: data.updatedAt?.toDate(),
          updatedBy: data.updatedBy
        });
      });
      
      setAvailableMaterials(materials);
    } catch (error) {
      console.error('Error loading raw materials:', error);
    } finally {
      setLoadingMaterials(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setErrors({ ...errors, image: validation.error || 'ไฟล์ไม่ถูกต้อง' });
      return;
    }

    setSelectedFile(file);
    setErrors({ ...errors, image: '' });
    
    // Preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setSelectedFile(null);
    setImagePreview('');
    setErrors({ ...errors, image: '' });
    
    // Clear file input
    const fileInput = document.getElementById('product-image-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
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
      newErrors.name = 'กรุณาระบุชื่อผลิตภัณฑ์';
    }

    if (!formData.nameEn.trim()) {
      newErrors.nameEn = 'กรุณาระบุชื่อภาษาอังกฤษ';
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

    try {
      let imageUrl = existingImageUrl;

      // Upload new image if selected
      if (selectedFile) {
        setUploadingImage(true);
        
        // Delete old image if exists
        if (existingImageUrl) {
          await deleteImage(existingImageUrl);
        }

        // Upload new image
        imageUrl = await uploadImage(selectedFile, {
          folder: 'products',
          maxWidth: 800,
          maxHeight: 800,
          quality: 0.85
        });
        
        setUploadingImage(false);
      }

      const productData: ProductFormData = {
        name: formData.name.trim(),
        nameEn: formData.nameEn.trim(),
        category: formData.category || undefined,
        rawMaterials: selectedMaterials,
        isActive: formData.isActive
      };

      await onSubmit(productData, imageUrl);
    } catch (error) {
      console.error('Error in form submit:', error);
      setUploadingImage(false);
    }
  };

  const isLoading = loading || uploadingImage;

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="label">ชื่อผลิตภัณฑ์ (ไทย) *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className={`input ${errors.name ? 'input-error' : ''}`}
              placeholder="เช่น น้ำส้มคั้น"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-400">{errors.name}</p>
            )}
          </div>

          {/* Name English */}
          <div>
            <label className="label">ชื่อผลิตภัณฑ์ (อังกฤษ) *</label>
            <input
              type="text"
              value={formData.nameEn}
              onChange={(e) => setFormData({...formData, nameEn: e.target.value})}
              className={`input ${errors.nameEn ? 'input-error' : ''}`}
              placeholder="เช่น Orange Juice"
            />
            {errors.nameEn && (
              <p className="mt-1 text-sm text-red-400">{errors.nameEn}</p>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="label">หมวดหมู่</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
              className="input"
            >
              <option value="">ไม่ระบุ</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Active Status */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                className="w-5 h-5 rounded border-gray-600 text-primary focus:ring-primary"
              />
              <span className="text-white">เปิดใช้งาน</span>
            </label>
            <p className="mt-1 text-xs text-gray-500">
              ปิดใช้งานจะไม่แสดงในหน้าวางแผนการผลิต
            </p>
          </div>
        </div>

        {/* Right Column - Image */}
        <div>
          <label className="label">รูปผลิตภัณฑ์</label>
          
          {/* Image Preview */}
          <div className="bg-gray-800 rounded-lg p-4 mb-4 text-center">
            {imagePreview ? (
              <div className="relative inline-block">
                <img 
                  src={imagePreview}
                  alt="Product preview"
                  className="h-48 w-48 object-cover rounded-lg mx-auto"
                />
                {!isLoading && (
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute -top-2 -right-2 p-1 bg-red-600 rounded-full hover:bg-red-700 transition-colors"
                  >
                    <X className="h-4 w-4 text-white" />
                  </button>
                )}
              </div>
            ) : (
              <div className="py-8">
                <Camera className="h-24 w-24 text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500">ยังไม่มีรูป</p>
              </div>
            )}
          </div>

          {/* Upload Button */}
          <div>
            <input
              id="product-image-upload"
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleImageSelect}
              className="hidden"
              disabled={isLoading}
            />
            <label
              htmlFor="product-image-upload"
              className={`btn btn-secondary w-full ${isLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
            >
              <Camera className="h-4 w-4" />
              {imagePreview ? 'เปลี่ยนรูป' : 'อัพโหลดรูป'}
            </label>
            <p className="mt-2 text-xs text-gray-500 text-center">
              รองรับ JPG, PNG, WebP ขนาดไม่เกิน 10MB
            </p>
            
            {errors.image && (
              <div className="mt-2 p-2 bg-red-900/20 border border-red-600 rounded">
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.image}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Raw Materials */}
      <div className="mt-6">
        <label className="label">วัตถุดิบที่ใช้ *</label>
        
        {loadingMaterials ? (
          <div className="flex items-center justify-center py-8 bg-gray-800 rounded-lg">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-gray-400">กำลังโหลดวัตถุดิบ...</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
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
            </div>
            
            <p className="text-xs text-gray-500">
              เลือกวัตถุดิบที่ใช้ในการผลิต (สามารถเลือกได้หลายรายการ)
            </p>
          </>
        )}

        {errors.materials && (
          <p className="mt-1 text-sm text-red-400">{errors.materials}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-8 pt-6 border-t border-gray-700">
        <button
          type="submit"
          disabled={isLoading}
          className="btn btn-primary flex-1"
        >
          {isLoading ? (
            uploadingImage ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                กำลังอัพโหลดรูป...
              </>
            ) : (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                กำลังบันทึก...
              </>
            )
          ) : (
            isEdit ? 'บันทึกการเปลี่ยนแปลง' : 'เพิ่มผลิตภัณฑ์'
          )}
        </button>
        
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="btn btn-ghost"
        >
          ยกเลิก
        </button>
      </div>
    </form>
  );
}