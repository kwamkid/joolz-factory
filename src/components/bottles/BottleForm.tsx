// src/components/bottles/BottleForm.tsx
'use client';

import { useState, useEffect } from 'react';
import { 
  Save, Loader2, FlaskConical, 
  Upload, X, AlertCircle
} from 'lucide-react';
import { uploadImage, deleteImage, validateImageFile } from '@/utils/image-upload';
import { BottleType } from '@/types/bottle';

interface BottleFormProps {
  initialData?: Partial<BottleType>;
  onSubmit: (data: BottleFormData, imageUrl: string) => Promise<void>;
  onCancel: () => void;
  isEdit?: boolean;
  loading?: boolean;
}

export interface BottleFormData {
  name: string;
  sizeInMl: number;
  pricePerUnit: number;
  minStockLevel: number;
  currentStock: number;
  isActive: boolean;
}

export default function BottleForm({
  initialData,
  onSubmit,
  onCancel,
  isEdit = false,
  loading = false
}: BottleFormProps) {
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string>('');
  const [formData, setFormData] = useState({
    name: '',
    sizeInMl: '',
    pricePerUnit: '',
    minStockLevel: '',
    currentStock: '0',
    isActive: true
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form data
  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        sizeInMl: initialData.sizeInMl?.toString() || '',
        pricePerUnit: initialData.pricePerUnit?.toString() || '',
        minStockLevel: (initialData.minStockLevel || 0).toString(),
        currentStock: (initialData.currentStock || 0).toString(),
        isActive: initialData.isActive !== false
      });

      if (initialData.imageUrl) {
        setExistingImageUrl(initialData.imageUrl);
        setImagePreview(initialData.imageUrl);
      }
    }
  }, [initialData]);

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
    const fileInput = document.getElementById('bottle-image-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'กรุณาระบุชื่อขนาดขวด';
    }

    if (!formData.sizeInMl) {
      newErrors.sizeInMl = 'กรุณาระบุขนาด';
    } else if (Number(formData.sizeInMl) <= 0) {
      newErrors.sizeInMl = 'ขนาดต้องมากกว่า 0';
    }

    if (!formData.pricePerUnit) {
      newErrors.pricePerUnit = 'กรุณาระบุราคา';
    } else if (Number(formData.pricePerUnit) < 0) {
      newErrors.pricePerUnit = 'ราคาต้องไม่ติดลบ';
    }

    if (!formData.minStockLevel) {
      newErrors.minStockLevel = 'กรุณาระบุจำนวนขั้นต่ำ';
    } else if (Number(formData.minStockLevel) < 0) {
      newErrors.minStockLevel = 'จำนวนต้องไม่ติดลบ';
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
          folder: 'bottles',
          maxWidth: 600,
          maxHeight: 600,
          quality: 0.85
        });
        
        setUploadingImage(false);
      }

      const bottleData: BottleFormData = {
        name: formData.name.trim(),
        sizeInMl: Number(formData.sizeInMl),
        pricePerUnit: Number(formData.pricePerUnit),
        minStockLevel: Number(formData.minStockLevel),
        currentStock: isEdit ? Number(formData.currentStock) : 0,
        isActive: formData.isActive
      };

      await onSubmit(bottleData, imageUrl);
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
            <label className="label">ชื่อขนาดขวด *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className={`input ${errors.name ? 'input-error' : ''}`}
              placeholder="เช่น 250ml, 350ml, 1L"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-400">{errors.name}</p>
            )}
          </div>

          {/* Size */}
          <div>
            <label className="label">ขนาด (ml) *</label>
            <input
              type="number"
              value={formData.sizeInMl}
              onChange={(e) => setFormData({...formData, sizeInMl: e.target.value})}
              className={`input ${errors.sizeInMl ? 'input-error' : ''}`}
              placeholder="250"
            />
            {errors.sizeInMl && (
              <p className="mt-1 text-sm text-red-400">{errors.sizeInMl}</p>
            )}
          </div>

          {/* Price */}
          <div>
            <label className="label">ราคาต่อขวด (บาท) *</label>
            <input
              type="number"
              step="0.01"
              value={formData.pricePerUnit}
              onChange={(e) => setFormData({...formData, pricePerUnit: e.target.value})}
              className={`input ${errors.pricePerUnit ? 'input-error' : ''}`}
              placeholder="5.50"
            />
            {errors.pricePerUnit && (
              <p className="mt-1 text-sm text-red-400">{errors.pricePerUnit}</p>
            )}
          </div>

          {/* Min Stock */}
          <div>
            <label className="label">จำนวนขั้นต่ำในสต็อก *</label>
            <input
              type="number"
              value={formData.minStockLevel}
              onChange={(e) => setFormData({...formData, minStockLevel: e.target.value})}
              className={`input ${errors.minStockLevel ? 'input-error' : ''}`}
              placeholder="500"
            />
            {errors.minStockLevel && (
              <p className="mt-1 text-sm text-red-400">{errors.minStockLevel}</p>
            )}
          </div>

          {/* Current Stock (Edit only) */}
          {isEdit && (
            <div>
              <label className="label">จำนวนคงเหลือปัจจุบัน</label>
              <input
                type="number"
                value={formData.currentStock}
                className="input bg-gray-800 cursor-not-allowed"
                disabled
              />
              <p className="mt-1 text-xs text-gray-500">
                * จัดการสต็อกได้ที่หน้าจัดการสต็อก
              </p>
            </div>
          )}

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
          </div>
        </div>

        {/* Right Column - Image */}
        <div>
          <label className="label">รูปขวด</label>
          
          {/* Image Preview */}
          <div className="bg-gray-800 rounded-lg p-4 mb-4 text-center">
            {imagePreview ? (
              <div className="relative inline-block">
                <img 
                  src={imagePreview}
                  alt="Bottle preview"
                  className="h-48 object-contain mx-auto"
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
                <FlaskConical className="h-24 w-24 text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500">ยังไม่มีรูป</p>
              </div>
            )}
          </div>

          {/* Upload Button */}
          <div>
            <input
              id="bottle-image-upload"
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleImageSelect}
              className="hidden"
              disabled={isLoading}
            />
            <label
              htmlFor="bottle-image-upload"
              className={`btn btn-secondary w-full ${isLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
            >
              <Upload className="h-4 w-4" />
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
            <>
              <Save className="h-4 w-4" />
              {isEdit ? 'บันทึกการเปลี่ยนแปลง' : 'เพิ่มขวดใหม่'}
            </>
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