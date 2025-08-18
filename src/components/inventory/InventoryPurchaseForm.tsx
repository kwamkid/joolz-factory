// src/components/inventory/InventoryPurchaseForm.tsx
'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { 
  Package, Users, Camera, Star, Loader2, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { RawMaterial } from '@/types/raw-material';

interface Supplier {
  id: string;
  name: string;
  rating: number;
  averagePrice: number;
  totalPurchases: number;
  rawMaterials: string[];
  status: 'active' | 'banned';
}

export interface PurchaseFormData {
  materialType: string;
  supplierId: string;
  supplierName?: string;
  quantity: number;
  pricePerUnit: number;
  invoiceNumber: string;
  notes: string;
  invoiceUrl?: string;
}

interface InventoryPurchaseFormProps {
  initialData?: Partial<PurchaseFormData>;
  onSubmit: (data: PurchaseFormData, newInvoiceUrl?: string) => Promise<void>;
  onCancel: () => void;
  isEdit?: boolean;
  loading?: boolean;
}

export default function InventoryPurchaseForm({
  initialData,
  onSubmit,
  onCancel,
  isEdit = false,
  loading = false
}: InventoryPurchaseFormProps) {
  const [loadingMaterials, setLoadingMaterials] = useState(true);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [invoiceImage, setInvoiceImage] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Form Data - เปลี่ยน pricePerUnit เป็น totalPrice
  const [formData, setFormData] = useState({
    materialType: '',
    supplierId: '',
    quantity: '',
    totalPrice: '',
    invoiceNumber: '',
    notes: ''
  });

  // Load raw materials on mount
  useEffect(() => {
    loadRawMaterials();
  }, []);

  const loadRawMaterials = async () => {
    try {
      setLoadingMaterials(true);
      // Query active raw materials
      const materialsQuery = query(
        collection(db, 'raw_materials'),
        where('isActive', '==', true),
        orderBy('name', 'asc')
      );
      
      const snapshot = await getDocs(materialsQuery);
      const materialsData: RawMaterial[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        materialsData.push({
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
      
      setMaterials(materialsData);
    } catch (error) {
      console.error('Error loading materials:', error);
      // ถ้าไม่มีข้อมูลใน DB ใช้ข้อมูล default ไปก่อน
      const defaultMaterials = ['ส้ม', 'เลม่อน', 'เก๊กฮวย', 'อัญชัญ', 'น้ำผึ้ง', 'น้ำตาล'];
      setMaterials(defaultMaterials.map((name, index) => ({
        id: `default-${index}`,
        name,
        unit: 'kg',
        isActive: true,
        createdAt: new Date()
      })));
    } finally {
      setLoadingMaterials(false);
    }
  };

  // Initialize form data
  useEffect(() => {
    if (initialData) {
      const totalPrice = initialData.quantity && initialData.pricePerUnit 
        ? (initialData.quantity * initialData.pricePerUnit).toString()
        : '';
        
      setFormData({
        materialType: initialData.materialType || '',
        supplierId: initialData.supplierId || '',
        quantity: initialData.quantity?.toString() || '',
        totalPrice: totalPrice,
        invoiceNumber: initialData.invoiceNumber || '',
        notes: initialData.notes || ''
      });
      
      if (initialData.invoiceUrl) {
        setImagePreview(initialData.invoiceUrl);
      }
    }
  }, [initialData]);

  // Load suppliers when material is selected
  useEffect(() => {
    if (formData.materialType) {
      loadSuppliers();
    } else {
      setSuppliers([]);
    }
  }, [formData.materialType]);

  const loadSuppliers = async () => {
    try {
      setLoadingSuppliers(true);
      const suppliersQuery = query(
        collection(db, 'suppliers'),
        where('status', '==', 'active'),
        where('rawMaterials', 'array-contains', formData.materialType),
        orderBy('rating', 'desc')
      );
      
      const snapshot = await getDocs(suppliersQuery);
      const suppliersData: Supplier[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        suppliersData.push({
          id: doc.id,
          name: data.name,
          rating: data.rating || 0,
          averagePrice: data.averagePrice || 0,
          totalPurchases: data.totalPurchases || 0,
          rawMaterials: data.rawMaterials || [],
          status: data.status
        });
      });
      
      setSuppliers(suppliersData);
    } catch (error) {
      console.error('Error loading suppliers:', error);
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูลซัพพลายเออร์');
    } finally {
      setLoadingSuppliers(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('ไฟล์ใหญ่เกิน 10MB');
      return;
    }

    setInvoiceImage(file);
    
    // Preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
    if (!formData.materialType) {
      toast.error('กรุณาเลือกวัตถุดิบ');
      return;
    }
    if (!formData.supplierId) {
      toast.error('กรุณาเลือกซัพพลายเออร์');
      return;
    }
    if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
      toast.error('กรุณาระบุจำนวน');
      return;
    }
    if (!formData.totalPrice || parseFloat(formData.totalPrice) <= 0) {
      toast.error('กรุณาระบุราคารวม');
      return;
    }

    try {
      setUploadingImage(true);

      // Upload new invoice image if exists
      let invoiceUrl = initialData?.invoiceUrl;
      if (invoiceImage) {
        const timestamp = Date.now();
        const filename = `invoices/${timestamp}_${invoiceImage.name}`;
        const storageRef = ref(storage, filename);
        const snapshot = await uploadBytes(storageRef, invoiceImage);
        invoiceUrl = await getDownloadURL(snapshot.ref);
      }

      const supplier = suppliers.find(s => s.id === formData.supplierId);
      
      // คำนวณราคาต่อหน่วยจากราคารวม
      const quantity = parseFloat(formData.quantity);
      const totalPrice = parseFloat(formData.totalPrice);
      const pricePerUnit = totalPrice / quantity;
      
      const purchaseData: PurchaseFormData = {
        materialType: formData.materialType,
        supplierId: formData.supplierId,
        supplierName: supplier?.name || initialData?.supplierName || '',
        quantity: quantity,
        pricePerUnit: pricePerUnit,
        invoiceNumber: formData.invoiceNumber,
        notes: formData.notes,
        invoiceUrl
      };

      await onSubmit(purchaseData, invoiceUrl);
    } catch (error) {
      console.error('Error in form submit:', error);
      toast.error('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setUploadingImage(false);
    }
  };

  const getTotalCost = () => {
    return parseFloat(formData.totalPrice) || 0;
  };

  const getPricePerUnit = () => {
    const qty = parseFloat(formData.quantity) || 0;
    const total = parseFloat(formData.totalPrice) || 0;
    if (qty === 0) return 0;
    return total / qty;
  };

  const isLoading = loading || uploadingImage;

  // หาหน่วยของวัตถุดิบที่เลือก
  const selectedMaterial = materials.find(m => m.name === formData.materialType);
  const unit = selectedMaterial?.unit || 'kg';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Material Type */}
      <div>
        <label className="label">
          <Package className="h-4 w-4 inline mr-1" />
          วัตถุดิบ *
        </label>
        {loadingMaterials ? (
          <div className="flex items-center justify-center py-8 bg-gray-800 rounded-lg">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-gray-400">กำลังโหลด...</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {materials.map((material) => (
              <button
                key={material.id}
                type="button"
                onClick={() => setFormData({ ...formData, materialType: material.name, supplierId: '' })}
                disabled={isEdit}
                className={`p-4 rounded-lg border-2 font-medium transition-all ${
                  formData.materialType === material.name
                    ? 'bg-primary text-black border-primary'
                    : 'bg-gray-800 text-white border-gray-700 hover:border-gray-600'
                } ${isEdit ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                {material.imageUrl && (
                  <img 
                    src={material.imageUrl} 
                    alt={material.name}
                    className="w-12 h-12 object-cover rounded-lg mx-auto mb-2"
                  />
                )}
                <div>{material.name}</div>
                <div className="text-xs opacity-75 mt-1">({material.unit})</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Supplier */}
      {formData.materialType && (
        <div>
          <label className="label">
            <Users className="h-4 w-4 inline mr-1" />
            ซัพพลายเออร์ *
          </label>
          {loadingSuppliers ? (
            <div className="flex items-center justify-center py-8 bg-gray-800 rounded-lg">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-gray-400">กำลังโหลด...</span>
            </div>
          ) : suppliers.length === 0 ? (
            <div className="p-4 bg-gray-800 rounded-lg text-center text-gray-400">
              ไม่พบซัพพลายเออร์สำหรับ {formData.materialType}
            </div>
          ) : (
            <select
              value={formData.supplierId}
              onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
              disabled={isEdit}
              className={`input ${isEdit ? 'cursor-not-allowed opacity-60' : ''}`}
              required
            >
              <option value="">เลือกซัพพลายเออร์</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name} ⭐ {supplier.rating.toFixed(1)} (฿{supplier.averagePrice.toFixed(0)}/{unit})
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quantity */}
        <div>
          <label className="label">จำนวน ({unit}) *</label>
          <input
            type="number"
            value={formData.quantity}
            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
            className="input"
            placeholder="0"
            step="0.1"
            required
          />
        </div>

        {/* Total Price */}
        <div>
          <label className="label">ราคารวมทั้งหมด (บาท) *</label>
          <input
            type="number"
            value={formData.totalPrice}
            onChange={(e) => setFormData({ ...formData, totalPrice: e.target.value })}
            className="input"
            placeholder="0"
            step="0.01"
            required
          />
        </div>
      </div>

      {/* Total Cost Display */}
      {formData.quantity && formData.totalPrice && (
        <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-400">สรุปการซื้อ</p>
              <p className="text-xs text-gray-500 mt-1">
                {formData.quantity} {unit} × ฿{getPricePerUnit().toFixed(2)}/{unit}
              </p>
            </div>
            <p className="text-3xl font-bold text-primary">
              ฿{getTotalCost().toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      )}

      {/* Invoice Number */}
      <div>
        <label className="label">เลขที่ใบเสร็จ</label>
        <input
          type="text"
          value={formData.invoiceNumber}
          onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
          className="input"
          placeholder="INV-001 (ไม่บังคับ)"
        />
      </div>

      {/* Invoice Image */}
      <div>
        <label className="label">รูปใบเสร็จ</label>
        {imagePreview ? (
          <div className="relative">
            <img 
              src={imagePreview} 
              alt="Invoice preview" 
              className="w-full h-64 object-cover rounded-lg"
            />
            <button
              type="button"
              onClick={() => {
                setInvoiceImage(null);
                setImagePreview('');
              }}
              className="absolute top-2 right-2 p-2 bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              <X className="h-4 w-4 text-white" />
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-700 border-dashed rounded-lg cursor-pointer bg-gray-800 hover:bg-gray-700">
            <Camera className="h-8 w-8 text-gray-400 mb-2" />
            <span className="text-sm text-gray-400">แตะเพื่อถ่ายรูป</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageSelect}
              className="hidden"
            />
          </label>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="label">หมายเหตุ</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          className="input resize-none"
          placeholder="เช่น คุณภาพดี, ส่งตรงเวลา (ไม่บังคับ)"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-ghost"
          disabled={isLoading}
        >
          ยกเลิก
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="btn btn-primary flex-1"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              กำลังบันทึก...
            </>
          ) : (
            isEdit ? 'บันทึกการแก้ไข' : 'บันทึกการซื้อ'
          )}
        </button>
      </div>
    </form>
  );
}