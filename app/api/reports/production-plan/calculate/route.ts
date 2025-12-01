// Path: app/api/reports/production-plan/calculate/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Create Supabase Admin client (service role)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Helper function: Check authentication
async function checkAuth(request: NextRequest): Promise<{ isAuth: boolean; userId?: string }> {
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return { isAuth: false };
    }

    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return { isAuth: false };
    }

    return { isAuth: true, userId: user.id };
  } catch (error) {
    console.error('Auth check error:', error);
    return { isAuth: false };
  }
}

interface ManualPlanItem {
  sellable_product_id: string;
  variation_id?: string;
  quantity: number;
}

// POST - Calculate production plan from manual items
export async function POST(request: NextRequest) {
  try {
    const { isAuth } = await checkAuth(request);

    if (!isAuth) {
      return NextResponse.json(
        { error: 'Unauthorized. Login required.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const items: ManualPlanItem[] = body.items || [];

    if (items.length === 0) {
      return NextResponse.json(
        { error: 'No items provided' },
        { status: 400 }
      );
    }

    // Get sellable products
    const sellableProductIds = [...new Set(items.map(i => i.sellable_product_id))];
    const variationIds = [...new Set(items.map(i => i.variation_id).filter(Boolean))] as string[];

    // Fetch sellable products
    const { data: sellableProducts } = await supabaseAdmin
      .from('sellable_products')
      .select(`
        id,
        code,
        name,
        product_id,
        bottle_type_id
      `)
      .in('id', sellableProductIds);

    // Fetch ALL variations for these sellable products
    // This covers both simple products (1 variation) and variation products (multiple variations)
    const { data: variations, error: variationsError } = await supabaseAdmin
      .from('sellable_product_variations')
      .select(`
        id,
        sellable_product_id,
        bottle_type_id,
        bottle:bottle_types (
          id,
          size,
          capacity_ml,
          price
        )
      `)
      .in('sellable_product_id', sellableProductIds);

    // Get all product IDs from sellable products
    const productIds = [...new Set(sellableProducts?.map(sp => sp.product_id).filter(Boolean))];

    // Fetch product recipes
    const { data: recipes } = await supabaseAdmin
      .from('product_recipes')
      .select(`
        id,
        product_id,
        raw_material_id,
        quantity_per_unit,
        raw_material:raw_materials (
          id,
          name,
          unit,
          average_price
        )
      `)
      .in('product_id', productIds.length > 0 ? productIds : ['00000000-0000-0000-0000-000000000000']);

    // Fetch bottle types for sellable products without variations
    const bottleTypeIds = [
      ...new Set([
        ...(sellableProducts?.map(sp => sp.bottle_type_id).filter(Boolean) || []),
        ...(variations?.map(v => v.bottle_type_id).filter(Boolean) || [])
      ])
    ];

    const { data: bottleTypes } = await supabaseAdmin
      .from('bottle_types')
      .select('id, size, capacity_ml, price')
      .in('id', bottleTypeIds.length > 0 ? bottleTypeIds : ['00000000-0000-0000-0000-000000000000']);

    // Build lookup maps
    const sellableProductMap = new Map(sellableProducts?.map(sp => [sp.id, sp]));
    const variationMap = new Map(variations?.map(v => [v.id, v]));
    const bottleTypeMap = new Map(bottleTypes?.map(bt => [bt.id, bt]));

    // Build variation map by sellable_product_id (for simple products)
    type VariationType = NonNullable<typeof variations>[number];
    const variationBySellableProductMap = new Map<string, VariationType>();
    variations?.forEach(v => {
      // Only set if not already set (for simple products, there's only one variation)
      if (!variationBySellableProductMap.has(v.sellable_product_id)) {
        variationBySellableProductMap.set(v.sellable_product_id, v);
      }
    });

    // Build recipe map by product_id
    const recipeMap = new Map<string, Array<{
      raw_material_id: string;
      raw_material_name: string;
      unit: string;
      quantity_per_unit: number;
      average_price: number;
    }>>();

    recipes?.forEach(r => {
      if (!recipeMap.has(r.product_id)) {
        recipeMap.set(r.product_id, []);
      }
      recipeMap.get(r.product_id)!.push({
        raw_material_id: r.raw_material_id,
        raw_material_name: (r.raw_material as any)?.name || 'Unknown',
        unit: (r.raw_material as any)?.unit || '',
        quantity_per_unit: r.quantity_per_unit,
        average_price: (r.raw_material as any)?.average_price || 0
      });
    });

    // Calculate cost per liter for each product
    const costPerLiterMap = new Map<string, number>();
    recipeMap.forEach((ingredients, productId) => {
      const costPerLiter = ingredients.reduce((sum, ing) => {
        return sum + (ing.quantity_per_unit * ing.average_price);
      }, 0);
      costPerLiterMap.set(productId, costPerLiter);
    });

    // Calculate summary for each item
    interface ProductSummaryData {
      sellableProductId: string;
      sellableProductCode: string;
      sellableProductName: string;
      productId: string;
      bottleTypeId: string;
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
      orders: Array<{
        orderId: string;
        orderNumber: string;
        customerName: string;
        deliveryDate: string;
        quantity: number;
      }>;
    }

    const productSummary = new Map<string, ProductSummaryData>();

    // Materials usage tracking
    const materialsUsage = new Map<string, {
      materialId: string;
      materialName: string;
      unit: string;
      totalQuantity: number;
      averagePrice: number;
      totalCost: number;
    }>();

    items.forEach(item => {
      const sellableProduct = sellableProductMap.get(item.sellable_product_id);
      if (!sellableProduct) return;

      // Get bottle info - from variation or directly from sellable product
      let bottleInfo: { id: string; size: string; capacity_ml: number; price: number } | null = null;

      if (item.variation_id) {
        // Variation product with specific variation selected
        const variation = variationMap.get(item.variation_id);
        if (variation?.bottle) {
          bottleInfo = variation.bottle as any;
        }
      } else {
        // Simple product - get the single variation row for this sellable product
        const simpleVariation = variationBySellableProductMap.get(item.sellable_product_id);
        if (simpleVariation?.bottle) {
          bottleInfo = simpleVariation.bottle as any;
        } else if (sellableProduct.bottle_type_id) {
          // Fallback to bottle_type_id on sellable_products table
          bottleInfo = bottleTypeMap.get(sellableProduct.bottle_type_id) || null;
        }
      }

      if (!bottleInfo) {
        bottleInfo = {
          id: '',
          size: '-',
          capacity_ml: 0,
          price: 0
        };
      }

      const key = `${item.sellable_product_id}-${bottleInfo.id || 'default'}`;
      const productId = sellableProduct.product_id;
      const capacityMl = bottleInfo.capacity_ml || 0;
      const capacityLiters = capacityMl / 1000;

      // Calculate costs
      const costPerLiter = costPerLiterMap.get(productId) || 0;
      const materialCostPerBottle = costPerLiter * capacityLiters;
      const bottleCostPerBottle = bottleInfo.price || 0;
      const totalCostPerBottle = materialCostPerBottle + bottleCostPerBottle;

      if (!productSummary.has(key)) {
        productSummary.set(key, {
          sellableProductId: item.sellable_product_id,
          sellableProductCode: sellableProduct.code,
          sellableProductName: sellableProduct.name,
          productId: productId,
          bottleTypeId: bottleInfo.id,
          bottleSize: bottleInfo.size || '-',
          capacityMl: capacityMl,
          totalQuantity: 0,
          volumeLiters: 0,
          materialCostPerBottle,
          bottleCostPerBottle,
          totalCostPerBottle,
          totalMaterialCost: 0,
          totalBottleCost: 0,
          totalCost: 0,
          orders: [] // Empty for manual plan
        });
      }

      const summary = productSummary.get(key)!;
      summary.totalQuantity += item.quantity;
      summary.volumeLiters += item.quantity * capacityLiters;
      summary.totalMaterialCost += item.quantity * materialCostPerBottle;
      summary.totalBottleCost += item.quantity * bottleCostPerBottle;
      summary.totalCost += item.quantity * totalCostPerBottle;

      // Track materials usage
      const productRecipes = recipeMap.get(productId) || [];
      productRecipes.forEach(recipe => {
        const materialKey = recipe.raw_material_id;
        const quantityNeeded = recipe.quantity_per_unit * item.quantity * capacityLiters;

        if (!materialsUsage.has(materialKey)) {
          materialsUsage.set(materialKey, {
            materialId: recipe.raw_material_id,
            materialName: recipe.raw_material_name,
            unit: recipe.unit,
            totalQuantity: 0,
            averagePrice: recipe.average_price,
            totalCost: 0
          });
        }

        const usage = materialsUsage.get(materialKey)!;
        usage.totalQuantity += quantityNeeded;
        usage.totalCost += quantityNeeded * recipe.average_price;
      });
    });

    // Convert to arrays
    const summaryArray = Array.from(productSummary.values())
      .sort((a, b) => b.totalQuantity - a.totalQuantity);

    const materialsSummaryArray = Array.from(materialsUsage.values())
      .sort((a, b) => b.totalCost - a.totalCost);

    // Fetch current raw material stock
    const materialIds = materialsSummaryArray.map(m => m.materialId);
    const { data: rawMaterialStocks } = await supabaseAdmin
      .from('raw_materials')
      .select('id, current_stock')
      .in('id', materialIds.length > 0 ? materialIds : ['00000000-0000-0000-0000-000000000000']);

    const rawMaterialStockMap = new Map(rawMaterialStocks?.map(rm => [rm.id, rm.current_stock || 0]));

    // Add current stock to materials summary
    const materialsSummaryWithStock = materialsSummaryArray.map(m => ({
      ...m,
      currentStock: rawMaterialStockMap.get(m.materialId) || 0,
      isSufficient: (rawMaterialStockMap.get(m.materialId) || 0) >= m.totalQuantity
    }));

    // Fetch current bottle stock and calculate bottle usage
    const bottleUsage = new Map<string, {
      bottleTypeId: string;
      bottleSize: string;
      capacityMl: number;
      totalQuantity: number;
      price: number;
    }>();

    summaryArray.forEach(item => {
      if (item.bottleTypeId) {
        if (!bottleUsage.has(item.bottleTypeId)) {
          bottleUsage.set(item.bottleTypeId, {
            bottleTypeId: item.bottleTypeId,
            bottleSize: item.bottleSize,
            capacityMl: item.capacityMl,
            totalQuantity: 0,
            price: item.bottleCostPerBottle
          });
        }
        const usage = bottleUsage.get(item.bottleTypeId)!;
        usage.totalQuantity += item.totalQuantity;
      }
    });

    const bottleUsageArray = Array.from(bottleUsage.values());
    const bottleTypeIdsForStock = bottleUsageArray.map(b => b.bottleTypeId);

    const { data: bottleStocks } = await supabaseAdmin
      .from('bottle_types')
      .select('id, current_stock')
      .in('id', bottleTypeIdsForStock.length > 0 ? bottleTypeIdsForStock : ['00000000-0000-0000-0000-000000000000']);

    const bottleStockMap = new Map(bottleStocks?.map(b => [b.id, b.current_stock || 0]));

    const bottleSummaryWithStock = bottleUsageArray.map(b => ({
      ...b,
      currentStock: bottleStockMap.get(b.bottleTypeId) || 0,
      isSufficient: (bottleStockMap.get(b.bottleTypeId) || 0) >= b.totalQuantity
    }));

    // Calculate totals
    const totals = {
      totalBottles: summaryArray.reduce((sum, p) => sum + p.totalQuantity, 0),
      totalVolumeLiters: summaryArray.reduce((sum, p) => sum + p.volumeLiters, 0),
      totalMaterialCost: summaryArray.reduce((sum, p) => sum + p.totalMaterialCost, 0),
      totalBottleCost: summaryArray.reduce((sum, p) => sum + p.totalBottleCost, 0),
      totalCost: summaryArray.reduce((sum, p) => sum + p.totalCost, 0)
    };

    return NextResponse.json({
      report: {
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        summary: summaryArray,
        byDate: [], // Empty for manual plan
        materialsSummary: materialsSummaryWithStock,
        bottleSummary: bottleSummaryWithStock,
        totals
      }
    });

  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
