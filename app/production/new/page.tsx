// Path: app/production/new/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import {
  Factory, ArrowLeft, AlertTriangle, Package,
  Plus, Minus, Calculator, CheckCircle, Calendar
} from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { getImageUrl } from '@/lib/utils/image';

// Types
interface Product {
  id: string;
  name: string;
  image?: string;
}

interface BottleType {
  id: string;
  size: string;
  stock: number;
  capacity_ml?: number;
}

// Helper function to parse size string to ml
function parseSizeToMl(size: string): number {
  const lower = size.toLowerCase();
  // Extract number from string
  const match = lower.match(/(\d+(?:\.\d+)?)/);
  if (!match) return 0;

  const num = parseFloat(match[1]);

  // Check unit
  if (lower.includes('l') && !lower.includes('ml')) {
    return num * 1000; // liters to ml
  }
  return num; // assume ml
}

interface RawMaterial {
  id: string;
  name: string;
  current_stock: number;
  unit: string;
  average_price: number;
}

interface ProductRecipe {
  raw_material_id: string;
  quantity_per_unit: number;
  raw_materials?: RawMaterial;
}

interface PlannedItem {
  bottle_type_id: string;
  quantity: number;
}

interface MaterialRequirement {
  material: RawMaterial;
  required: number;
  available: number;
  remaining: number;
  cost: number;
  sufficient: boolean;
}

export default function NewProductionPage() {
  const router = useRouter();
  const { session } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [bottleTypes, setBottleTypes] = useState<BottleType[]>([]);
  const [recipes, setRecipes] = useState<ProductRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [plannedDate, setPlannedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [plannedItems, setPlannedItems] = useState<PlannedItem[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [generatedBatchId, setGeneratedBatchId] = useState<string>('');

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch products
        const { data: productsData } = await supabase
          .from('products')
          .select('id, name, image')
          .order('name');

        // Fetch bottle types
        const { data: bottlesData } = await supabase
          .from('bottle_types')
          .select('id, size, stock')
          .order('size');

        setProducts(productsData || []);
        setBottleTypes(bottlesData || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (session?.access_token) {
      fetchData();
      generateBatchId();
    }
  }, [session?.access_token]);

  // Fetch recipes when product is selected
  useEffect(() => {
    const fetchRecipes = async () => {
      if (!selectedProductId) {
        setRecipes([]);
        return;
      }

      console.log('Fetching recipes for product:', selectedProductId);

      const { data, error } = await supabase
        .from('product_recipes')
        .select(`
          raw_material_id,
          quantity_per_unit,
          raw_materials (id, name, current_stock, unit, average_price)
        `)
        .eq('product_id', selectedProductId);

      if (error) {
        console.error('Error fetching recipes:', error.message, error.code, error.details);
      } else {
        console.log('Recipes fetched:', data);
      }

      // Transform the data to match ProductRecipe type
      const transformedRecipes = (data || []).map((item: any) => ({
        raw_material_id: item.raw_material_id,
        quantity_per_unit: item.quantity_per_unit,
        raw_materials: Array.isArray(item.raw_materials) ? item.raw_materials[0] : item.raw_materials
      }));

      setRecipes(transformedRecipes);
    };

    fetchRecipes();
  }, [selectedProductId]);

  // Generate batch ID
  const generateBatchId = async () => {
    try {
      const response = await fetch('/api/production/generate-batch-id', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });
      const data = await response.json();
      setGeneratedBatchId(data.batch_id || `BATCH-${new Date().getFullYear()}-0001`);
    } catch {
      // Fallback batch ID
      setGeneratedBatchId(`BATCH-${new Date().getFullYear()}-0001`);
    }
  };

  // Calculate total volume in liters
  const calculateTotalVolume = (): number => {
    return plannedItems.reduce((total, item) => {
      const bottle = bottleTypes.find(b => b.id === item.bottle_type_id);
      if (bottle) {
        const capacityMl = bottle.capacity_ml || parseSizeToMl(bottle.size);
        return total + (capacityMl * item.quantity) / 1000;
      }
      return total;
    }, 0);
  };

  // Calculate material requirements
  const calculateMaterialRequirements = (): MaterialRequirement[] => {
    const totalLiters = calculateTotalVolume();

    return recipes.map(recipe => {
      const material = recipe.raw_materials as RawMaterial;
      const required = recipe.quantity_per_unit * totalLiters;
      const remaining = material.current_stock - required;
      const cost = required * material.average_price;

      return {
        material,
        required,
        available: material.current_stock,
        remaining,
        cost,
        sufficient: remaining >= 0
      };
    });
  };

  // Add bottle type to plan
  const addBottleType = (bottleTypeId: string) => {
    const exists = plannedItems.find(item => item.bottle_type_id === bottleTypeId);
    if (!exists) {
      setPlannedItems([...plannedItems, { bottle_type_id: bottleTypeId, quantity: 0 }]);
    }
  };

  // Update quantity
  const updateQuantity = (bottleTypeId: string, quantity: number) => {
    setPlannedItems(items =>
      items.map(item =>
        item.bottle_type_id === bottleTypeId
          ? { ...item, quantity: Math.max(0, quantity) }
          : item
      )
    );
  };

  // Remove bottle type
  const removeBottleType = (bottleTypeId: string) => {
    setPlannedItems(items => items.filter(item => item.bottle_type_id !== bottleTypeId));
  };

  // Submit production plan
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProductId) {
      setError('กรุณาเลือกสินค้า');
      return;
    }

    const validItems = plannedItems.filter(item => item.quantity > 0);
    if (validItems.length === 0) {
      setError('กรุณาระบุจำนวนขวดที่ต้องการผลิตอย่างน้อย 1 ขนาด');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/production', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          batch_id: generatedBatchId,
          product_id: selectedProductId,
          planned_date: plannedDate,
          planned_items: validItems,
          planned_notes: notes || undefined
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create production plan');
      }

      // Show warning if materials insufficient but still allow creation
      if (result.has_warning && result.insufficient_materials) {
        alert(`⚠️ ${result.message}\n\nวัตถุดิบที่ขาด:\n${JSON.parse(result.insufficient_materials).map((m: any) =>
          `- ${m.material_name}: ต้องการ ${m.required} ${m.unit}, มี ${m.available} ${m.unit} (ขาด ${m.shortage} ${m.unit})`
        ).join('\n')}\n\nกรุณาซื้อวัตถุดิบเพิ่มก่อนเริ่มผลิต`);
      }

      // Redirect to production list
      router.push('/production');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const totalVolume = calculateTotalVolume();
  const materialRequirements = calculateMaterialRequirements();
  const totalCost = materialRequirements.reduce((sum, req) => sum + req.cost, 0);
  const allMaterialsSufficient = materialRequirements.every(req => req.sufficient);
  const totalBottles = plannedItems.reduce((sum, item) => sum + item.quantity, 0);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-[#E9B308]">Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push('/production')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Factory className="w-8 h-8 text-[#E9B308]" />
            วางแผนการผลิต
          </h1>
          <p className="text-gray-600 text-base">สร้างแผนการผลิตใหม่</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg flex items-start gap-2 text-base">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Planning Form */}
          <div className="space-y-6">
            {/* Batch ID */}
            <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Batch ID</h2>
              <div className="bg-[#E9B308]/10 border border-[#E9B308] rounded-lg p-4 text-center">
                <span className="text-2xl font-bold text-gray-900">{generatedBatchId}</span>
              </div>
            </div>

            {/* Product Selection */}
            <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">เลือกสินค้า</h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {products.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => setSelectedProductId(product.id)}
                    className={`cursor-pointer rounded-lg border-2 p-2 transition-all ${
                      selectedProductId === product.id
                        ? 'border-[#E9B308] bg-[#E9B308]/10'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="aspect-square mb-1 rounded overflow-hidden bg-gray-100">
                      {product.image ? (
                        <img
                          src={getImageUrl(product.image)}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs font-medium text-gray-900 truncate text-center">
                      {product.name}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Production Date */}
            <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                วันที่ผลิต
              </h2>
              <input
                type="date"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
                className="w-full bg-white border border-gray-300 text-gray-900 px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] focus:border-transparent text-base"
                required
              />
            </div>

            {/* Bottle Quantities */}
            <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">จำนวนที่ต้องการผลิต</h2>

              {/* Add bottle type buttons */}
              {bottleTypes.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-4">
                  {bottleTypes.map((bottle) => {
                    const isAdded = plannedItems.some(item => item.bottle_type_id === bottle.id);
                    return (
                      <button
                        key={bottle.id}
                        type="button"
                        onClick={() => addBottleType(bottle.id)}
                        disabled={isAdded}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          isAdded
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-[#E9B308] text-[#00231F] hover:bg-[#d4a307]'
                        }`}
                      >
                        <Plus className="w-4 h-4 inline mr-1" />
                        {bottle.size}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                  ยังไม่มีข้อมูลขวด กรุณาเพิ่มขวดในหน้าจัดการขวดก่อน
                </div>
              )}

              {/* Quantity inputs */}
              <div className="space-y-3">
                {plannedItems.map((item) => {
                  const bottle = bottleTypes.find(b => b.id === item.bottle_type_id);
                  if (!bottle) return null;

                  return (
                    <div key={item.bottle_type_id} className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
                      <span className="font-medium text-gray-900 min-w-[80px]">{bottle.size}</span>
                      <div className="flex items-center gap-2 flex-1">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.bottle_type_id, item.quantity - 10)}
                          className="p-1 bg-gray-200 rounded hover:bg-gray-300"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.bottle_type_id, parseInt(e.target.value) || 0)}
                          className="w-24 text-center bg-white border border-gray-300 rounded px-2 py-1"
                        />
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.bottle_type_id, item.quantity + 10)}
                          className="p-1 bg-gray-200 rounded hover:bg-gray-300"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <span className="text-gray-500 text-sm">ขวด</span>
                        <span className="text-xs text-gray-400">(Stock: {bottle.stock})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeBottleType(item.bottle_type_id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}

                {plannedItems.length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-4">
                    คลิกปุ่มด้านบนเพื่อเพิ่มขนาดขวดที่ต้องการผลิต
                  </p>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">หมายเหตุ</h2>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full bg-white border border-gray-300 text-gray-900 px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] focus:border-transparent resize-none text-base"
                placeholder="ระบุรายละเอียดเพิ่มเติม..."
              />
            </div>
          </div>

          {/* Right Column - Summary */}
          <div className="space-y-6">
            {/* Production Summary */}
            <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Calculator className="w-5 h-5" />
                สรุปการผลิต
              </h2>

              {selectedProduct ? (
                <div className="space-y-4">
                  {/* Selected Product */}
                  <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
                    {selectedProduct.image ? (
                      <img
                        src={getImageUrl(selectedProduct.image)}
                        alt={selectedProduct.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                        <Package className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-gray-900">{selectedProduct.name}</p>
                      <p className="text-sm text-gray-500">Batch: {generatedBatchId}</p>
                    </div>
                  </div>

                  {/* Quantities */}
                  <div className="border-t pt-4">
                    <h3 className="font-medium text-gray-700 mb-2">จำนวนที่จะผลิต</h3>
                    {plannedItems.filter(item => item.quantity > 0).map((item) => {
                      const bottle = bottleTypes.find(b => b.id === item.bottle_type_id);
                      return (
                        <div key={item.bottle_type_id} className="flex justify-between text-sm py-1">
                          <span>{bottle?.size}</span>
                          <span className="font-medium">{item.quantity.toLocaleString()} ขวด</span>
                        </div>
                      );
                    })}
                    <div className="flex justify-between font-semibold mt-2 pt-2 border-t">
                      <span>รวมทั้งหมด</span>
                      <span>{totalBottles.toLocaleString()} ขวด</span>
                    </div>
                  </div>

                  {/* Total Volume */}
                  <div className="bg-[#E9B308]/10 border border-[#E9B308] rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">ปริมาณน้ำที่ต้องใช้</span>
                      <span className="text-xl font-bold text-[#00231F]">
                        {totalVolume.toFixed(2)} ลิตร
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">กรุณาเลือกสินค้าก่อน</p>
              )}
            </div>

            {/* Material Requirements */}
            <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">วัตถุดิบที่ต้องใช้</h2>

              {materialRequirements.length > 0 ? (
                <div className="space-y-3">
                  {materialRequirements.map((req) => (
                    <div
                      key={req.material.id}
                      className={`p-3 rounded-lg border ${
                        req.sufficient
                          ? 'bg-green-50 border-green-200'
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium">{req.material.name}</span>
                        {req.sufficient ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-red-600" />
                        )}
                      </div>
                      <div className="text-sm space-y-0.5">
                        <div className="flex justify-between">
                          <span className="text-gray-600">ต้องใช้:</span>
                          <span className="font-medium">{req.required.toFixed(2)} {req.material.unit}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">คงเหลือ:</span>
                          <span>{req.available.toFixed(2)} {req.material.unit}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">หลังผลิต:</span>
                          <span className={req.sufficient ? 'text-green-600' : 'text-red-600'}>
                            {req.remaining.toFixed(2)} {req.material.unit}
                          </span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-gray-200">
                          <span className="text-gray-600">ต้นทุน:</span>
                          <span className="font-medium">฿{req.cost.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Total Cost */}
                  <div className="bg-gray-100 rounded-lg p-4 mt-4">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">ต้นทุนวัตถุดิบโดยประมาณ</span>
                      <span className="text-xl font-bold">฿{totalCost.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">
                  {selectedProductId
                    ? 'ยังไม่มีสูตรวัตถุดิบสำหรับสินค้านี้'
                    : 'กรุณาเลือกสินค้าก่อน'}
                </p>
              )}
            </div>

            {/* Submit Buttons */}
            <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
              {!allMaterialsSufficient && materialRequirements.length > 0 && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg flex items-start gap-2 text-sm">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <span>วัตถุดิบไม่เพียงพอ กรุณาเติมสต็อกก่อนดำเนินการผลิต</span>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => router.push('/production')}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-base"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedProductId || totalBottles === 0}
                  className="flex-1 bg-[#E9B308] text-[#00231F] px-6 py-3 rounded-lg font-semibold hover:bg-[#d4a307] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base"
                >
                  {submitting ? 'กำลังบันทึก...' : 'สร้างแผนการผลิต'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </Layout>
  );
}
