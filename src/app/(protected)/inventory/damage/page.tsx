// src/app/(protected)/inventory/damage/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { 
  collection, getDocs, query, where, orderBy, 
  doc, updateDoc, addDoc, serverTimestamp 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { 
  ArrowLeft, Package, Trash2, Camera, Loader2, 
  AlertTriangle, X, Search
} from 'lucide-react';
import toast from 'react-hot-toast';
import { InventoryBatch } from '@/types/inventory';
import { RawMaterial } from '@/types/raw-material';

export default function InventoryDamagePage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [inventory, setInventory] = useState<InventoryBatch[]>([]);
  const [filteredInventory, setFilteredInventory] = useState<InventoryBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBatch, setSelectedBatch] = useState<InventoryBatch | null>(null);
  
  // Damage form
  const [damageQuantity, setDamageQuantity] = useState('');
  const [damageReason, setDamageReason] = useState('');
  const [damageImage, setDamageImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [materialImages, setMaterialImages] = useState<Record<string, string>>({});

  // Check permission
  useEffect(() => {
    if (currentUser && currentUser.role === 'operation') {
      toast.error('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
      router.push('/dashboard');
    }
  }, [currentUser, router]);

  // Fetch inventory
  useEffect(() => {
    fetchInventory();
  }, []);

  // Filter inventory
  useEffect(() => {
    let filtered = inventory;

    if (searchQuery) {
      filtered = filtered.filter(item => 
        item.materialType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.batchId.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredInventory(filtered);
  }, [searchQuery, inventory]);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const inventoryQuery = query(
        collection(db, 'inventory_batches'),
        where('remainingQuantity', '>', 0),
        where('status', '==', 'active'),
        orderBy('createdAt', 'asc') // FIFO
      );
      
      const inventorySnapshot = await getDocs(inventoryQuery);
      const inventoryData: InventoryBatch[] = [];
      const materialTypes = new Set<string>();
      
      inventorySnapshot.forEach((doc) => {
        const data = doc.data();
        inventoryData.push({
          id: doc.id,
          batchId: data.batchId,
          materialType: data.materialType,
          materialId: data.materialId,
          supplier: data.supplier,
          purchaseDate: data.purchaseDate?.toDate() || new Date(),
          quantity: data.quantity,
          remainingQuantity: data.remainingQuantity,
          pricePerUnit: data.pricePerUnit,
          totalCost: data.totalCost,
          invoiceNumber: data.invoiceNumber,
          invoiceUrl: data.invoiceUrl,
          notes: data.notes,
          status: data.status || 'active',
          isFinished: data.isFinished || false,
          finishedAt: data.finishedAt?.toDate(),
          createdBy: data.createdBy,
          createdByName: data.createdByName,
          createdAt: data.createdAt?.toDate() || new Date(),
          expiryDate: data.expiryDate?.toDate()
        });
        
        materialTypes.add(data.materialType);
      });

      setInventory(inventoryData);
      
      // Fetch material images
      if (materialTypes.size > 0) {
        const materialsQuery = query(
          collection(db, 'raw_materials'),
          where('name', 'in', Array.from(materialTypes))
        );
        
        const materialsSnapshot = await getDocs(materialsQuery);
        const images: Record<string, string> = {};
        
        materialsSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.imageUrl) {
            images[data.name] = data.imageUrl;
          }
        });
        
        setMaterialImages(images);
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('ไฟล์ใหญ่เกิน 10MB');
      return;
    }

    setDamageImage(file);
    
    // Preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedBatch) {
      toast.error('กรุณาเลือกวัตถุดิบ');
      return;
    }
    
    const quantity = parseFloat(damageQuantity);
    if (!quantity || quantity <= 0) {
      toast.error('กรุณาระบุจำนวนที่เสีย');
      return;
    }
    
    if (quantity > selectedBatch.remainingQuantity) {
      toast.error('จำนวนที่เสียมากกว่าจำนวนคงเหลือ');
      return;
    }
    
    if (!damageReason.trim()) {
      toast.error('กรุณาระบุเหตุผล');
      return;
    }

    try {
      setSubmitting(true);

      // Upload damage photo if exists
      let photoUrl = '';
      if (damageImage) {
        const timestamp = Date.now();
        const filename = `damages/${timestamp}_${damageImage.name}`;
        const storageRef = ref(storage, filename);
        const snapshot = await uploadBytes(storageRef, damageImage);
        photoUrl = await getDownloadURL(snapshot.ref);
      }

      // Calculate new remaining quantity
      const newRemaining = selectedBatch.remainingQuantity - quantity;
      const isFinished = newRemaining === 0;

      // Create damage record
      const damageData = {
        batchId: selectedBatch.batchId,
        inventoryId: selectedBatch.id,
        materialType: selectedBatch.materialType,
        quantity: quantity,
        reason: damageReason,
        photoUrl: photoUrl,
        unitCost: selectedBatch.pricePerUnit,
        totalLoss: quantity * selectedBatch.pricePerUnit,
        reportedBy: currentUser?.uid || '',
        reportedByName: currentUser?.name || '',
        reportedAt: serverTimestamp(),
        status: 'approved' // Auto-approve for now
      };

      await addDoc(collection(db, 'damage_records'), damageData);

      // Update inventory batch
      const updateData: any = {
        remainingQuantity: newRemaining,
        updatedAt: serverTimestamp()
      };

      if (isFinished) {
        updateData.isFinished = true;
        updateData.finishedAt = serverTimestamp();
        updateData.status = 'finished';
      }

      await updateDoc(doc(db, 'inventory_batches', selectedBatch.id), updateData);

      // Create movement record
      const movementData = {
        batchId: selectedBatch.batchId,
        materialType: selectedBatch.materialType,
        movementType: 'damage',
        quantity: -quantity, // Negative for out
        previousQuantity: selectedBatch.remainingQuantity,
        newQuantity: newRemaining,
        damageReason: damageReason,
        damagePhotoUrl: photoUrl,
        reference: selectedBatch.batchId,
        referenceType: 'damage',
        notes: `ตัดของเสีย: ${damageReason}`,
        createdBy: currentUser?.uid || '',
        createdByName: currentUser?.name || '',
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'inventory_movements'), movementData);

      toast.success('บันทึกการตัดของเสียสำเร็จ');
      
      // Reset form
      setSelectedBatch(null);
      setDamageQuantity('');
      setDamageReason('');
      setDamageImage(null);
      setImagePreview('');
      
      // Refresh inventory
      fetchInventory();
    } catch (error) {
      console.error('Error recording damage:', error);
      toast.error('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
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
          onClick={() => router.push('/inventory')}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          กลับ
        </button>
        
        <h1 className="text-2xl font-bold text-white mb-2">ตัดของเสีย</h1>
        <p className="text-gray-400">บันทึกวัตถุดิบที่เสียหายหรือไม่สามารถใช้งานได้</p>
      </div>

      {/* Warning */}
      <div className="mb-6 p-4 bg-red-900/20 border border-red-600 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 font-medium">คำเตือน</p>
            <p className="text-red-300 text-sm mt-1">
              การตัดของเสียจะลดจำนวนวัตถุดิบในคลังทันที และไม่สามารถยกเลิกได้
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Select Material */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">เลือกวัตถุดิบ</h2>
          
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหา Batch ID, วัตถุดิบ, ซัพพลายเออร์..."
              className="input pl-10"
            />
          </div>

          {/* Material List */}
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {filteredInventory.map((item) => {
              const materialImage = materialImages[item.materialType];
              
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedBatch(item)}
                  className={`card cursor-pointer transition-all ${
                    selectedBatch?.id === item.id 
                      ? 'ring-2 ring-primary bg-gray-800' 
                      : 'hover:bg-gray-800'
                  }`}
                >
                  <div className="flex gap-4">
                    {/* Material Image */}
                    <div className="flex-shrink-0">
                      <div className="w-20 h-20 bg-gray-700 rounded-lg overflow-hidden">
                        {materialImage ? (
                          <img 
                            src={materialImage} 
                            alt={item.materialType}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-8 w-8 text-gray-500" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-white text-lg">{item.materialType}</p>
                          <p className="font-mono text-xs text-gray-500">{item.batchId}</p>
                          
                          {/* Supplier with emphasis */}
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-sm font-semibold text-primary">
                              {item.supplier.name}
                            </span>
                            <span className="text-xs text-gray-400">
                              ⭐ {item.supplier.rating.toFixed(1)}
                            </span>
                          </div>
                        </div>

                        {/* Quantity Info */}
                        <div className="text-right">
                          <div className="mb-1">
                            <p className="text-xs text-gray-500">ซื้อเข้า</p>
                            <p className="text-sm text-gray-400">{item.quantity.toFixed(1)} kg</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">คงเหลือ</p>
                            <p className="text-xl font-bold text-white">
                              {item.remainingQuantity.toFixed(1)} kg
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-3">
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all ${
                              item.remainingQuantity < 10 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${(item.remainingQuantity / item.quantity) * 100}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          ใช้ไป {((item.quantity - item.remainingQuantity) / item.quantity * 100).toFixed(0)}%
                        </p>
                      </div>

                      {/* Additional Info */}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>ซื้อเมื่อ: {new Date(item.purchaseDate).toLocaleDateString('th-TH')}</span>
                        <span>{formatCurrency(item.pricePerUnit)}/kg</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredInventory.length === 0 && (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">ไม่พบวัตถุดิบ</p>
            </div>
          )}
        </div>

        {/* Damage Form */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">รายละเอียดของเสีย</h2>
          
          <form onSubmit={handleSubmit} className="card">
            {selectedBatch ? (
              <>
                {/* Selected Material Info */}
                <div className="mb-6 p-4 bg-gray-800 rounded-lg">
                  <p className="text-sm text-gray-400">วัตถุดิบที่เลือก</p>
                  <p className="font-medium text-white">{selectedBatch.materialType}</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Batch: {selectedBatch.batchId} • คงเหลือ: {selectedBatch.remainingQuantity.toFixed(1)} kg
                  </p>
                </div>

                {/* Damage Quantity */}
                <div className="mb-4">
                  <label className="label">จำนวนที่เสีย (kg) *</label>
                  <input
                    type="number"
                    value={damageQuantity}
                    onChange={(e) => setDamageQuantity(e.target.value)}
                    className="input"
                    placeholder="0"
                    step="0.1"
                    max={selectedBatch.remainingQuantity}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    ไม่เกิน {selectedBatch.remainingQuantity.toFixed(1)} kg
                  </p>
                </div>

                {/* Damage Reason */}
                <div className="mb-4">
                  <label className="label">เหตุผล *</label>
                  <textarea
                    value={damageReason}
                    onChange={(e) => setDamageReason(e.target.value)}
                    rows={3}
                    className="input resize-none"
                    placeholder="เช่น หมดอายุ, เน่าเสีย, ชำรุด..."
                    required
                  />
                </div>

                {/* Damage Photo */}
                <div className="mb-6">
                  <label className="label">รูปถ่ายของเสีย</label>
                  {imagePreview ? (
                    <div className="relative">
                      <img 
                        src={imagePreview} 
                        alt="Damage preview" 
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setDamageImage(null);
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

                {/* Loss Amount */}
                {damageQuantity && parseFloat(damageQuantity) > 0 && (
                  <div className="mb-6 p-4 bg-red-900/20 border border-red-600 rounded-lg">
                    <p className="text-sm text-red-400">มูลค่าความเสียหาย</p>
                    <p className="text-2xl font-bold text-red-400">
                      {formatCurrency(parseFloat(damageQuantity) * selectedBatch.pricePerUnit)}
                    </p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn bg-red-600 hover:bg-red-700 text-white w-full"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      กำลังบันทึก...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      ยืนยันการตัดของเสีย
                    </>
                  )}
                </button>
              </>
            ) : (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">กรุณาเลือกวัตถุดิบที่ต้องการตัด</p>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}