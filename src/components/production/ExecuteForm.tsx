// src/components/production/ExecuteForm.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { 
  collection, getDocs, query, where, orderBy, doc, getDoc,
  updateDoc, serverTimestamp, addDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  Loader2, AlertCircle, Camera, CheckCircle, X,
  Package, Droplet, TestTube, Plus, Minus
} from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadImage, validateImageFile } from '@/utils/image-upload';
import { ProductionBatch, QualityTestResult } from '@/types/production';
import { InventoryBatch } from '@/types/inventory';

interface ExecuteFormProps {
  batchId: string;
  onComplete: () => void;
  onCancel: () => void;
}

interface MaterialUsed {
  materialType: string;
  quantity: number;
  batches: {
    batchId: string;
    quantity: number;
    pricePerUnit: number;
  }[];
}

export default function ExecuteForm({ batchId, onComplete, onCancel }: ExecuteFormProps) {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Batch data
  const [batch, setBatch] = useState<ProductionBatch | null>(null);
  const [productImage, setProductImage] = useState<string>('');
  
  // Form data
  const [actualBottles, setActualBottles] = useState<Record<string, number>>({});
  const [materialsUsed, setMaterialsUsed] = useState<Record<string, number>>({});
  const [qualityTests, setQualityTests] = useState<{
    beforeMixing: {
      brix: number;
      acidity: number;
      brixPhoto?: string;
      acidityPhoto?: string;
    };
    afterMixing: {
      brix: number;
      acidity: number;
      brixPhoto?: string;
      acidityPhoto?: string;
    };
  }>({
    beforeMixing: { brix: 0, acidity: 0 },
    afterMixing: { brix: 0, acidity: 0 }
  });
  const [notes, setNotes] = useState('');
  
  // Photo uploads
  const [uploadingPhotos, setUploadingPhotos] = useState<Record<string, boolean>>({});
  
  // Material tracking for FIFO
  const [availableMaterials, setAvailableMaterials] = useState<Record<string, InventoryBatch[]>>({});

  // Load batch data
  useEffect(() => {
    loadBatchData();
  }, [batchId]);

  const loadBatchData = async () => {
    try {
      setLoading(true);
      
      // Find batch by batchId
      const batchQuery = query(
        collection(db, 'production_batches'),
        where('batchId', '==', batchId),
        where('status', '==', 'planned')
      );
      
      const batchSnapshot = await getDocs(batchQuery);
      
      if (batchSnapshot.empty) {
        toast.error('ไม่พบ Batch ID นี้หรือเริ่มผลิตไปแล้ว');
        router.push('/production');
        return;
      }
      
      const batchDoc = batchSnapshot.docs[0];
      const batchData = batchDoc.data();
      
      const productionBatch: ProductionBatch = {
        id: batchDoc.id,
        batchId: batchData.batchId,
        productId: batchData.productId,
        productName: batchData.productName,
        productionDate: batchData.productionDate,
        status: batchData.status,
        plannedBottles: batchData.plannedBottles || {},
        totalJuiceNeeded: batchData.totalJuiceNeeded || 0,
        materialRequirements: batchData.materialRequirements || {},
        plannedBy: batchData.plannedBy,
        plannedByName: batchData.plannedByName,
        plannedAt: batchData.plannedAt?.toDate() || new Date(),
        notes: batchData.notes
      };
      
      setBatch(productionBatch);
      
      // Initialize actual bottles with planned quantities
      setActualBottles(productionBatch.plannedBottles);
      
      // Initialize materials used
      const initialMaterials: Record<string, number> = {};
      Object.entries(productionBatch.materialRequirements).forEach(([material, req]) => {
        initialMaterials[material] = req.quantity || 0;
      });
      setMaterialsUsed(initialMaterials);
      
      // Load product image
      if (productionBatch.productId) {
        const productDoc = await getDoc(doc(db, 'products', productionBatch.productId));
        if (productDoc.exists()) {
          setProductImage(productDoc.data().imageUrl || '');
        }
      }
      
      // Load available materials
      await loadAvailableMaterials(productionBatch.materialRequirements);
      
    } catch (error) {
      console.error('Error loading batch:', error);
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      router.push('/production');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableMaterials = async (requirements: Record<string, any>) => {
    const materials: Record<string, InventoryBatch[]> = {};
    
    for (const materialType of Object.keys(requirements)) {
      try {
        const inventoryQuery = query(
          collection(db, 'inventory_batches'),
          where('materialType', '==', materialType),
          where('remainingQuantity', '>', 0),
          where('status', '==', 'active'),
          orderBy('createdAt', 'asc') // FIFO
        );
        
        const inventorySnapshot = await getDocs(inventoryQuery);
        const batches: InventoryBatch[] = [];
        
        inventorySnapshot.forEach((doc) => {
          const data = doc.data();
          batches.push({
            id: doc.id,
            batchId: data.batchId,
            materialType: data.materialType,
            supplier: data.supplier,
            purchaseDate: data.purchaseDate?.toDate() || new Date(),
            quantity: data.quantity,
            remainingQuantity: data.remainingQuantity,
            pricePerUnit: data.pricePerUnit,
            totalCost: data.totalCost,
            status: data.status,
            isFinished: data.isFinished || false,
            createdBy: data.createdBy,
            createdByName: data.createdByName,
            createdAt: data.createdAt?.toDate() || new Date()
          });
        });
        
        materials[materialType] = batches;
      } catch (error) {
        console.error(`Error loading materials for ${materialType}:`, error);
      }
    }
    
    setAvailableMaterials(materials);
  };

  const handlePhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    testType: 'beforeMixing' | 'afterMixing',
    measurement: 'brix' | 'acidity'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast.error(validation.error || 'ไฟล์ไม่ถูกต้อง');
      return;
    }

    const uploadKey = `${testType}-${measurement}`;
    setUploadingPhotos(prev => ({ ...prev, [uploadKey]: true }));

    try {
      const imageUrl = await uploadImage(file, {
        folder: 'quality-tests',
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.85
      });

      setQualityTests(prev => ({
        ...prev,
        [testType]: {
          ...prev[testType],
          [`${measurement}Photo`]: imageUrl
        }
      }));
      
      toast.success('อัพโหลดรูปสำเร็จ');
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error('เกิดข้อผิดพลาดในการอัพโหลดรูป');
    } finally {
      setUploadingPhotos(prev => ({ ...prev, [uploadKey]: false }));
    }
  };

  const removePhoto = (testType: 'beforeMixing' | 'afterMixing', measurement: 'brix' | 'acidity') => {
    setQualityTests(prev => ({
      ...prev,
      [testType]: {
        ...prev[testType],
        [`${measurement}Photo`]: undefined
      }
    }));
  };

  const calculateFIFOMaterials = (materialType: string, quantityNeeded: number): MaterialUsed => {
    const batches = availableMaterials[materialType] || [];
    const usedBatches: MaterialUsed['batches'] = [];
    let remaining = quantityNeeded;
    
    for (const batch of batches) {
      if (remaining <= 0) break;
      
      const useFromBatch = Math.min(remaining, batch.remainingQuantity);
      usedBatches.push({
        batchId: batch.batchId,
        quantity: useFromBatch,
        pricePerUnit: batch.pricePerUnit
      });
      
      remaining -= useFromBatch;
    }
    
    return {
      materialType,
      quantity: quantityNeeded,
      batches: usedBatches
    };
  };

  const handleSubmit = async () => {
    if (!batch) return;

    try {
      setSubmitting(true);

      // Calculate FIFO material usage and costs
      const materialCosts: Record<string, number> = {};
      const inventoryUpdates: any[] = [];
      let totalMaterialCost = 0;

      for (const [materialType, quantity] of Object.entries(materialsUsed)) {
        const fifoResult = calculateFIFOMaterials(materialType, quantity);
        let materialCost = 0;
        
        // Prepare inventory updates
        for (const used of fifoResult.batches) {
          materialCost += used.quantity * used.pricePerUnit;
          
          inventoryUpdates.push({
            batchId: used.batchId,
            quantityUsed: used.quantity,
            materialType
          });
        }
        
        materialCosts[materialType] = materialCost;
        totalMaterialCost += materialCost;
      }

      // Prepare quality test results (only if values provided)
      const testResults: QualityTestResult[] = [];
      
      // Before mixing tests
      if (qualityTests.beforeMixing.brix > 0) {
        testResults.push({
          testName: 'Brix',
          testType: 'before_mixing',
          value: qualityTests.beforeMixing.brix,
          unit: '°Bx',
          photoUrl: qualityTests.beforeMixing.brixPhoto || '',
          passed: true,
          testedAt: new Date(),
          testedBy: currentUser?.uid || '',
          testedByName: currentUser?.name || '',
          notes: ''
        });
      }
      
      if (qualityTests.beforeMixing.acidity > 0) {
        testResults.push({
          testName: 'Acidity',
          testType: 'before_mixing',
          value: qualityTests.beforeMixing.acidity,
          unit: '%',
          photoUrl: qualityTests.beforeMixing.acidityPhoto || '',
          passed: true,
          testedAt: new Date(),
          testedBy: currentUser?.uid || '',
          testedByName: currentUser?.name || '',
          notes: ''
        });
      }
      
      // After mixing tests
      if (qualityTests.afterMixing.brix > 0) {
        testResults.push({
          testName: 'Brix',
          testType: 'after_mixing',
          value: qualityTests.afterMixing.brix,
          unit: '°Bx',
          photoUrl: qualityTests.afterMixing.brixPhoto || '',
          passed: true,
          testedAt: new Date(),
          testedBy: currentUser?.uid || '',
          testedByName: currentUser?.name || '',
          notes: ''
        });
      }
      
      if (qualityTests.afterMixing.acidity > 0) {
        testResults.push({
          testName: 'Acidity',
          testType: 'after_mixing',
          value: qualityTests.afterMixing.acidity,
          unit: '%',
          photoUrl: qualityTests.afterMixing.acidityPhoto || '',
          passed: true,
          testedAt: new Date(),
          testedBy: currentUser?.uid || '',
          testedByName: currentUser?.name || '',
          notes: ''
        });
      }

      // Update production batch
      const updateData: any = {
        status: 'completed',
        actualBottlesProduced: actualBottles,
        actualMaterialsUsed: materialsUsed,
        startedAt: serverTimestamp(),
        startedBy: currentUser?.uid || '',
        startedByName: currentUser?.name || '',
        completedAt: serverTimestamp(),
        completedBy: currentUser?.uid || '',
        completedByName: currentUser?.name || ''
      };

      // Add optional fields only if they have values
      if (testResults.length > 0) {
        updateData.qualityTests = testResults;
      }

      if (currentUser?.role === 'admin') {
        updateData.materialCost = totalMaterialCost;
        updateData.totalCost = totalMaterialCost; // + bottle cost
      }

      if (notes.trim()) {
        updateData.productionNotes = notes.trim();
      }

      await updateDoc(doc(db, 'production_batches', batch.id), updateData);

      // Update inventory batches
      for (const update of inventoryUpdates) {
        const inventoryBatch = availableMaterials[update.materialType]
          ?.find(b => b.batchId === update.batchId);
        
        if (inventoryBatch) {
          const newRemaining = inventoryBatch.remainingQuantity - update.quantityUsed;
          
          await updateDoc(doc(db, 'inventory_batches', inventoryBatch.id), {
            remainingQuantity: newRemaining,
            ...(newRemaining === 0 && {
              status: 'finished',
              isFinished: true,
              finishedAt: serverTimestamp()
            })
          });

          // Create inventory movement record
          await addDoc(collection(db, 'inventory_movements'), {
            batchId: update.batchId,
            materialType: update.materialType,
            movementType: 'out',
            quantity: update.quantityUsed,
            previousQuantity: inventoryBatch.remainingQuantity,
            newQuantity: newRemaining,
            reference: batch.batchId,
            referenceType: 'production',
            createdBy: currentUser?.uid,
            createdByName: currentUser?.name,
            createdAt: serverTimestamp()
          });
        }
      }

      toast.success('บันทึกการผลิตสำเร็จ!');
      onComplete();
      
    } catch (error) {
      console.error('Error saving production:', error);
      toast.error('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBottleChange = (bottleId: string, change: number) => {
    setActualBottles(prev => ({
      ...prev,
      [bottleId]: Math.max(0, (prev[bottleId] || 0) + change)
    }));
  };

  const handleMaterialChange = (material: string, value: string) => {
    const quantity = parseFloat(value) || 0;
    setMaterialsUsed(prev => ({
      ...prev,
      [material]: Math.max(0, quantity)
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
          <p className="mt-4 text-gray-400">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <p className="text-gray-400">ไม่พบข้อมูล Batch</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Batch Info */}
      <div className="card bg-primary/10 border border-primary/30">
        <div className="flex items-center gap-4">
          {productImage && (
            <img 
              src={productImage} 
              alt={batch.productName}
              className="h-20 w-20 object-cover rounded-lg"
            />
          )}
          <div className="flex-1">
            <h3 className="text-sm font-medium text-primary">กำลังผลิต</h3>
            <p className="text-2xl font-mono font-bold text-white">{batch.batchId}</p>
            <p className="text-white">{batch.productName}</p>
          </div>
        </div>
      </div>

      {/* Materials and Bottles - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Materials Used */}
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">
            <Package className="h-5 w-5 inline mr-2" />
            วัตถุดิบที่ใช้จริง
          </h3>
          <div className="space-y-4">
            {Object.entries(batch.materialRequirements).map(([material, req]) => (
              <div key={material}>
                <label className="label">{material} (แผน: {req.quantity.toFixed(1)} kg)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={materialsUsed[material] || 0}
                    onChange={(e) => handleMaterialChange(material, e.target.value)}
                    className="input flex-1"
                    step="0.1"
                    min="0"
                  />
                  <span className="text-gray-400">kg</span>
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  คงเหลือ: {availableMaterials[material]?.reduce((sum, b) => sum + b.remainingQuantity, 0).toFixed(1) || 0} kg
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actual Bottles Produced */}
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">
            <Droplet className="h-5 w-5 inline mr-2" />
            จำนวนขวดที่ผลิตได้จริง
          </h3>
          <div className="space-y-4">
            {Object.entries(batch.plannedBottles).map(([bottleId, planned]) => (
              <div key={bottleId} className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">{bottleId}</p>
                  <p className="text-xs text-gray-400">แผน: {planned} ขวด</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleBottleChange(bottleId, -10)}
                    className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  
                  <input
                    type="number"
                    value={actualBottles[bottleId] || 0}
                    onChange={(e) => setActualBottles(prev => ({
                      ...prev,
                      [bottleId]: parseInt(e.target.value) || 0
                    }))}
                    className="w-20 text-center input"
                    min="0"
                  />
                  
                  <button
                    type="button"
                    onClick={() => handleBottleChange(bottleId, 10)}
                    className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  
                  <span className="text-gray-400 text-sm w-12">ขวด</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quality Testing - Side by Side */}
      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-4">
          <TestTube className="h-5 w-5 inline mr-2" />
          ผลการทดสอบคุณภาพ (ไม่บังคับ)
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Before Mixing */}
          <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-4">
            <h4 className="text-md font-medium text-blue-400 mb-4 text-center">ก่อนผสม</h4>
            <div className="space-y-4">
              {/* Brix */}
              <div>
                <label className="label">Brix (°Bx)</label>
                <input
                  type="number"
                  value={qualityTests.beforeMixing.brix || ''}
                  onChange={(e) => setQualityTests(prev => ({
                    ...prev,
                    beforeMixing: { ...prev.beforeMixing, brix: parseFloat(e.target.value) || 0 }
                  }))}
                  className="input mb-2"
                  step="0.1"
                  placeholder="0.0"
                />
                
                {qualityTests.beforeMixing.brixPhoto ? (
                  <div className="relative inline-block">
                    <img 
                      src={qualityTests.beforeMixing.brixPhoto} 
                      alt="Brix test"
                      className="h-20 w-20 object-cover rounded border border-gray-600"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto('beforeMixing', 'brix')}
                      className="absolute -top-2 -right-2 p-1 bg-red-600 rounded-full hover:bg-red-700"
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handlePhotoUpload(e, 'beforeMixing', 'brix')}
                      className="hidden"
                      id="before-brix-photo"
                      disabled={uploadingPhotos['beforeMixing-brix']}
                    />
                    <label
                      htmlFor="before-brix-photo"
                      className="btn btn-sm btn-ghost cursor-pointer"
                    >
                      <Camera className="h-4 w-4" />
                      ถ่ายรูป
                    </label>
                  </div>
                )}
              </div>

              {/* Acidity */}
              <div>
                <label className="label">Acidity (%)</label>
                <input
                  type="number"
                  value={qualityTests.beforeMixing.acidity || ''}
                  onChange={(e) => setQualityTests(prev => ({
                    ...prev,
                    beforeMixing: { ...prev.beforeMixing, acidity: parseFloat(e.target.value) || 0 }
                  }))}
                  className="input mb-2"
                  step="0.01"
                  placeholder="0.00"
                />
                
                {qualityTests.beforeMixing.acidityPhoto ? (
                  <div className="relative inline-block">
                    <img 
                      src={qualityTests.beforeMixing.acidityPhoto} 
                      alt="Acidity test"
                      className="h-20 w-20 object-cover rounded border border-gray-600"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto('beforeMixing', 'acidity')}
                      className="absolute -top-2 -right-2 p-1 bg-red-600 rounded-full hover:bg-red-700"
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handlePhotoUpload(e, 'beforeMixing', 'acidity')}
                      className="hidden"
                      id="before-acidity-photo"
                      disabled={uploadingPhotos['beforeMixing-acidity']}
                    />
                    <label
                      htmlFor="before-acidity-photo"
                      className="btn btn-sm btn-ghost cursor-pointer"
                    >
                      <Camera className="h-4 w-4" />
                      ถ่ายรูป
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* After Mixing */}
          <div className="bg-green-900/20 border border-green-800/30 rounded-lg p-4">
            <h4 className="text-md font-medium text-green-400 mb-4 text-center">หลังผสม</h4>
            <div className="space-y-4">
              {/* Brix */}
              <div>
                <label className="label">Brix (°Bx)</label>
                <input
                  type="number"
                  value={qualityTests.afterMixing.brix || ''}
                  onChange={(e) => setQualityTests(prev => ({
                    ...prev,
                    afterMixing: { ...prev.afterMixing, brix: parseFloat(e.target.value) || 0 }
                  }))}
                  className="input mb-2"
                  step="0.1"
                  placeholder="0.0"
                />
                
                {qualityTests.afterMixing.brixPhoto ? (
                  <div className="relative inline-block">
                    <img 
                      src={qualityTests.afterMixing.brixPhoto} 
                      alt="Brix test"
                      className="h-20 w-20 object-cover rounded border border-gray-600"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto('afterMixing', 'brix')}
                      className="absolute -top-2 -right-2 p-1 bg-red-600 rounded-full hover:bg-red-700"
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handlePhotoUpload(e, 'afterMixing', 'brix')}
                      className="hidden"
                      id="after-brix-photo"
                      disabled={uploadingPhotos['afterMixing-brix']}
                    />
                    <label
                      htmlFor="after-brix-photo"
                      className="btn btn-sm btn-ghost cursor-pointer"
                    >
                      <Camera className="h-4 w-4" />
                      ถ่ายรูป
                    </label>
                  </div>
                )}
              </div>

              {/* Acidity */}
              <div>
                <label className="label">Acidity (%)</label>
                <input
                  type="number"
                  value={qualityTests.afterMixing.acidity || ''}
                  onChange={(e) => setQualityTests(prev => ({
                    ...prev,
                    afterMixing: { ...prev.afterMixing, acidity: parseFloat(e.target.value) || 0 }
                  }))}
                  className="input mb-2"
                  step="0.01"
                  placeholder="0.00"
                />
                
                {qualityTests.afterMixing.acidityPhoto ? (
                  <div className="relative inline-block">
                    <img 
                      src={qualityTests.afterMixing.acidityPhoto} 
                      alt="Acidity test"
                      className="h-20 w-20 object-cover rounded border border-gray-600"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto('afterMixing', 'acidity')}
                      className="absolute -top-2 -right-2 p-1 bg-red-600 rounded-full hover:bg-red-700"
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handlePhotoUpload(e, 'afterMixing', 'acidity')}
                      className="hidden"
                      id="after-acidity-photo"
                      disabled={uploadingPhotos['afterMixing-acidity']}
                    />
                    <label
                      htmlFor="after-acidity-photo"
                      className="btn btn-sm btn-ghost cursor-pointer"
                    >
                      <Camera className="h-4 w-4" />
                      ถ่ายรูป
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="card">
        <label className="label">หมายเหตุการผลิต</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="input resize-none"
          placeholder="บันทึกปัญหาหรือข้อสังเกตระหว่างการผลิต..."
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="btn btn-primary flex-1"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              กำลังบันทึก...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4" />
              บันทึกการผลิต
            </>
          )}
        </button>
        
        <button
          onClick={onCancel}
          disabled={submitting}
          className="btn btn-ghost"
        >
          ยกเลิก
        </button>
      </div>
    </div>
  );
}