// src/app/(protected)/production/planning/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { 
  collection, getDocs, query, where, orderBy, 
  addDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  ArrowLeft, Loader2, FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Product, ProductionBatch, MaterialRequirement } from '@/types/production';
import { BottleType } from '@/types/bottle';
import ProductSelector from '@/components/production/ProductSelector';
import BottleQuantityInput from '@/components/production/BottleQuantityInput';
import MaterialRequirementCard, { MaterialRequirementDisplay } from '@/components/production/MaterialRequirementCard';

export default function ProductionPlanningPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Form data
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [bottleQuantities, setBottleQuantities] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  
  // Master data
  const [products, setProducts] = useState<Product[]>([]);
  const [bottleTypes, setBottleTypes] = useState<BottleType[]>([]);
  const [materialRequirements, setMaterialRequirements] = useState<MaterialRequirementDisplay[]>([]);
  
  // Calculations
  const [totalJuiceNeeded, setTotalJuiceNeeded] = useState(0);
  const [batchId, setBatchId] = useState('');

  // Check permission
  useEffect(() => {
    if (currentUser && currentUser.role === 'operation') {
      toast.error('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
      router.push('/dashboard');
    }
  }, [currentUser, router]);

  // Load master data
  useEffect(() => {
    loadMasterData();
  }, []);

  // Calculate requirements when selection changes
  useEffect(() => {
    if (selectedProduct && Object.keys(bottleQuantities).length > 0) {
      calculateRequirements();
    }
  }, [selectedProduct, bottleQuantities]);

  const loadMasterData = async () => {
    try {
      setLoading(true);
      
      // For now, use hardcoded product data
      const hardcodedProducts: Product[] = [
        {
          id: 'orange-juice',
          name: 'น้ำส้มคั้น',
          nameEn: 'Orange Juice',
          rawMaterialRatio: 2, // 2kg ส้ม ต่อ 1 ลิตรน้ำ
          bottleSizes: ['250ml', '350ml', '1000ml'],
          isActive: true
        }
      ];
      setProducts(hardcodedProducts);

      // Load bottle types
      const bottlesQuery = query(
        collection(db, 'bottle_types'),
        where('isActive', '==', true),
        orderBy('sizeInMl', 'asc')
      );
      
      const bottlesSnapshot = await getDocs(bottlesQuery);
      const bottlesData: BottleType[] = [];
      
      bottlesSnapshot.forEach((doc) => {
        const data = doc.data();
        bottlesData.push({
          id: doc.id,
          name: data.name || '',
          sizeInMl: data.sizeInMl || 0,
          pricePerUnit: data.pricePerUnit || 0,
          imageUrl: data.imageUrl,
          minStockLevel: data.minStockLevel,
          currentStock: data.currentStock || 0,
          isActive: data.isActive !== false,
          createdAt: data.createdAt?.toDate() || new Date(),
          createdBy: data.createdBy || '',
          updatedAt: data.updatedAt?.toDate(),
          updatedBy: data.updatedBy
        });
      });

      // If no bottles in DB, use defaults
      if (bottlesData.length === 0) {
        const defaultBottles: BottleType[] = [
          { 
            id: '250ml', 
            name: '250ml', 
            sizeInMl: 250, 
            pricePerUnit: 5, 
            currentStock: 1000, 
            isActive: true,
            createdAt: new Date(),
            createdBy: 'system'
          },
          { 
            id: '350ml', 
            name: '350ml', 
            sizeInMl: 350, 
            pricePerUnit: 7, 
            currentStock: 500, 
            isActive: true,
            createdAt: new Date(),
            createdBy: 'system'
          },
          { 
            id: '1000ml', 
            name: '1L', 
            sizeInMl: 1000, 
            pricePerUnit: 12, 
            currentStock: 200, 
            isActive: true,
            createdAt: new Date(),
            createdBy: 'system'
          }
        ];
        bottlesData.push(...defaultBottles);
      }
      
      setBottleTypes(bottlesData);
      
      // Initialize bottle quantities
      const initialQuantities: Record<string, number> = {};
      bottlesData.forEach(bottle => {
        initialQuantities[bottle.id] = 0;
      });
      setBottleQuantities(initialQuantities);

    } catch (error) {
      console.error('Error loading master data:', error);
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const calculateRequirements = async () => {
    if (!selectedProduct) return;

    // Calculate total juice needed
    let totalMl = 0;
    Object.entries(bottleQuantities).forEach(([bottleId, quantity]) => {
      const bottle = bottleTypes.find(b => b.id === bottleId);
      if (bottle && quantity > 0) {
        totalMl += bottle.sizeInMl * quantity;
      }
    });
    
    const totalLiters = totalMl / 1000;
    setTotalJuiceNeeded(totalLiters);

    // Calculate raw material needed
    const materialNeeded = totalLiters * selectedProduct.rawMaterialRatio;

    // Check inventory availability (FIFO)
    try {
      const inventoryQuery = query(
        collection(db, 'inventory_batches'),
        where('materialType', '==', 'ส้ม'), // Hardcoded for orange juice
        where('remainingQuantity', '>', 0),
        where('status', '==', 'active'),
        orderBy('createdAt', 'asc') // FIFO
      );

      const inventorySnapshot = await getDocs(inventoryQuery);
      
      let availableQuantity = 0;
      let estimatedCost = 0;
      let remainingNeeded = materialNeeded;

      inventorySnapshot.forEach((doc) => {
        const data = doc.data();
        availableQuantity += data.remainingQuantity;
        
        // Calculate cost using FIFO
        if (remainingNeeded > 0) {
          const useFromThisBatch = Math.min(remainingNeeded, data.remainingQuantity);
          estimatedCost += useFromThisBatch * data.pricePerUnit;
          remainingNeeded -= useFromThisBatch;
        }
      });

      const requirements: MaterialRequirementDisplay[] = [{
        materialType: 'ส้ม',
        requiredQuantity: materialNeeded,
        availableQuantity: availableQuantity,
        estimatedCost: estimatedCost,
        isEnough: availableQuantity >= materialNeeded
      }];

      setMaterialRequirements(requirements);

      // Generate Batch ID
      const date = new Date();
      const dateStr = date.toISOString().slice(2, 10).replace(/-/g, '');
      const sequence = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      const productCode = selectedProduct.nameEn === 'Orange Juice' ? 'OJ' : 'PR';
      setBatchId(`${productCode}${dateStr}${sequence}`);

    } catch (error) {
      console.error('Error calculating requirements:', error);
      toast.error('เกิดข้อผิดพลาดในการคำนวณ');
    }
  };

  const handleQuantityChange = (bottleId: string, quantity: number) => {
    setBottleQuantities(prev => ({
      ...prev,
      [bottleId]: quantity
    }));
  };

  const handleSubmit = async () => {
    if (!selectedProduct) {
      toast.error('กรุณาเลือกผลิตภัณฑ์');
      return;
    }

    const hasQuantity = Object.values(bottleQuantities).some(q => q > 0);
    if (!hasQuantity) {
      toast.error('กรุณาระบุจำนวนขวดที่ต้องการผลิต');
      return;
    }

    // Check material availability
    const hasShortage = materialRequirements.some(req => !req.isEnough);
    if (hasShortage) {
      const confirm = window.confirm('วัตถุดิบไม่เพียงพอ ต้องการดำเนินการต่อหรือไม่?');
      if (!confirm) return;
    }

    try {
      setSubmitting(true);

      // Build material requirements
      const materialReqs: Record<string, MaterialRequirement> = {};
      materialRequirements.forEach(req => {
        materialReqs[req.materialType] = {
          quantity: req.requiredQuantity,
          estimatedCost: currentUser?.role === 'admin' ? req.estimatedCost : undefined
        };
      });

      // Create production batch
      const productionData = {
        batchId,
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        status: 'planned',
        
        // Planning data
        plannedBottles: bottleQuantities,
        totalJuiceNeeded: totalJuiceNeeded,
        materialRequirements: materialReqs,
        
        // Metadata
        plannedBy: currentUser?.uid || '',
        plannedByName: currentUser?.name || '',
        plannedAt: serverTimestamp(),
        notes: notes || ''
      };

      await addDoc(collection(db, 'production_batches'), productionData);

      toast.success(`สร้าง Batch ${batchId} สำเร็จ!`);
      
      // TODO: Generate and print labels
      handlePrintLabels();
      
      // Reset form
      router.push('/production');
      
    } catch (error) {
      console.error('Error creating production batch:', error);
      toast.error('เกิดข้อผิดพลาดในการสร้าง Batch');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintLabels = () => {
    // TODO: Implement label printing
    toast.success('กำลังพิมพ์ label...');
  };

  const getTotalBottles = () => {
    return Object.values(bottleQuantities).reduce((sum, qty) => sum + qty, 0);
  };

  const getBottlesSummary = () => {
    return Object.entries(bottleQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([bottleId, qty]) => {
        const bottle = bottleTypes.find(b => b.id === bottleId);
        return `${bottle?.name}: ${qty}`;
      })
      .join(', ');
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
          onClick={() => router.push('/production')}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          กลับ
        </button>
        
        <h1 className="text-2xl font-bold text-white mb-2">วางแผนการผลิต</h1>
        <p className="text-gray-400">สร้าง Batch ID และคำนวณวัตถุดิบที่ต้องใช้</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Form */}
        <div className="space-y-6">
          <ProductSelector
            products={products}
            selectedProduct={selectedProduct}
            onSelectProduct={setSelectedProduct}
            disabled={submitting}
          />

          {selectedProduct && (
            <BottleQuantityInput
              bottleTypes={bottleTypes}
              quantities={bottleQuantities}
              onQuantityChange={handleQuantityChange}
              disabled={submitting}
            />
          )}

          {/* Notes */}
          <div className="card">
            <label className="label">หมายเหตุ</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="input resize-none"
              placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
              disabled={submitting}
            />
          </div>
        </div>

        {/* Right Column - Summary */}
        <div className="space-y-6">
          {/* Batch Info */}
          {batchId && (
            <div className="card bg-primary/10 border border-primary/30">
              <h3 className="text-sm font-medium text-primary mb-2">Batch ID</h3>
              <p className="text-2xl font-mono font-bold text-white">{batchId}</p>
            </div>
          )}

          {/* Production Summary */}
          {selectedProduct && totalJuiceNeeded > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold text-white mb-4">สรุปการผลิต</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">ผลิตภัณฑ์</span>
                  <span className="text-white font-medium">{selectedProduct.name}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-400">จำนวนขวดรวม</span>
                  <span className="text-white font-medium">{getTotalBottles()} ขวด</span>
                </div>
                
                {getBottlesSummary() && (
                  <div className="text-sm text-gray-500">
                    {getBottlesSummary()}
                  </div>
                )}
                
                <div className="flex justify-between pt-3 border-t border-gray-700">
                  <span className="text-gray-400">น้ำที่ต้องใช้</span>
                  <span className="text-white font-medium">{totalJuiceNeeded.toFixed(1)} ลิตร</span>
                </div>
              </div>
            </div>
          )}

          {/* Material Requirements */}
          <MaterialRequirementCard requirements={materialRequirements} />

          {/* Actions */}
          {selectedProduct && totalJuiceNeeded > 0 && (
            <div className="space-y-3">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="btn btn-primary w-full"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    กำลังสร้าง Batch...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    สร้าง Batch และพิมพ์ Label
                  </>
                )}
              </button>
              
              <button
                onClick={() => router.push('/production')}
                disabled={submitting}
                className="btn btn-ghost w-full"
              >
                ยกเลิก
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}