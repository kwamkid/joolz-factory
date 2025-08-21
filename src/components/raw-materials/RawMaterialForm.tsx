// Path: src/components/raw-materials/RawMaterialForm.tsx
'use client';

import { useState, useEffect } from 'react';
import { Camera, X, Loader2, AlertCircle } from 'lucide-react';
import { uploadImage, deleteImage, validateImageFile } from '@/utils/image-upload';
import toast from 'react-hot-toast';

interface RawMaterialFormProps {
  initialData?: {
    name: string;
    unit: string;
    minStockLevel: number;
    imageUrl?: string;
    isActive: boolean;
  };
  onSubmit: (data: RawMaterialFormData, imageUrl: string) => Promise<void>;
  onCancel: () => void;
  isEdit?: boolean;
  loading?: boolean;
}

export interface RawMaterialFormData {
  name: string;
  unit: string;
  minStockLevel: number;
  isActive: boolean;
}

export default function RawMaterialForm({
  initialData,
  onSubmit,
  onCancel,
  isEdit = false,
  loading = false
}: RawMaterialFormProps) {
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string>('');
  const [formData, setFormData] = useState({
    name: '',
    unit: 'kg',
    minStockLevel: 50,
    isActive: true
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Common units
  const units = ['kg', 'กรัม', 'ลิตร', 'มล.', 'ขวด', 'แพ็ค', 'ถุง', 'กล่อง', 'ชิ้น'];

  // Initialize form data
  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        unit: initialData.unit || 'kg',
        minStockLevel: initialData.minStockLevel || 50,
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
    const fileInput = document.getElementById('material-image-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'กรุณาระบุชื่อวัตถุดิบ';
    }

    if (!formData.unit.trim()) {
      newErrors.unit = 'กรุณาระบุหน่วย';
    }

    if (formData.minStockLevel < 0) {
      newErrors.minStockLevel = 'จำนวนขั้นต่ำต้องมากกว่าหรือเท่ากับ 0';
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
          folder: 'raw-materials',
          maxWidth: 800,
          maxHeight: 800,
          quality: 0.85
        });
        
        setUploadingImage(false);
      }

      const materialData: RawMaterialFormData = {
        name: formData.name.trim(),
        unit: formData.unit.trim(),
        minStockLevel: formData.minStockLevel,
        isActive: formData.isActive
      };

      await onSubmit(materialData, imageUrl);
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
            <label className="label">ชื่อวัตถุดิบ *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className={`input ${errors.name ? 'input-error' : ''}`}
              placeholder="เช่น ส้ม, เลม่อน, น้ำตาล"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-400">{errors.name}</p>
            )}
          </div>

          {/* Unit */}
          <div>
            <label className="label">หน่วย *</label>
            <select
              value={units.includes(formData.unit) ? formData.unit : 'other'}
              onChange={(e) => {
                if (e.target.value === 'other') {
                  setFormData({...formData, unit: ''});
                } else {
                  setFormData({...formData, unit: e.target.value});
                }
              }}
              className={`input ${errors.unit ? 'input-error' : ''}`}
            >
              <option value="">เลือกหน่วย</option>
              {units.map((unit) => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
              <option value="other">อื่นๆ (ระบุเอง)</option>
            </select>
            
            {/* Show custom input if "other" is selected */}
            {!units.includes(formData.unit) && formData.unit !== '' && (
              <input
                type="text"
                value={formData.unit}
                onChange={(e) => setFormData({...formData, unit: e.target.value})}
                className={`input mt-2 ${errors.unit ? 'input-error' : ''}`}
                placeholder="ระบุหน่วยอื่นๆ"
                autoFocus
              />
            )}
            
            {errors.unit && (
              <p className="mt-1 text-sm text-red-400">{errors.unit}</p>
            )}
          </div>

          {/* Min Stock Level */}
          <div>
            <label className="label">จำนวนขั้นต่ำ *</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={formData.minStockLevel}
                onChange={(e) => setFormData({...formData, minStockLevel: parseInt(e.target.value) || 0})}
                className={`input flex-1 ${errors.minStockLevel ? 'input-error' : ''}`}
                placeholder="50"
                min="0"
                step="1"
              />
              <span className="text-gray-400">{formData.unit}</span>
            </div>
            {errors.minStockLevel && (
              <p className="mt-1 text-sm text-red-400">{errors.minStockLevel}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              ระบบจะแจ้งเตือนเมื่อวัตถุดิบเหลือน้อยกว่าจำนวนนี้
            </p>
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
              ปิดใช้งานจะไม่แสดงในหน้าบันทึกการซื้อ
            </p>
          </div>
        </div>

        {/* Right Column - Image */}
        <div>
          <label className="label">รูปวัตถุดิบ</label>
          
          {/* Image Preview */}
          <div className="bg-gray-800 rounded-lg p-4 mb-4 text-center">
            {imagePreview ? (
              <div className="relative inline-block">
                <img 
                  src={imagePreview}
                  alt="Material preview"
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
              id="material-image-upload"
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleImageSelect}
              className="hidden"
              disabled={isLoading}
            />
            <label
              htmlFor="material-image-upload"
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

          {/* Recommended Image */}
          <div className="mt-4 p-3 bg-gray-900 rounded-lg">
            <p className="text-xs text-gray-400">
              <strong>แนะนำ:</strong> รูปสี่เหลี่ยมจัตุรัส ขนาด 800x800 พิกเซล
            </p>
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
            isEdit ? 'บันทึกการเปลี่ยนแปลง' : 'เพิ่มวัตถุดิบ'
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