// src/components/production/PlanningForm.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { 
  collection, getDocs, query, where, orderBy
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  Loader2, AlertCircle, Calendar,
  TrendingUp, TrendingDown, Activity
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Product, MaterialRequirement } from '@/types/production';
import { BottleType } from '@/types/bottle';
import ProductSelector from '@/components/production/ProductSelector';
import BottleQuantityInput from '@/components/production/BottleQuantityInput';
import MaterialRequirementCard, { MaterialRequirementDisplay } from '@/components/production/MaterialRequirementCard';

interface PlanningFormProps {
  initialData?: {
    batchId: string;
    productId: string;
    productName: string;
    productionDate: string;
    plannedBottles: Record<string, number>;
    totalJuiceNeeded: number;
    materialRequirements: Record<string, MaterialRequirement>;
    notes?: string;
  };
  onSubmit: (data: PlanningFormData) => Promise<void>;
  onCancel: () => void;
  isEdit?: boolean;
  loading?: boolean;
}

export interface PlanningFormData {
  batchId: string;
  productId: string;
  productName: string;
  productionDate: string;
  plannedBottles: Record<string, number>;
  totalJuiceNeeded: number;
  materialRequirements: Record<string, MaterialRequirement>;
  notes?: string;
}

export default function PlanningForm({
  initialData,
  onSubmit,
  onCancel,
  isEdit = false,
  loading = false
}: PlanningFormProps) {
  const { user: currentUser } = useAuth();
  const [loadingMasterData, setLoadingMasterData] = useState(true);
  
  // Form data
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productionDate, setProductionDate] = useState<string>('');
  const [bottleQuantities, setBottleQuantities] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  
  // Master data
  const [products, setProducts] = useState<Product[]>([]);
  const [bottleTypes, setBottleTypes] = useState<BottleType[]>([]);
  const [materialRequirements, setMaterialRequirements] = useState<MaterialRequirementDisplay[]>([]);
  
  // Calculations
  const [totalJuiceNeeded, setTotalJuiceNeeded] = useState(0);
  const [batchId, setBatchId] = useState('');
  const [materialStats, setMaterialStats] = useState<Record<string, {
    min: number;
    max: number;
    avg: number;
    lastBatches: number;
  }>>({});

  // Initialize form data
  useEffect(() => {
    if (initialData) {
      setBatchId(initialData.batchId);
      setProductionDate(initialData.productionDate);
      setBottleQuantities(initialData.plannedBottles);
      setTotalJuiceNeeded(initialData.totalJuiceNeeded);
      setNotes(initialData.notes || '');
      
      // Find and set the selected product
      if (products.length > 0) {
        const product = products.find(p => p.id === initialData.productId);
        if (product) {
          setSelectedProduct(product);
        }
      }
    } else {
      // Set default production date to today for new plans
      const today = new Date().toISOString().split('T')[0];
      setProductionDate(today);
    }
  }, [initialData, products]);

  // Load master data
  useEffect(() => {
    loadMasterData();
  }, []);

  // Generate Batch ID when product and date change (only for new plans)
  useEffect(() => {
    if (!isEdit && selectedProduct && productionDate) {
      generateBatchId();
    }
  }, [selectedProduct, productionDate, isEdit]);

  // Calculate requirements when selection changes
  useEffect(() => {
    if (selectedProduct && Object.keys(bottleQuantities).length > 0) {
      const hasAnyQuantity = Object.values(bottleQuantities).some(qty => qty > 0);
      if (hasAnyQuantity) {
        calculateRequirements();
      }
    }
  }, [selectedProduct, bottleQuantities]);

  const loadMasterData = async () => {
    try {
      setLoadingMasterData(true);
      
      // Load products from database
      const productsQuery = query(
        collection(db, 'products'),
        where('isActive', '==', true),
        orderBy('name', 'asc')
      );
      
      const productsSnapshot = await getDocs(productsQuery);
      const productsData: Product[] = [];
      
      productsSnapshot.forEach((doc) => {
        const data = doc.data();
        productsData.push({
          id: doc.id,
          name: data.name,
          nameEn: data.nameEn,
          category: data.category,
          rawMaterials: data.rawMaterials || [],
          averageRatios: data.averageRatios,
          imageUrl: data.imageUrl,
          isActive: data.isActive !== false,
          createdAt: data.createdAt?.toDate() || new Date(),
          createdBy: data.createdBy,
          updatedAt: data.updatedAt?.toDate(),
          updatedBy: data.updatedBy
        });
      });
      
      setProducts(productsData);

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
      
      // Initialize bottle quantities if not editing
      if (!initialData) {
        const initialQuantities: Record<string, number> = {};
        bottlesData.forEach(bottle => {
          initialQuantities[bottle.id] = 0;
        });
        setBottleQuantities(initialQuantities);
      }

    } catch (error) {
      console.error('Error loading master data:', error);
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoadingMasterData(false);
    }
  };

  const generateBatchId = async () => {
    if (!selectedProduct || !productionDate) return;

    // Get product code from name (first 2 letters of English name)
    // Avoid confusing characters: O (use P), I (use J), 0 (use 2), 1 (use 3)
    const productCode = selectedProduct.nameEn
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .replace(/O/g, 'P')  // O → P
      .replace(/I/g, 'J')  // I → J
      .replace(/0/g, '2')  // 0 → 2
      .replace(/1/g, '3')  // 1 → 3
      .slice(0, 2) || 'PR';
    
    // Generate random alphanumeric string (6 characters)
    // Avoid confusing characters: 0, O, 1, I, l
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let randomStr = '';
    for (let i = 0; i < 6; i++) {
      randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Check if this batch ID already exists
    try {
      let batchIdToCheck = `${productCode}${randomStr}`;
      
      // Keep generating until we get a unique one
      const batchesQuery = query(
        collection(db, 'production_batches'),
        where('batchId', '==', batchIdToCheck)
      );
      
      let batchesSnapshot = await getDocs(batchesQuery);
      
      // If exists, generate new one (unlikely but possible)
      while (!batchesSnapshot.empty) {
        randomStr = '';
        for (let i = 0; i < 6; i++) {
          randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        batchIdToCheck = `${productCode}${randomStr}`;
        
        const newQuery = query(
          collection(db, 'production_batches'),
          where('batchId', '==', batchIdToCheck)
        );
        batchesSnapshot = await getDocs(newQuery);
      }
      
      setBatchId(batchIdToCheck);
    } catch (error) {
      console.error('Error generating batch ID:', error);
      // Fallback - just use what we generated
      setBatchId(`${productCode}${randomStr}`);
    }
  };

  const loadMaterialStats = async (product: Product) => {
    if (!product.rawMaterials || product.rawMaterials.length === 0) return;

    const stats: Record<string, any> = {};

    // If product has averageRatios, use them
    if (product.averageRatios) {
      Object.entries(product.averageRatios).forEach(([material, ratios]) => {
        stats[material] = {
          min: ratios.minPerLiter,
          max: ratios.maxPerLiter,
          avg: ratios.avgPerLiter,
          lastBatches: ratios.totalBatches
        };
      });
    } else {
      // Otherwise use default values
      product.rawMaterials.forEach(material => {
        stats[material] = {
          min: 1.8,
          max: 2.2,
          avg: 2.0,
          lastBatches: 0
        };
      });
    }

    setMaterialStats(stats);
  };

  const calculateRequirements = async () => {
    if (!selectedProduct) return;

    try {
      // Load material stats
      await loadMaterialStats(selectedProduct);

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

      // Calculate raw material needed based on product's raw materials
      const requirements: MaterialRequirementDisplay[] = [];
      
      // Check if rawMaterials exists and is an array
      const materials = selectedProduct.rawMaterials || [];
      
      if (materials.length === 0 || totalLiters === 0) {
        setMaterialRequirements([]);
        return;
      }

      for (const materialType of materials) {
        // Get ratio from stats or use default
        const stats = materialStats[materialType];
        const ratioPerLiter = stats?.avg || 2;
        const materialNeeded = totalLiters * ratioPerLiter;

        // Check inventory availability (FIFO)
        try {
          const inventoryQuery = query(
            collection(db, 'inventory_batches'),
            where('materialType', '==', materialType),
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

          requirements.push({
            materialType: materialType,
            requiredQuantity: materialNeeded,
            availableQuantity: availableQuantity,
            estimatedCost: estimatedCost,
            isEnough: availableQuantity >= materialNeeded
          });

        } catch (error) {
          console.error(`Error checking inventory for ${materialType}:`, error);
          requirements.push({
            materialType: materialType,
            requiredQuantity: materialNeeded,
            availableQuantity: 0,
            estimatedCost: 0,
            isEnough: false
          });
        }
      }

      setMaterialRequirements(requirements);
    } catch (error) {
      console.error('Error in calculateRequirements:', error);
      // Don't show error toast here as it might be called frequently
    }
  };

  const handleQuantityChange = (bottleId: string, quantity: number) => {
    setBottleQuantities(prev => ({
      ...prev,
      [bottleId]: quantity
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProduct) {
      toast.error('กรุณาเลือกผลิตภัณฑ์');
      return;
    }

    if (!productionDate) {
      toast.error('กรุณาเลือกวันที่ผลิต');
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

    // Build material requirements
    const materialReqs: Record<string, MaterialRequirement> = {};
    materialRequirements.forEach(req => {
      materialReqs[req.materialType] = {
        quantity: req.requiredQuantity,
        estimatedCost: currentUser?.role === 'admin' ? req.estimatedCost : undefined
      };
    });

    const formData: PlanningFormData = {
      batchId,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      productionDate: productionDate,
      plannedBottles: bottleQuantities,
      totalJuiceNeeded: totalJuiceNeeded,
      materialRequirements: materialReqs,
      ...(notes.trim() && { notes: notes.trim() }) // Only include notes if not empty
    };

    await onSubmit(formData);
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

  if (loadingMasterData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
          <p className="mt-4 text-gray-400">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Form */}
        <div className="space-y-6">
          {/* Products */}
          {products.length > 0 ? (
            <ProductSelector
              products={products}
              selectedProduct={selectedProduct}
              onSelectProduct={setSelectedProduct}
              disabled={loading || isEdit}
            />
          ) : (
            <div className="card">
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-yellow-400 mx-auto mb-3" />
                <p className="text-white font-medium mb-1">ยังไม่มีผลิตภัณฑ์</p>
                <p className="text-sm text-gray-400 mb-4">กรุณาเพิ่มผลิตภัณฑ์ก่อนวางแผนการผลิต</p>
              </div>
            </div>
          )}

          {/* Production Date */}
          <div className="card">
            <label className="label">
              <Calendar className="h-4 w-4 inline mr-1" />
              วันที่ผลิต *
            </label>
            <input
              type="date"
              value={productionDate}
              onChange={(e) => setProductionDate(e.target.value)}
              className="input"
              disabled={loading || isEdit}
            />
            <p className="mt-2 text-xs text-gray-500">
              {isEdit ? 'ไม่สามารถเปลี่ยนวันที่ผลิตได้' : 'Batch ID จะสร้างจากวันที่นี้'}
            </p>
          </div>

          {selectedProduct && (
            <BottleQuantityInput
              bottleTypes={bottleTypes}
              quantities={bottleQuantities}
              onQuantityChange={handleQuantityChange}
              disabled={loading}
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
              disabled={loading}
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
              <p className="text-sm text-gray-400 mt-1">
                วันที่ผลิต: {new Date(productionDate).toLocaleDateString('th-TH', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
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

          {/* Material Requirements with Stats */}
          {materialRequirements.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold text-white mb-4">วัตถุดิบที่ต้องใช้</h3>
              
              <div className="space-y-4">
                {materialRequirements.map((req) => {
                  const stats = materialStats[req.materialType];
                  
                  return (
                    <div key={req.materialType}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-medium">{req.materialType}</span>
                        <span className={`text-sm ${req.isEnough ? 'text-green-400' : 'text-red-400'}`}>
                          {req.isEnough ? '✓ เพียงพอ' : '✗ ไม่พอ'}
                        </span>
                      </div>
                      
                      {/* Stats */}
                      {stats && stats.lastBatches > 0 && (
                        <div className="mb-2 p-2 bg-gray-800 rounded text-xs">
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                              <TrendingDown className="h-3 w-3 text-blue-400 inline mr-1" />
                              <span className="text-gray-400">ต่ำสุด</span>
                              <p className="text-white">{stats.min.toFixed(2)} kg/L</p>
                            </div>
                            <div>
                              <Activity className="h-3 w-3 text-green-400 inline mr-1" />
                              <span className="text-gray-400">เฉลี่ย</span>
                              <p className="text-white font-medium">{stats.avg.toFixed(2)} kg/L</p>
                            </div>
                            <div>
                              <TrendingUp className="h-3 w-3 text-red-400 inline mr-1" />
                              <span className="text-gray-400">สูงสุด</span>
                              <p className="text-white">{stats.max.toFixed(2)} kg/L</p>
                            </div>
                          </div>
                          <p className="text-center text-gray-500 mt-1">
                            จากประวัติ {stats.lastBatches} batch
                          </p>
                        </div>
                      )}
                      
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">ต้องใช้</span>
                          <span className="text-white">{req.requiredQuantity.toFixed(1)} kg</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">มีในสต็อก</span>
                          <span className={req.isEnough ? 'text-white' : 'text-red-400'}>
                            {req.availableQuantity.toFixed(1)} kg
                          </span>
                        </div>
                        {currentUser?.role === 'admin' && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">ต้นทุนโดยประมาณ</span>
                            <span className="text-white">
                              {new Intl.NumberFormat('th-TH', {
                                style: 'currency',
                                currency: 'THB',
                                minimumFractionDigits: 0
                              }).format(req.estimatedCost)}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {!req.isEnough && (
                        <div className="mt-2 p-2 bg-red-900/20 border border-red-600 rounded text-xs text-red-400">
                          <AlertCircle className="h-3 w-3 inline mr-1" />
                          ขาด {(req.requiredQuantity - req.availableQuantity).toFixed(1)} kg
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-8 pt-6 border-t border-gray-700">
            <button
              type="submit"
              disabled={loading || !selectedProduct || !productionDate || getTotalBottles() === 0}
              className="btn btn-primary flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                isEdit ? 'บันทึกการเปลี่ยนแปลง' : 'สร้างแผนการผลิต'
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
        </div>
      </div>
    </form>
  );
}