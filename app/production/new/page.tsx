// Path: app/production/new/page.tsx
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import {
  Factory, ArrowLeft, AlertTriangle, Package,
  Plus, Minus, Calculator, CheckCircle, Calendar,
  Loader2, Trash2, ShoppingCart, ChevronDown, ChevronRight, Leaf, Search, Wine
} from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { getImageUrl } from '@/lib/utils/image';
import DateRangePicker from '@/components/ui/DateRangePicker';
import { DateValueType } from 'react-tailwindcss-datepicker';

// Types
interface Product {
  id: string;
  code: string;
  name: string;
  image?: string;
}

interface SellableProductOption {
  sellable_product_id: string;
  code: string;
  name: string;
  product_id: string;
  product_type: 'simple' | 'variation';
  simple_bottle_type_id?: string;
  simple_bottle_size?: string;
  simple_bottle_capacity_ml?: number;
  simple_default_price?: number;
  variations: Array<{
    variation_id: string;
    bottle_type_id: string;
    bottle_size: string;
    bottle_capacity_ml: number;
    default_price: number;
  }>;
}

// Flattened product for easy selection (combines simple + each variation)
interface FlatProduct {
  id: string; // sellable_product_id for simple, variation_id for variations
  sellable_product_id: string;
  variation_id?: string;
  code: string;
  name: string;
  product_id: string;
  bottle_type_id: string;
  bottle_size: string;
  bottle_capacity_ml: number;
  display_name: string; // "ชื่อสินค้า ขวด ขนาด ml"
}

interface PlanItem {
  id: string;
  flatProductId: string; // ID from FlatProduct (sellable_product_id or variation_id)
  sellableProductId: string;
  variationId?: string;
  quantity: number;
}

interface OrderSummaryItem {
  sellableProductId: string;
  sellableProductCode: string;
  sellableProductName: string;
  bottleSize: string;
  bottleTypeId: string;
  totalQuantity: number;
  orders: Array<{
    orderNumber: string;
    customerName: string;
    deliveryDate: string;
    quantity: number;
  }>;
}

interface MaterialSummary {
  materialId: string;
  materialName: string;
  unit: string;
  totalQuantity: number;
  averagePrice: number;
  totalCost: number;
  currentStock: number;
  isSufficient: boolean;
}

interface BottleSummary {
  bottleTypeId: string;
  bottleSize: string;
  capacityMl: number;
  totalQuantity: number;
  price: number;
  currentStock: number;
  isSufficient: boolean;
}

interface CalculationResult {
  summary: Array<{
    sellableProductId: string;
    sellableProductCode: string;
    sellableProductName: string;
    bottleSize: string;
    capacityMl: number;
    totalQuantity: number;
    volumeLiters: number;
    materialCostPerBottle: number;
    bottleCostPerBottle: number;
    totalCostPerBottle: number;
    totalMaterialCost: number;
    totalBottleCost: number;
    totalCost: number;
  }>;
  materialsSummary: MaterialSummary[];
  bottleSummary: BottleSummary[];
  totals: {
    totalBottles: number;
    totalVolumeLiters: number;
    totalMaterialCost: number;
    totalBottleCost: number;
    totalCost: number;
  };
}

export default function NewProductionPage() {
  const router = useRouter();
  const { session, userProfile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Products (base juice products)
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  // Sellable products (filtered by selected product)
  const [allSellableProducts, setAllSellableProducts] = useState<SellableProductOption[]>([]);
  const [filteredSellableProducts, setFilteredSellableProducts] = useState<SellableProductOption[]>([]);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);

  // Order summary (optional - load from orders)
  const [orderSummary, setOrderSummary] = useState<OrderSummaryItem[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [showOrderSummary, setShowOrderSummary] = useState(false);

  // Calculation result
  const [calculationResult, setCalculationResult] = useState<CalculationResult | null>(null);

  // Form state
  const [plannedDateValue, setPlannedDateValue] = useState<DateValueType>({
    startDate: new Date(),
    endDate: new Date(),
  });
  const plannedDate = plannedDateValue?.startDate
    ? new Date(plannedDateValue.startDate).toISOString().split('T')[0]
    : '';
  const [notes, setNotes] = useState<string>('');
  const [generatedBatchId, setGeneratedBatchId] = useState<string>('');

  // Date range for order summary
  const getDefaultTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  };
  const [orderDateRange, setOrderDateRange] = useState<DateValueType>({
    startDate: getDefaultTomorrow(),
    endDate: getDefaultTomorrow(),
  });
  const orderStartDate = orderDateRange?.startDate
    ? new Date(orderDateRange.startDate).toISOString().split('T')[0]
    : '';
  const orderEndDate = orderDateRange?.endDate
    ? new Date(orderDateRange.endDate).toISOString().split('T')[0]
    : '';

  // Product search state (per item)
  const [productSearches, setProductSearches] = useState<Record<string, string>>({});
  const [showProductDropdowns, setShowProductDropdowns] = useState<Record<string, boolean>>({});

  // Refs for quantity inputs (to auto-focus after selecting product)
  const quantityInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Flatten sellable products for easy selection
  const flatProducts = useMemo((): FlatProduct[] => {
    const result: FlatProduct[] = [];
    filteredSellableProducts.forEach(sp => {
      if (sp.product_type === 'simple') {
        result.push({
          id: sp.sellable_product_id,
          sellable_product_id: sp.sellable_product_id,
          code: sp.code,
          name: sp.name,
          product_id: sp.product_id,
          bottle_type_id: sp.simple_bottle_type_id || '',
          bottle_size: sp.simple_bottle_size || '-',
          bottle_capacity_ml: sp.simple_bottle_capacity_ml || 0,
          display_name: `${sp.name} ${sp.simple_bottle_size || ''} ${sp.simple_bottle_capacity_ml ? `${sp.simple_bottle_capacity_ml}ml` : ''}`.trim()
        });
      } else {
        // For variation products, create one entry per variation
        sp.variations.forEach(v => {
          result.push({
            id: v.variation_id,
            sellable_product_id: sp.sellable_product_id,
            variation_id: v.variation_id,
            code: sp.code,
            name: sp.name,
            product_id: sp.product_id,
            bottle_type_id: v.bottle_type_id,
            bottle_size: v.bottle_size,
            bottle_capacity_ml: v.bottle_capacity_ml,
            display_name: `${sp.name} ${v.bottle_size} ${v.bottle_capacity_ml}ml`
          });
        });
      }
    });
    return result;
  }, [filteredSellableProducts]);

  // Fetch products and sellable products
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch base products via API
        const productsResponse = await fetch('/api/products', {
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
        });

        const productsResult = await productsResponse.json();

        if (productsResponse.ok && productsResult.products) {
          // Filter active products and sort by name
          const activeProducts = productsResult.products
            .filter((p: Product & { is_active?: boolean }) => p.is_active !== false)
            .sort((a: Product, b: Product) => a.name.localeCompare(b.name));
          setProducts(activeProducts);
        } else {
          setProducts([]);
        }

        // Fetch sellable products
        const response = await fetch('/api/sellable-products', {
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
        });

        const result = await response.json();
        if (response.ok && result.sellable_products) {
          setAllSellableProducts(result.sellable_products);
        }

        // Generate batch ID
        generateBatchId();
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (session?.access_token) {
      fetchData();
    }
  }, [session?.access_token]);

  // Filter sellable products when product is selected
  useEffect(() => {
    if (selectedProductId) {
      const filtered = allSellableProducts.filter(sp => sp.product_id === selectedProductId);
      setFilteredSellableProducts(filtered);
    } else {
      setFilteredSellableProducts([]);
    }
    // Clear plan items when product changes
    setPlanItems([]);
    setCalculationResult(null);
  }, [selectedProductId, allSellableProducts]);

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
      setGeneratedBatchId(`BATCH-${new Date().getFullYear()}-0001`);
    }
  };

  // Fetch order summary (filtered by selected product)
  const fetchOrderSummary = async () => {
    if (!selectedProductId) {
      setError('กรุณาเลือกสินค้าผลิตก่อน');
      return;
    }

    try {
      setLoadingOrders(true);
      const response = await fetch(
        `/api/reports/production-plan?start_date=${orderStartDate}&end_date=${orderEndDate}`,
        {
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
        }
      );

      const result = await response.json();
      if (response.ok && result.report) {
        // Filter to only show items for selected product
        const summaryItems: OrderSummaryItem[] = result.report.summary
          .filter((item: any) => item.productId === selectedProductId)
          .map((item: any) => ({
            sellableProductId: item.sellableProductId,
            sellableProductCode: item.sellableProductCode,
            sellableProductName: item.sellableProductName,
            bottleSize: item.bottleSize,
            bottleTypeId: item.bottleTypeId,
            totalQuantity: item.totalQuantity,
            orders: item.orders || []
          }));
        setOrderSummary(summaryItems);
        setShowOrderSummary(true);
      }
    } catch (err: any) {
      console.error('Error fetching order summary:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  // Add item from order summary to plan
  const addFromOrderSummary = (item: OrderSummaryItem) => {
    const product = allSellableProducts.find(p => p.sellable_product_id === item.sellableProductId)
                 || filteredSellableProducts.find(p => p.sellable_product_id === item.sellableProductId);
    if (!product) return;

    // Find flatProductId
    let flatProductId = '';
    let variationId: string | undefined;

    if (product.product_type === 'simple') {
      flatProductId = item.sellableProductId;
    } else {
      const variation = product.variations.find(v => v.bottle_size === item.bottleSize);
      flatProductId = variation?.variation_id || '';
      variationId = variation?.variation_id;
    }

    // Check if already added
    const existingIndex = planItems.findIndex(p => p.flatProductId === flatProductId);

    if (existingIndex >= 0) {
      setPlanItems(prev => prev.map((p, idx) =>
        idx === existingIndex
          ? { ...p, quantity: p.quantity + item.totalQuantity }
          : p
      ));
    } else {
      setPlanItems(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          flatProductId,
          sellableProductId: item.sellableProductId,
          variationId,
          quantity: item.totalQuantity
        }
      ]);
    }
    setCalculationResult(null);
  };

  // Add all from order summary
  const addAllFromOrderSummary = () => {
    orderSummary.forEach(item => {
      addFromOrderSummary(item);
    });
  };

  // Add empty plan item
  const addPlanItem = () => {
    setPlanItems(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        flatProductId: '',
        sellableProductId: '',
        variationId: undefined,
        quantity: 1
      }
    ]);
  };

  // Select flat product for a plan item
  const selectFlatProduct = (itemId: string, flatProduct: FlatProduct) => {
    setPlanItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          flatProductId: flatProduct.id,
          sellableProductId: flatProduct.sellable_product_id,
          variationId: flatProduct.variation_id
        };
      }
      return item;
    }));
    setCalculationResult(null);

    // Auto-focus quantity input after short delay
    setTimeout(() => {
      const inputRef = quantityInputRefs.current[itemId];
      if (inputRef) {
        inputRef.focus();
        inputRef.select();
      }
    }, 100);
  };

  // Update plan item quantity
  const updatePlanItemQuantity = (itemId: string, quantity: number) => {
    setPlanItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return { ...item, quantity };
      }
      return item;
    }));
    setCalculationResult(null);
  };

  // Clear product selection
  const clearProductSelection = (itemId: string) => {
    setPlanItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return { ...item, flatProductId: '', sellableProductId: '', variationId: undefined };
      }
      return item;
    }));
    setCalculationResult(null);
  };

  // Remove plan item
  const removePlanItem = (id: string) => {
    setPlanItems(prev => prev.filter(item => item.id !== id));
    setCalculationResult(null);
  };

  // Calculate materials and costs
  const calculatePlan = async () => {
    // Validate using ALL sellable products, not just filtered ones
    // This fixes the issue where product_id filtering might cause mismatches
    const validItems = planItems.filter(item => {
      if (!item.sellableProductId || item.quantity <= 0) {
        return false;
      }
      // Look in all sellable products first, then fallback to filtered
      const product = allSellableProducts.find(p => p.sellable_product_id === item.sellableProductId)
                   || filteredSellableProducts.find(p => p.sellable_product_id === item.sellableProductId);
      if (!product) {
        return false;
      }
      // For variation products, require a variation selection
      if (product.product_type === 'variation' && !item.variationId) {
        return false;
      }
      return true;
    });

    if (validItems.length === 0) {
      setError('กรุณาเพิ่มสินค้าที่ต้องการผลิตอย่างน้อย 1 รายการ');
      return;
    }

    try {
      setCalculating(true);
      setError(null);

      const items = validItems.map(item => ({
        sellable_product_id: item.sellableProductId,
        variation_id: item.variationId,
        quantity: item.quantity
      }));

      const response = await fetch('/api/reports/production-plan/calculate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ items })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'ไม่สามารถคำนวณได้');
      }

      setCalculationResult(result.report);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCalculating(false);
    }
  };

  // Submit production plan
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProductId) {
      setError('กรุณาเลือกสินค้าผลิต');
      return;
    }

    const validItems = planItems.filter(item => {
      if (!item.sellableProductId || item.quantity <= 0) return false;
      const product = allSellableProducts.find(p => p.sellable_product_id === item.sellableProductId)
                   || filteredSellableProducts.find(p => p.sellable_product_id === item.sellableProductId);
      if (!product) return false;
      if (product.product_type === 'variation' && !item.variationId) return false;
      return true;
    });

    if (validItems.length === 0) {
      setError('กรุณาระบุสินค้าที่ต้องการผลิตอย่างน้อย 1 รายการ');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Build planned_items from sellable products
      const plannedItemsForApi: Array<{ bottle_type_id: string; quantity: number }> = [];

      validItems.forEach(item => {
        const product = allSellableProducts.find(p => p.sellable_product_id === item.sellableProductId)
                     || filteredSellableProducts.find(p => p.sellable_product_id === item.sellableProductId);
        if (!product) return;

        let bottleTypeId: string | undefined;
        if (product.product_type === 'simple') {
          bottleTypeId = product.simple_bottle_type_id;
        } else if (item.variationId) {
          const variation = product.variations.find(v => v.variation_id === item.variationId);
          bottleTypeId = variation?.bottle_type_id;
        }

        if (bottleTypeId) {
          const existing = plannedItemsForApi.find(p => p.bottle_type_id === bottleTypeId);
          if (existing) {
            existing.quantity += item.quantity;
          } else {
            plannedItemsForApi.push({ bottle_type_id: bottleTypeId, quantity: item.quantity });
          }
        }
      });

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
          planned_items: plannedItemsForApi,
          planned_notes: notes || undefined
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create production plan');
      }

      if (result.has_warning && result.insufficient_materials) {
        // Handle both string and object/array formats
        let materials = result.insufficient_materials;
        if (typeof materials === 'string') {
          try {
            materials = JSON.parse(materials);
          } catch {
            // If parsing fails, just show the message
            alert(`⚠️ ${result.message}`);
            router.push('/production');
            return;
          }
        }
        if (Array.isArray(materials)) {
          alert(`⚠️ ${result.message}\n\nวัตถุดิบที่ขาด:\n${materials.map((m: any) =>
            `- ${m.material_name}: ต้องการ ${m.required} ${m.unit}, มี ${m.available} ${m.unit} (ขาด ${m.shortage} ${m.unit})`
          ).join('\n')}\n\nกรุณาซื้อวัตถุดิบเพิ่มก่อนเริ่มผลิต`);
        } else {
          alert(`⚠️ ${result.message}`);
        }
      }

      router.push('/production');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Get product display info using flatProducts
  const getProductDisplay = (item: PlanItem) => {
    // Find from flatProducts first
    const flatProduct = flatProducts.find(fp => fp.id === item.flatProductId);
    if (flatProduct) {
      return {
        name: flatProduct.name,
        code: flatProduct.code,
        size: flatProduct.bottle_size,
        capacityMl: flatProduct.bottle_capacity_ml,
        displayName: flatProduct.display_name
      };
    }

    // Fallback to old method
    const product = allSellableProducts.find(p => p.sellable_product_id === item.sellableProductId)
                 || filteredSellableProducts.find(p => p.sellable_product_id === item.sellableProductId);
    if (!product) return { name: '-', code: '-', size: '-', capacityMl: 0, displayName: '-' };

    if (product.product_type === 'simple') {
      return {
        name: product.name,
        code: product.code,
        size: product.simple_bottle_size || '-',
        capacityMl: product.simple_bottle_capacity_ml || 0,
        displayName: `${product.name} ${product.simple_bottle_size || ''} ${product.simple_bottle_capacity_ml || ''}ml`.trim()
      };
    } else if (item.variationId) {
      const variation = product.variations.find(v => v.variation_id === item.variationId);
      return {
        name: product.name,
        code: product.code,
        size: variation?.bottle_size || '-',
        capacityMl: variation?.bottle_capacity_ml || 0,
        displayName: `${product.name} ${variation?.bottle_size || ''} ${variation?.bottle_capacity_ml || ''}ml`.trim()
      };
    }
    return { name: product.name, code: product.code, size: 'เลือกขนาด', capacityMl: 0, displayName: product.name };
  };

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const totalBottles = planItems.reduce((sum, item) => sum + (item.quantity || 0), 0);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-[#E9B308]" />
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
          <p className="text-gray-600 text-base">เลือกน้ำที่จะผลิต และระบุจำนวนขวดแต่ละขนาด</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg flex items-start gap-2 text-base">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Planning Form */}
        <div className="space-y-6">
          {/* Batch ID & Date */}
          <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h2 className="text-sm font-medium text-gray-500 mb-2">Batch ID</h2>
                <div className="bg-[#E9B308]/10 border border-[#E9B308] rounded-lg p-3 text-center">
                  <span className="text-lg font-bold text-gray-900">{generatedBatchId}</span>
                </div>
              </div>
              <div>
                <h2 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  วันที่ผลิต
                </h2>
                <DateRangePicker
                  value={plannedDateValue}
                  onChange={(val) => setPlannedDateValue(val)}
                  asSingle={true}
                  useRange={false}
                  showShortcuts={false}
                  showFooter={false}
                  placeholder="เลือกวันที่ผลิต"
                />
              </div>
            </div>
          </div>

          {/* Step 1: Select Product (Base Juice) */}
          <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              <span className="inline-flex items-center justify-center w-6 h-6 bg-[#E9B308] text-[#00231F] rounded-full text-sm font-bold mr-2">1</span>
              เลือกน้ำที่จะผลิต
            </h2>
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

          {/* Step 2: Load from Orders (optional) */}
          {selectedProductId && (
            <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setShowOrderSummary(!showOrderSummary)}
              >
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-[#E9B308]" />
                  ดึงจำนวนจากออเดอร์ที่ต้องส่ง (ไม่บังคับ)
                </h2>
                {showOrderSummary ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
              </div>

              {showOrderSummary && (
                <div className="mt-4 space-y-4">
                  {/* Date Range */}
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[250px]">
                      <label className="block text-xs text-gray-500 mb-1">วันที่ส่ง</label>
                      <DateRangePicker
                        value={orderDateRange}
                        onChange={(val) => setOrderDateRange(val)}
                        showShortcuts={false}
                        showFooter={false}
                        placeholder="เลือกช่วงวันที่ส่ง"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={fetchOrderSummary}
                      disabled={loadingOrders}
                      className="px-4 py-1.5 bg-[#00231F] text-white rounded-lg text-sm hover:bg-[#003d36] transition-colors disabled:opacity-50"
                    >
                      {loadingOrders ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'โหลด'
                      )}
                    </button>
                  </div>

                  {/* Order Summary List */}
                  {orderSummary.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">พบ {orderSummary.length} รายการ (เฉพาะ {selectedProduct?.name})</span>
                        <button
                          type="button"
                          onClick={addAllFromOrderSummary}
                          className="text-sm text-[#E9B308] hover:underline"
                        >
                          เพิ่มทั้งหมด
                        </button>
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {orderSummary.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                          >
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{item.sellableProductName}</p>
                              <p className="text-xs text-gray-500">{item.bottleSize} - {item.totalQuantity} ขวด</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => addFromOrderSummary(item)}
                              className="px-3 py-1 bg-[#E9B308] text-[#00231F] rounded text-xs font-medium hover:bg-[#d4a307]"
                            >
                              <Plus className="w-3 h-3 inline mr-1" />
                              เพิ่ม
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : loadingOrders ? null : orderSummary.length === 0 && showOrderSummary ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      ไม่มีออเดอร์ในช่วงวันที่เลือก หรือกด "โหลด" เพื่อดูข้อมูล
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Plan Items */}
          {selectedProductId && (
            <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  <span className="inline-flex items-center justify-center w-6 h-6 bg-[#E9B308] text-[#00231F] rounded-full text-sm font-bold mr-2">2</span>
                  สินค้าพร้อมขายที่ต้องผลิต
                </h2>
                <button
                  type="button"
                  onClick={addPlanItem}
                  className="flex items-center gap-1 px-3 py-1.5 bg-[#E9B308] text-[#00231F] rounded-lg text-sm font-medium hover:bg-[#d4a307]"
                >
                  <Plus className="w-4 h-4" />
                  เพิ่ม
                </button>
              </div>

              {filteredSellableProducts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>ไม่มีสินค้าพร้อมขายที่ใช้น้ำนี้</p>
                  <p className="text-sm">กรุณาสร้างสินค้าพร้อมขายก่อน</p>
                </div>
              ) : planItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>ยังไม่มีรายการ</p>
                  <p className="text-sm">กดปุ่ม "เพิ่ม" หรือดึงจากออเดอร์</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {planItems.map((item, index) => {
                    const selectedFlatProduct = flatProducts.find(fp => fp.id === item.flatProductId);
                    const searchKey = item.id;
                    const searchValue = productSearches[searchKey] || '';
                    const isDropdownOpen = showProductDropdowns[searchKey] || false;

                    // Filter flat products based on search
                    const searchFilteredProducts = flatProducts.filter(fp =>
                      fp.name.toLowerCase().includes(searchValue.toLowerCase()) ||
                      fp.code.toLowerCase().includes(searchValue.toLowerCase()) ||
                      fp.display_name.toLowerCase().includes(searchValue.toLowerCase())
                    );

                    return (
                      <div key={item.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-500 w-6">{index + 1}.</span>

                          {/* Selected Product Display or Search */}
                          <div className="flex-1">
                            {selectedFlatProduct ? (
                              <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-[#E9B308]">
                                <div className="w-10 h-10 bg-[#E9B308]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                                  <Wine className="w-5 h-5 text-[#E9B308]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-gray-900">{selectedFlatProduct.display_name}</p>
                                  <p className="text-xs text-gray-400">{selectedFlatProduct.code}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    clearProductSelection(item.id);
                                    setProductSearches(prev => ({ ...prev, [searchKey]: '' }));
                                  }}
                                  className="p-1 text-gray-400 hover:text-red-500"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="relative">
                                <div className="flex items-center gap-2 px-3 py-2.5 bg-white border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-[#E9B308] focus-within:border-transparent">
                                  <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                  <input
                                    type="text"
                                    value={searchValue}
                                    onChange={(e) => {
                                      setProductSearches(prev => ({ ...prev, [searchKey]: e.target.value }));
                                      setShowProductDropdowns(prev => ({ ...prev, [searchKey]: true }));
                                    }}
                                    onFocus={() => setShowProductDropdowns(prev => ({ ...prev, [searchKey]: true }))}
                                    onBlur={() => setTimeout(() => setShowProductDropdowns(prev => ({ ...prev, [searchKey]: false })), 200)}
                                    placeholder="ค้นหาชื่อสินค้า หรือรหัส..."
                                    className="flex-1 outline-none bg-transparent"
                                  />
                                </div>
                                {isDropdownOpen && (
                                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-auto">
                                    {searchFilteredProducts.length === 0 ? (
                                      <div className="px-4 py-3 text-sm text-gray-500">ไม่พบสินค้า</div>
                                    ) : (
                                      searchFilteredProducts.map(fp => (
                                        <button
                                          key={fp.id}
                                          type="button"
                                          onClick={() => {
                                            selectFlatProduct(item.id, fp);
                                            setProductSearches(prev => ({ ...prev, [searchKey]: '' }));
                                            setShowProductDropdowns(prev => ({ ...prev, [searchKey]: false }));
                                          }}
                                          className="w-full px-4 py-3 text-left hover:bg-[#E9B308]/10 transition-colors border-b border-gray-100 last:border-b-0"
                                        >
                                          <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-[#E9B308]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                                              <Wine className="w-5 h-5 text-[#E9B308]" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <p className="font-semibold text-gray-900">{fp.display_name}</p>
                                              <p className="text-xs text-gray-400">{fp.code}</p>
                                            </div>
                                          </div>
                                        </button>
                                      ))
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Quantity Input - Simple */}
                          <div className="flex items-center gap-2">
                            <input
                              ref={(el) => { quantityInputRefs.current[item.id] = el; }}
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updatePlanItemQuantity(item.id, parseInt(e.target.value) || 0)}
                              className="w-24 px-3 py-2.5 border border-gray-300 rounded-lg text-center text-lg font-semibold focus:ring-2 focus:ring-[#E9B308] focus:border-transparent"
                              placeholder="จำนวน"
                            />
                            <span className="text-sm text-gray-500">ขวด</span>
                          </div>

                          {/* Remove Button */}
                          <button
                            type="button"
                            onClick={() => removePlanItem(item.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {selectedProductId && (
            <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">หมายเหตุ</h2>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full bg-white border border-gray-300 text-gray-900 px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] focus:border-transparent resize-none text-sm"
                placeholder="ระบุรายละเอียดเพิ่มเติม..."
              />
            </div>
          )}
        </div>

        {/* Right Column - Summary & Calculation */}
        <div className="space-y-6">
          {/* Selected Product Info */}
          {selectedProduct && (
            <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
              <div className="flex items-center gap-4">
                {selectedProduct.image ? (
                  <img
                    src={getImageUrl(selectedProduct.image)}
                    alt={selectedProduct.name}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Package className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-500">น้ำที่จะผลิต</p>
                  <p className="text-xl font-bold text-gray-900">{selectedProduct.name}</p>
                  <p className="text-sm text-gray-500">Batch: {generatedBatchId}</p>
                </div>
              </div>
            </div>
          )}

          {/* Quick Summary */}
          {selectedProductId && (
            <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">สรุปรายการ</h2>

              {planItems.length > 0 ? (
                <div className="space-y-3">
                  {planItems.filter(item => item.sellableProductId && item.quantity > 0).map((item) => {
                    const display = getProductDisplay(item);
                    return (
                      <div key={item.id} className="flex justify-between items-center py-3 border-b border-gray-100">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 text-base">{display.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#E9B308]/20 text-[#00231F] text-sm font-medium">
                              {display.size}
                            </span>
                            {display.capacityMl > 0 && (
                              <span className="text-gray-500 text-sm">
                                {display.capacityMl} ml
                              </span>
                            )}
                          </div>
                          <p className="text-gray-400 text-xs mt-1">{display.code}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-bold text-[#E9B308]">{item.quantity.toLocaleString()}</span>
                          <p className="text-gray-500 text-sm">ขวด</p>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex justify-between items-center font-semibold pt-3 mt-2 border-t-2 border-[#E9B308]">
                    <span className="text-gray-700">รวมทั้งหมด</span>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-[#E9B308]">{totalBottles.toLocaleString()}</span>
                      <span className="text-gray-600 ml-1">ขวด</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">ยังไม่มีรายการ</p>
              )}

              {/* Calculate Button */}
              <button
                type="button"
                onClick={calculatePlan}
                disabled={calculating || planItems.length === 0}
                className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-[#00231F] text-white rounded-lg font-medium hover:bg-[#003d36] transition-colors disabled:opacity-50"
              >
                {calculating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Calculator className="w-5 h-5" />
                )}
                คำนวณวัตถุดิบและต้นทุน
              </button>
            </div>
          )}

          {/* Calculation Result */}
          {calculationResult && (
            <>
              {/* Volume & Cost Summary */}
              <div className="bg-[#E9B308]/10 border border-[#E9B308] rounded-lg p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-sm text-gray-600">ปริมาตรน้ำที่ต้องทำ</p>
                    <p className="text-2xl font-bold text-[#00231F]">
                      {calculationResult.totals.totalVolumeLiters.toFixed(1)} L
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600">ต้นทุนรวมทั้งหมด</p>
                    <p className="text-2xl font-bold text-[#00231F]">
                      ฿{calculationResult.totals.totalCost.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-[#E9B308]/30 grid grid-cols-2 gap-4 text-sm">
                  <div className="text-center">
                    <p className="text-gray-600">ต้นทุนวัตถุดิบ</p>
                    <p className="font-semibold text-[#00231F]">
                      ฿{calculationResult.totals.totalMaterialCost.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-600">ต้นทุนขวด</p>
                    <p className="font-semibold text-[#00231F]">
                      ฿{calculationResult.totals.totalBottleCost.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Cost Breakdown by Product - Admin Only */}
              {userProfile?.role === 'admin' && (
                <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">ต้นทุนแยกตามสินค้า</h2>

                  {calculationResult.summary.length > 0 ? (
                    <div className="space-y-3">
                      {calculationResult.summary.map((item, idx) => (
                        <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-medium text-gray-900">{item.sellableProductName}</p>
                              <p className="text-xs text-gray-500">{item.sellableProductCode} | {item.bottleSize}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-[#E9B308]">{item.totalQuantity.toLocaleString()} ขวด</p>
                              <p className="text-xs text-gray-500">{item.volumeLiters.toFixed(2)} L</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-gray-200">
                            <div>
                              <p className="text-gray-500">วัตถุดิบ/ขวด</p>
                              <p className="font-medium">฿{item.materialCostPerBottle.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">ขวด/ขวด</p>
                              <p className="font-medium">฿{item.bottleCostPerBottle.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">รวม/ขวด</p>
                              <p className="font-medium text-[#E9B308]">฿{item.totalCostPerBottle.toFixed(2)}</p>
                            </div>
                          </div>
                          <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between text-sm">
                            <span className="text-gray-600">ต้นทุนรวม ({item.totalQuantity} ขวด)</span>
                            <span className="font-semibold">฿{item.totalCost.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">ไม่มีข้อมูล</p>
                  )}
                </div>
              )}

              {/* Materials List - Enhanced Display */}
              <div className="bg-gradient-to-br from-[#00231F] to-[#003d36] rounded-lg shadow-lg p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Leaf className="w-5 h-5 text-[#E9B308]" />
                  วัตถุดิบที่ต้องใช้
                </h2>

                {calculationResult.materialsSummary.length > 0 ? (
                  <div className="space-y-3">
                    {calculationResult.materialsSummary.map((material) => (
                      <div
                        key={material.materialId}
                        className={`flex justify-between items-center p-4 backdrop-blur rounded-lg border ${
                          material.isSufficient
                            ? 'bg-white/10 border-white/20'
                            : 'bg-red-500/20 border-red-400/50'
                        }`}
                      >
                        <div>
                          <p className="font-semibold text-white text-base">{material.materialName}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-white/60">มีอยู่:</span>
                            <span className={`text-sm font-medium ${material.isSufficient ? 'text-green-400' : 'text-red-400'}`}>
                              {material.currentStock.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {material.unit}
                            </span>
                            {!material.isSufficient && (
                              <span className="text-xs text-red-400">
                                (ขาด {(material.totalQuantity - material.currentStock).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                              </span>
                            )}
                          </div>
                          {userProfile?.role === 'admin' && (
                            <p className="text-xs text-white/60 mt-1">
                              ฿{material.averagePrice.toFixed(2)}/{material.unit}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-white/60">ต้องใช้</p>
                          <p className={`text-xl font-bold ${material.isSufficient ? 'text-[#E9B308]' : 'text-red-400'}`}>
                            {material.totalQuantity.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <p className="text-sm text-white/80">{material.unit}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-white/60 text-center py-4">
                    ยังไม่มีสูตรวัตถุดิบ
                  </p>
                )}

                {/* Bottles Section */}
                {calculationResult.bottleSummary && calculationResult.bottleSummary.length > 0 && (
                  <>
                    <h2 className="text-lg font-semibold text-white mt-6 mb-4 flex items-center gap-2">
                      <Wine className="w-5 h-5 text-[#E9B308]" />
                      ขวดที่ต้องใช้
                    </h2>
                    <div className="space-y-3">
                      {calculationResult.bottleSummary.map((bottle) => (
                        <div
                          key={bottle.bottleTypeId}
                          className={`flex justify-between items-center p-4 backdrop-blur rounded-lg border ${
                            bottle.isSufficient
                              ? 'bg-white/10 border-white/20'
                              : 'bg-red-500/20 border-red-400/50'
                          }`}
                        >
                          <div>
                            <p className="font-semibold text-white text-base">{bottle.bottleSize}</p>
                            <p className="text-xs text-white/60">{bottle.capacityMl} ml</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-white/60">มีอยู่:</span>
                              <span className={`text-sm font-medium ${bottle.isSufficient ? 'text-green-400' : 'text-red-400'}`}>
                                {bottle.currentStock.toLocaleString()} ขวด
                              </span>
                              {!bottle.isSufficient && (
                                <span className="text-xs text-red-400">
                                  (ขาด {(bottle.totalQuantity - bottle.currentStock).toLocaleString()})
                                </span>
                              )}
                            </div>
                            {userProfile?.role === 'admin' && (
                              <p className="text-xs text-white/60 mt-1">
                                ฿{bottle.price.toFixed(2)}/ขวด
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-white/60">ต้องใช้</p>
                            <p className={`text-xl font-bold ${bottle.isSufficient ? 'text-[#E9B308]' : 'text-red-400'}`}>
                              {bottle.totalQuantity.toLocaleString()}
                            </p>
                            <p className="text-sm text-white/80">ขวด</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {/* Submit Buttons */}
          {selectedProductId && (
            <div className="bg-white border border-gray-200 rounded-lg shadow p-6">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => router.push('/production')}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-base"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || planItems.length === 0 || totalBottles === 0}
                  className="flex-1 bg-[#E9B308] text-[#00231F] px-6 py-3 rounded-lg font-semibold hover:bg-[#d4a307] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base"
                >
                  {submitting ? 'กำลังบันทึก...' : 'สร้างแผนการผลิต'}
                </button>
              </div>
            </div>
          )}

          {/* Initial State - no product selected */}
          {!selectedProductId && (
            <div className="bg-white border border-gray-200 rounded-lg shadow p-12 text-center">
              <Factory className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">เลือกน้ำที่จะผลิต</h3>
              <p className="text-gray-500">
                เลือกน้ำจากรายการด้านซ้าย เพื่อเริ่มวางแผนการผลิต
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
