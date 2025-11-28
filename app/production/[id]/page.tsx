// Path: app/production/[id]/page.tsx
'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  Factory, ArrowLeft, AlertTriangle, Package,
  Play, CheckCircle, XCircle, Clock, Calendar,
  Beaker, Camera, Plus, Minus, Save, Trash2
} from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { getImageUrl } from '@/lib/utils/image';

// Types
interface PlannedItem {
  bottle_type_id: string;
  quantity: number;
}

interface ActualItem {
  bottle_type_id: string;
  quantity: number;
  defects: number;
}

interface ActualMaterial {
  material_id: string;
  quantity_used: number;
}

interface BottleType {
  id: string;
  size: string;
  stock: number;
  capacity_ml: number;
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

interface ProductionBatch {
  id: string;
  batch_id: string;
  product_id: string;
  planned_date: string;
  planned_items: PlannedItem[];
  planned_notes?: string;
  planned_at: string;
  actual_items?: ActualItem[];
  actual_materials?: ActualMaterial[];
  brix_before?: number;
  brix_after?: number;
  acidity_before?: number;
  acidity_after?: number;
  quality_images?: string[];
  execution_notes?: string;
  status: string;
  started_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  cancelled_reason?: string;
  total_material_cost?: number;
  total_bottle_cost?: number;
  unit_cost?: number; // deprecated - for backward compatibility
  unit_cost_per_ml?: number;
  total_volume_ml?: number;
  cost_breakdown?: any;
}

interface Product {
  id: string;
  name: string;
  image?: string;
}

export default function ProductionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { session, userProfile } = useAuth();

  const [batch, setBatch] = useState<ProductionBatch | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [bottleTypes, setBottleTypes] = useState<BottleType[]>([]);
  const [recipes, setRecipes] = useState<ProductRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Execution form state
  const [actualItems, setActualItems] = useState<ActualItem[]>([]);
  const [actualMaterials, setActualMaterials] = useState<ActualMaterial[]>([]);
  const [brixBefore, setBrixBefore] = useState<string>('');
  const [brixAfter, setBrixAfter] = useState<string>('');
  const [acidityBefore, setAcidityBefore] = useState<string>('');
  const [acidityAfter, setAcidityAfter] = useState<string>('');
  const [executionNotes, setExecutionNotes] = useState<string>('');
  const [cancelReason, setCancelReason] = useState<string>('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Fetch batch details
  useEffect(() => {
    const fetchBatch = async () => {
      try {
        const response = await fetch(`/api/production/${resolvedParams.id}`, {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`
          }
        });

        if (!response.ok) throw new Error('Failed to fetch batch');

        const data = await response.json();
        setBatch(data.batch);
        setProduct(data.product);
        setBottleTypes(data.bottle_types || []);
        setRecipes(data.recipes || []);

        // Initialize actual items from planned items
        if (data.batch.planned_items) {
          setActualItems(
            data.batch.planned_items.map((item: PlannedItem) => ({
              bottle_type_id: item.bottle_type_id,
              quantity: item.quantity,
              defects: 0
            }))
          );
        }

        // Initialize actual materials from recipes
        if (data.recipes && data.recipes.length > 0) {
          const totalLiters = calculateTotalVolume(data.batch.planned_items, data.bottle_types);
          setActualMaterials(
            data.recipes.map((recipe: ProductRecipe) => ({
              material_id: recipe.raw_material_id,
              quantity_used: recipe.quantity_per_unit * totalLiters
            }))
          );
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (session?.access_token) {
      fetchBatch();
    }
  }, [session?.access_token, resolvedParams.id]);

  // Calculate total volume
  const calculateTotalVolume = (items: PlannedItem[], bottles: BottleType[]): number => {
    return items.reduce((total, item) => {
      const bottle = bottles.find(b => b.id === item.bottle_type_id);
      if (bottle) {
        return total + (bottle.capacity_ml * item.quantity) / 1000;
      }
      return total;
    }, 0);
  };

  // Handle start production
  const handleStart = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/production/${resolvedParams.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ action: 'start' })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error);
      }

      setBatch(result.batch);
      setSuccess('เริ่มการผลิตแล้ว');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle complete production
  const handleComplete = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/production/${resolvedParams.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          action: 'complete',
          actual_items: actualItems,
          actual_materials: actualMaterials,
          brix_before: brixBefore ? parseFloat(brixBefore) : undefined,
          brix_after: brixAfter ? parseFloat(brixAfter) : undefined,
          acidity_before: acidityBefore ? parseFloat(acidityBefore) : undefined,
          acidity_after: acidityAfter ? parseFloat(acidityAfter) : undefined,
          execution_notes: executionNotes || undefined
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error);
      }

      setBatch(result.batch);
      setSuccess('บันทึกการผลิตเสร็จสิ้น');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle cancel production
  const handleCancel = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/production/${resolvedParams.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          action: 'cancel',
          reason: cancelReason
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error);
      }

      setBatch(result.batch);
      setSuccess('ยกเลิกการผลิตแล้ว');
      setShowCancelModal(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle delete production batch (Admin only)
  const handleDelete = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/production/${resolvedParams.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error);
      }

      setSuccess('ลบข้อมูลการผลิตสำเร็จ');
      setShowDeleteModal(false);

      // Redirect to production list after 1 second
      setTimeout(() => {
        router.push('/production');
      }, 1000);
    } catch (err: any) {
      setError(err.message);
      setShowDeleteModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  // Update actual item quantity
  const updateActualQuantity = (bottleTypeId: string, quantity: number) => {
    setActualItems(items =>
      items.map(item =>
        item.bottle_type_id === bottleTypeId
          ? { ...item, quantity: Math.max(0, quantity) }
          : item
      )
    );
  };

  // Update defects
  const updateDefects = (bottleTypeId: string, defects: number) => {
    setActualItems(items =>
      items.map(item =>
        item.bottle_type_id === bottleTypeId
          ? { ...item, defects: Math.max(0, defects) }
          : item
      )
    );
  };

  // Update material usage
  const updateMaterialUsage = (materialId: string, quantity: number) => {
    setActualMaterials(materials =>
      materials.map(mat =>
        mat.material_id === materialId
          ? { ...mat, quantity_used: Math.max(0, quantity) }
          : mat
      )
    );
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'planned':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
            <Clock className="w-4 h-4" />
            วางแผนแล้ว
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-700">
            <Play className="w-4 h-4" />
            กำลังผลิต
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
            <CheckCircle className="w-4 h-4" />
            เสร็จสิ้น
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
            <XCircle className="w-4 h-4" />
            ยกเลิก
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-[#E9B308]">Loading...</div>
        </div>
      </Layout>
    );
  }

  if (!batch) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-red-500">ไม่พบข้อมูลการผลิต</p>
          <button
            onClick={() => router.push('/production')}
            className="mt-4 text-[#E9B308] hover:underline"
          >
            กลับไปรายการผลิต
          </button>
        </div>
      </Layout>
    );
  }

  const totalPlannedBottles = batch.planned_items.reduce((sum, item) => sum + item.quantity, 0);
  const totalVolume = calculateTotalVolume(batch.planned_items, bottleTypes);

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/production')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Factory className="w-7 h-7 text-[#E9B308]" />
              {batch.batch_id}
            </h1>
            <p className="text-gray-600 text-sm">{product?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {getStatusBadge(batch.status)}
          {userProfile?.role === 'admin' && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="p-2 hover:bg-red-50 rounded-lg transition-colors group"
              title="ลบข้อมูลการผลิต (Admin only)"
            >
              <Trash2 className="w-5 h-5 text-red-600 group-hover:text-red-700" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg flex items-start gap-2 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg flex items-start gap-2 text-sm">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <div>{success}</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Batch Info */}
        <div className="space-y-6">
          {/* Basic Info */}
          <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">ข้อมูลแผนการผลิต</h2>

            <div className="space-y-3">
              {/* Product */}
              <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
                {product?.image ? (
                  <img src={getImageUrl(product.image)} alt={product.name} className="w-12 h-12 object-cover rounded" />
                ) : (
                  <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                    <Package className="w-6 h-6 text-gray-400" />
                  </div>
                )}
                <div>
                  <p className="font-semibold text-gray-900">{product?.name}</p>
                  <p className="text-sm text-gray-500">Batch: {batch.batch_id}</p>
                </div>
              </div>

              {/* Date */}
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">วันที่ผลิต:</span>
                <span className="font-medium">
                  {new Date(batch.planned_date).toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>

              {/* Notes */}
              {batch.planned_notes && (
                <div className="text-sm border-t pt-3 mt-3">
                  <span className="text-gray-600">หมายเหตุ:</span>
                  <p className="mt-1 text-gray-900">{batch.planned_notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Material Requirements */}
          <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {batch.status === 'completed' ? 'วัตถุดิบ (แผน vs ใช้จริง)' : 'วัตถุดิบที่ต้องใช้'}
            </h2>

            {recipes.length > 0 ? (
              <div className="space-y-3">
                {recipes.map((recipe) => {
                  const material = recipe.raw_materials;
                  const required = recipe.quantity_per_unit * totalVolume;
                  const actualMaterial = batch.actual_materials?.find(
                    (m: ActualMaterial) => m.material_id === recipe.raw_material_id
                  );
                  const actualUsed = actualMaterial?.quantity_used || 0;
                  const diff = actualUsed - required;
                  const diffPercent = required > 0 ? ((diff / required) * 100) : 0;

                  return (
                    <div key={recipe.raw_material_id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <div className="bg-gray-100 px-4 py-2 font-semibold text-gray-900">{material?.name}</div>

                      {batch.status === 'completed' && actualMaterial ? (
                        <div className="grid grid-cols-3 gap-0 text-sm">
                          <div className="bg-blue-50 p-4 border-r border-gray-200">
                            <div className="text-gray-600 mb-1 text-xs">แผน</div>
                            <div className="font-bold text-blue-700 text-lg">
                              {required.toFixed(2)} {material?.unit}
                            </div>
                          </div>
                          <div className="bg-green-50 p-4 border-r border-gray-200">
                            <div className="text-gray-600 mb-1 text-xs">ใช้จริง</div>
                            <div className="font-bold text-green-700 text-lg">
                              {actualUsed.toFixed(2)} {material?.unit}
                            </div>
                          </div>
                          <div className="bg-gray-50 p-4">
                            <div className="text-gray-600 mb-1 text-xs">ส่วนต่าง</div>
                            <div className={`font-bold text-lg ${diff >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {diff >= 0 ? '+' : ''}{diff.toFixed(2)}
                              <span className="text-xs ml-1">({diffPercent.toFixed(1)}%)</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4">
                          <div className="text-gray-600 mb-1 text-xs">จำนวนที่ต้องใช้</div>
                          <div className="font-bold text-gray-900 text-lg">
                            {required.toFixed(2)} {material?.unit}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">ยังไม่มีสูตรวัตถุดิบ</p>
            )}
          </div>
        </div>

        {/* Right Column - Execution Form */}
        <div className="space-y-6">
          {/* Planned Output - For Planned Status */}
          {batch.status === 'planned' && (
            <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">สินค้าพร้อมขายที่วางแผน</h2>
              <div className="space-y-3">
                {batch.planned_items.map((plannedItem) => {
                  const bottle = bottleTypes.find(b => b.id === plannedItem.bottle_type_id);
                  return (
                    <div key={plannedItem.bottle_type_id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <div className="bg-gray-100 px-4 py-2 font-semibold text-gray-900">{bottle?.size}</div>
                      <div className="p-4">
                        <div className="flex justify-between items-baseline">
                          <div className="text-gray-600 text-sm">จำนวนที่วางแผน</div>
                          <div className="font-bold text-[#E9B308] text-2xl">{plannedItem.quantity.toLocaleString()} ขวด</div>
                        </div>
                        <div className="flex justify-between items-baseline mt-2 pt-2 border-t border-gray-200">
                          <div className="text-gray-600 text-xs">ปริมาตร</div>
                          <div className="text-gray-900 text-sm font-medium">
                            {((bottle?.capacity_ml || 0) * plannedItem.quantity / 1000).toFixed(2)} ลิตร
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex justify-between items-baseline">
                  <span className="text-gray-700 font-medium">รวมทั้งหมด</span>
                  <div className="text-right">
                    <div className="text-xl font-bold text-gray-900">{totalPlannedBottles.toLocaleString()} ขวด</div>
                    <div className="text-sm text-gray-600">{totalVolume.toFixed(2)} ลิตร</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons for Planned Status */}
          {batch.status === 'planned' && (
            <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">ดำเนินการ</h2>
              <div className="flex gap-3">
                <button
                  onClick={handleStart}
                  disabled={submitting}
                  className="flex-1 bg-[#E9B308] text-[#00231F] px-4 py-3 rounded-lg font-semibold hover:bg-[#d4a307] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5" />
                  เริ่มผลิต
                </button>
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="px-4 py-3 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          )}

          {/* Execution Form for In Progress Status */}
          {batch.status === 'in_progress' && (
            <>
              {/* Actual Production */}
              <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">ผลการผลิตจริง</h2>

                <div className="space-y-4">
                  {actualItems.map((item) => {
                    const bottle = bottleTypes.find(b => b.id === item.bottle_type_id);
                    return (
                      <div key={item.bottle_type_id} className="bg-gray-50 p-3 rounded-lg">
                        <p className="font-medium text-gray-900 mb-2">{bottle?.size}</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-gray-500">จำนวนที่ผลิตได้</label>
                            <input
                              type="number"
                              min="0"
                              value={item.quantity}
                              onChange={(e) => updateActualQuantity(item.bottle_type_id, parseInt(e.target.value) || 0)}
                              className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">ของเสีย</label>
                            <input
                              type="number"
                              min="0"
                              value={item.defects}
                              onChange={(e) => updateDefects(item.bottle_type_id, parseInt(e.target.value) || 0)}
                              className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Material Usage */}
              {recipes.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">วัตถุดิบที่ใช้จริง</h2>

                  <div className="space-y-3">
                    {actualMaterials.map((mat) => {
                      const recipe = recipes.find(r => r.raw_material_id === mat.material_id);
                      const material = recipe?.raw_materials;
                      return (
                        <div key={mat.material_id} className="flex items-center gap-3">
                          <span className="flex-1 text-sm">{material?.name}</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={mat.quantity_used}
                            onChange={(e) => updateMaterialUsage(mat.material_id, parseFloat(e.target.value) || 0)}
                            className="w-24 bg-white border border-gray-300 rounded px-3 py-2 text-sm"
                          />
                          <span className="text-sm text-gray-500">{material?.unit}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quality Control */}
              <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Beaker className="w-5 h-5" />
                  ผลทดสอบคุณภาพ
                </h2>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Brix (ก่อนผสม)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={brixBefore}
                      onChange={(e) => setBrixBefore(e.target.value)}
                      placeholder="°Bx"
                      className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Brix (หลังผสม)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={brixAfter}
                      onChange={(e) => setBrixAfter(e.target.value)}
                      placeholder="°Bx"
                      className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Acidity (ก่อนผสม)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={acidityBefore}
                      onChange={(e) => setAcidityBefore(e.target.value)}
                      placeholder="%"
                      className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Acidity (หลังผสม)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={acidityAfter}
                      onChange={(e) => setAcidityAfter(e.target.value)}
                      placeholder="%"
                      className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">หมายเหตุการผลิต</h2>
                <textarea
                  value={executionNotes}
                  onChange={(e) => setExecutionNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm resize-none"
                  placeholder="บันทึกรายละเอียดเพิ่มเติม..."
                />
              </div>

              {/* Submit Buttons */}
              <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="px-4 py-3 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleComplete}
                    disabled={submitting}
                    className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-5 h-5" />
                    {submitting ? 'กำลังบันทึก...' : 'เสร็จสิ้นการผลิต'}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Completed Status - Show Results */}
          {batch.status === 'completed' && (
            <>
              {/* Production Comparison */}
              <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">เปรียบเทียบแผน vs ผลจริง</h2>

                {batch.actual_items && (
                  <div className="space-y-3">
                    {batch.planned_items.map((plannedItem) => {
                      const actualItem = batch.actual_items?.find(a => a.bottle_type_id === plannedItem.bottle_type_id);
                      const bottle = bottleTypes.find(b => b.id === plannedItem.bottle_type_id);
                      const goodQuantity = actualItem ? actualItem.quantity - actualItem.defects : 0;
                      const defects = actualItem?.defects || 0;
                      const totalActual = actualItem?.quantity || 0;
                      const diff = totalActual - plannedItem.quantity;
                      const diffPercent = plannedItem.quantity > 0 ? ((diff / plannedItem.quantity) * 100) : 0;

                      return (
                        <div key={plannedItem.bottle_type_id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                          <div className="bg-gray-100 px-4 py-2 font-semibold text-gray-900">{bottle?.size}</div>

                          <div className="grid grid-cols-3 gap-0 text-sm">
                            <div className="bg-blue-50 p-4 border-r border-gray-200">
                              <div className="text-gray-600 mb-1 text-xs">แผน</div>
                              <div className="font-bold text-blue-700 text-lg">{plannedItem.quantity.toLocaleString()} ขวด</div>
                            </div>
                            <div className="bg-green-50 p-4 border-r border-gray-200">
                              <div className="text-gray-600 mb-1 text-xs">ผลิตได้</div>
                              <div className="font-bold text-green-700 text-lg">{totalActual.toLocaleString()} ขวด</div>
                            </div>
                            <div className="bg-gray-50 p-4">
                              <div className="text-gray-600 mb-1 text-xs">ส่วนต่าง</div>
                              <div className={`font-bold text-lg ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {diff >= 0 ? '+' : ''}{diff.toLocaleString()}
                                <span className="text-xs ml-1">({diffPercent.toFixed(1)}%)</span>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-sm px-4 py-3 bg-gray-50 border-t border-gray-200">
                            <div>
                              <span className="text-gray-500">ของดี: </span>
                              <span className="font-semibold text-gray-900">{goodQuantity.toLocaleString()} ขวด</span>
                            </div>
                            <div>
                              <span className="text-gray-500">ของเสีย: </span>
                              <span className="font-semibold text-red-600">{defects.toLocaleString()} ขวด</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Cost Summary - Admin Only */}
              {userProfile?.role === 'admin' && (() => {
                // Convert values to numbers (they might be strings from DB)
                const materialCost = typeof batch.total_material_cost === 'string'
                  ? parseFloat(batch.total_material_cost)
                  : (batch.total_material_cost || 0);
                const bottleCost = typeof batch.total_bottle_cost === 'string'
                  ? parseFloat(batch.total_bottle_cost)
                  : (batch.total_bottle_cost || 0);
                const unitCostPerMl = typeof batch.unit_cost_per_ml === 'string'
                  ? parseFloat(batch.unit_cost_per_ml)
                  : (batch.unit_cost_per_ml || 0);
                const totalVolumeMl = typeof batch.total_volume_ml === 'string'
                  ? parseFloat(batch.total_volume_ml)
                  : (batch.total_volume_ml || 0);

                const hasCostData = materialCost > 0 || bottleCost > 0 || unitCostPerMl > 0;

                return hasCostData ? (
                  <div className="bg-gradient-to-br from-[#E9B308]/10 to-[#E9B308]/5 border border-[#E9B308] rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      💰 สรุปต้นทุนการผลิต
                      <span className="text-xs font-normal px-2 py-1 bg-red-100 text-red-700 rounded">Admin only</span>
                    </h2>

                    <div className="space-y-3">
                      {/* Total Costs */}
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                          <div className="text-gray-500 mb-1">ต้นทุนวัตถุดิบ</div>
                          <div className="text-lg font-bold text-gray-900">
                            ฿{materialCost.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                          <div className="text-gray-500 mb-1">ต้นทุนขวด</div>
                          <div className="text-lg font-bold text-gray-900">
                            ฿{bottleCost.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>

                      {/* Total and Unit Cost */}
                      <div className="bg-white rounded-lg p-4 border-2 border-[#E9B308]">
                        <div className="flex items-baseline justify-between mb-2">
                          <span className="text-gray-700 font-medium">ต้นทุนรวมทั้งหมด</span>
                          <span className="text-2xl font-bold text-[#E9B308]">
                            ฿{(materialCost + bottleCost).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between text-sm pt-2 border-t border-gray-200">
                          <span className="text-gray-600">ปริมาตรรวม</span>
                          <span className="font-semibold text-gray-900">
                            {(totalVolumeMl / 1000).toFixed(2)} ลิตร ({totalVolumeMl.toLocaleString()} ml)
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between text-sm pt-2 border-t border-gray-200 mt-2">
                          <span className="text-gray-600">ต้นทุนต่อ ml</span>
                          <span className="text-lg font-bold text-green-600">
                            ฿{unitCostPerMl.toFixed(4)}/ml
                          </span>
                        </div>
                      </div>

                      {/* Unit Cost per Bottle Type */}
                      {batch.actual_items && unitCostPerMl > 0 && (
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                          <div className="text-sm font-medium text-gray-700 mb-2">ต้นทุนต่อหน่วย (แต่ละขนาด)</div>
                          <div className="space-y-2">
                            {batch.actual_items.map((item: ActualItem) => {
                              const bottle = bottleTypes.find(b => b.id === item.bottle_type_id);
                              const goodQty = item.quantity - item.defects;
                              const unitCostPerBottle = unitCostPerMl * (bottle?.capacity_ml || 0);
                              const costPerType = goodQty * unitCostPerBottle;
                              return (
                                <div key={item.bottle_type_id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                                  <span className="text-gray-700">
                                    {bottle?.size} <span className="text-xs text-gray-500">({bottle?.capacity_ml} ml)</span>
                                  </span>
                                  <div className="text-right">
                                    <div className="font-semibold text-gray-900">
                                      ฿{unitCostPerBottle.toFixed(2)}/ขวด
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {goodQty} ขวด = ฿{costPerType.toFixed(2)}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Quality Control Results */}
              {(batch.brix_before || batch.brix_after) && (
                <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Beaker className="w-5 h-5" />
                    ผลทดสอบคุณภาพ
                  </h2>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {batch.brix_before && (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-gray-500 mb-1">Brix (ก่อน)</div>
                        <div className="font-semibold text-gray-900">{batch.brix_before}°Bx</div>
                      </div>
                    )}
                    {batch.brix_after && (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-gray-500 mb-1">Brix (หลัง)</div>
                        <div className="font-semibold text-gray-900">{batch.brix_after}°Bx</div>
                      </div>
                    )}
                    {batch.acidity_before && (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-gray-500 mb-1">Acidity (ก่อน)</div>
                        <div className="font-semibold text-gray-900">{batch.acidity_before}%</div>
                      </div>
                    )}
                    {batch.acidity_after && (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-gray-500 mb-1">Acidity (หลัง)</div>
                        <div className="font-semibold text-gray-900">{batch.acidity_after}%</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notes and Timestamp */}
              {(batch.execution_notes || batch.completed_at) && (
                <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
                  {batch.execution_notes && (
                    <div className="mb-3">
                      <h3 className="font-medium text-gray-700 mb-1">หมายเหตุ</h3>
                      <p className="text-sm text-gray-600">{batch.execution_notes}</p>
                    </div>
                  )}
                  {batch.completed_at && (
                    <div className={`text-sm text-gray-500 flex items-center gap-1 ${batch.execution_notes ? 'border-t pt-3' : ''}`}>
                      <Clock className="w-4 h-4" />
                      เสร็จสิ้นเมื่อ: {new Date(batch.completed_at).toLocaleString('th-TH')}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Cancelled Status */}
          {batch.status === 'cancelled' && (
            <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-red-600 mb-4">ยกเลิกการผลิต</h2>
              {batch.cancelled_reason && (
                <p className="text-gray-600">เหตุผล: {batch.cancelled_reason}</p>
              )}
              {batch.cancelled_at && (
                <p className="text-sm text-gray-500 mt-2">
                  ยกเลิกเมื่อ: {new Date(batch.cancelled_at).toLocaleString('th-TH')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">ยกเลิกการผลิต</h3>
            <p className="text-gray-600 mb-4">กรุณาระบุเหตุผลในการยกเลิก</p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 mb-4 resize-none"
              placeholder="เหตุผลในการยกเลิก..."
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                ปิด
              </button>
              <button
                onClick={handleCancel}
                disabled={submitting}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {submitting ? 'กำลังยกเลิก...' : 'ยืนยันยกเลิก'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal (Admin only) */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">ลบข้อมูลการผลิต</h3>
            </div>
            <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800 font-medium mb-2">⚠️ คำเตือน</p>
              <p className="text-sm text-yellow-700">
                การลบข้อมูลนี้จะ <strong>ลบถาวร (Hard Delete)</strong> และไม่สามารถกู้คืนได้
              </p>
              <p className="text-sm text-yellow-700 mt-2">
                ข้อมูลที่จะถูกลบ:
              </p>
              <ul className="text-sm text-yellow-700 list-disc list-inside mt-1">
                <li>Production Batch: {batch.batch_id}</li>
                <li>Stock Lot Usages (FIFO records)</li>
                <li>Finished Goods (สินค้าพร้อมขาย)</li>
              </ul>
            </div>
            <p className="text-gray-600 mb-4">
              คุณแน่ใจหรือไม่ที่จะลบ <strong className="text-gray-900">{batch.batch_id}</strong>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={submitting}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleDelete}
                disabled={submitting}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {submitting ? 'กำลังลบ...' : 'ยืนยันลบ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
