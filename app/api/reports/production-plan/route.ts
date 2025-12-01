// Path: app/api/reports/production-plan/route.ts
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

// GET - Get production plan report by delivery date range
export async function GET(request: NextRequest) {
  try {
    const { isAuth } = await checkAuth(request);

    if (!isAuth) {
      return NextResponse.json(
        { error: 'Unauthorized. Login required.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'start_date and end_date are required' },
        { status: 400 }
      );
    }

    // Get orders with items for the date range
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select(`
        id,
        order_number,
        delivery_date,
        order_status,
        customer:customers (
          id,
          customer_code,
          name,
          phone
        )
      `)
      .gte('delivery_date', startDate)
      .lte('delivery_date', endDate)
      .neq('order_status', 'cancelled')
      .order('delivery_date', { ascending: true });

    if (ordersError) {
      console.error('Orders fetch error:', ordersError);
      return NextResponse.json(
        { error: ordersError.message },
        { status: 500 }
      );
    }

    const orderIds = orders?.map(o => o.id) || [];

    if (orderIds.length === 0) {
      return NextResponse.json({
        report: {
          startDate,
          endDate,
          summary: [],
          byDate: [],
          materialsSummary: [],
          totals: {
            totalBottles: 0,
            totalVolumeLiters: 0,
            totalMaterialCost: 0,
            totalBottleCost: 0,
            totalCost: 0
          }
        }
      });
    }

    // Get order items with sellable product and variation info
    const { data: orderItems, error: itemsError } = await supabaseAdmin
      .from('order_items')
      .select(`
        id,
        order_id,
        sellable_product_id,
        variation_id,
        product_code,
        product_name,
        bottle_size,
        quantity,
        unit_price
      `)
      .in('order_id', orderIds);

    if (itemsError) {
      console.error('Order items fetch error:', itemsError);
      return NextResponse.json(
        { error: itemsError.message },
        { status: 500 }
      );
    }

    // Get sellable products with their base products
    const sellableProductIds = [...new Set(orderItems?.map(i => i.sellable_product_id).filter(Boolean))];
    const variationIds = [...new Set(orderItems?.map(i => i.variation_id).filter(Boolean))];

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
      .in('id', sellableProductIds.length > 0 ? sellableProductIds : ['00000000-0000-0000-0000-000000000000']);

    // Fetch variations with bottle info
    const { data: variations } = await supabaseAdmin
      .from('sellable_product_variations')
      .select(`
        id,
        sellable_product_id,
        bottle_type_id,
        bottle:bottle_types (
          id,
          size,
          capacity_ml,
          average_price
        )
      `)
      .in('id', variationIds.length > 0 ? variationIds : ['00000000-0000-0000-0000-000000000000']);

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
      .select('id, size, capacity_ml, average_price')
      .in('id', bottleTypeIds.length > 0 ? bottleTypeIds : ['00000000-0000-0000-0000-000000000000']);

    // Build lookup maps
    const orderMap = new Map(orders?.map(o => [o.id, o]));
    const sellableProductMap = new Map(sellableProducts?.map(sp => [sp.id, sp]));
    const variationMap = new Map(variations?.map(v => [v.id, v]));
    const bottleTypeMap = new Map(bottleTypes?.map(bt => [bt.id, bt]));

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

    // Aggregate by sellable product + bottle size
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

    orderItems?.forEach(item => {
      const order = orderMap.get(item.order_id);
      if (!order) return;

      const sellableProduct = sellableProductMap.get(item.sellable_product_id);
      if (!sellableProduct) return;

      // Get bottle info - from variation or directly from sellable product
      let bottleInfo: { id: string; size: string; capacity_ml: number; average_price: number } | null = null;

      if (item.variation_id) {
        const variation = variationMap.get(item.variation_id);
        if (variation?.bottle) {
          bottleInfo = variation.bottle as any;
        }
      } else if (sellableProduct.bottle_type_id) {
        bottleInfo = bottleTypeMap.get(sellableProduct.bottle_type_id) || null;
      }

      if (!bottleInfo) {
        // Try to get from bottle_size string
        bottleInfo = {
          id: '',
          size: item.bottle_size || '-',
          capacity_ml: 0,
          average_price: 0
        };
      }

      const key = `${item.sellable_product_id}-${bottleInfo.id || item.bottle_size}`;
      const productId = sellableProduct.product_id;
      const capacityMl = bottleInfo.capacity_ml || 0;
      const capacityLiters = capacityMl / 1000;

      // Calculate costs
      const costPerLiter = costPerLiterMap.get(productId) || 0;
      const materialCostPerBottle = costPerLiter * capacityLiters;
      const bottleCostPerBottle = bottleInfo.average_price || 0;
      const totalCostPerBottle = materialCostPerBottle + bottleCostPerBottle;

      if (!productSummary.has(key)) {
        productSummary.set(key, {
          sellableProductId: item.sellable_product_id,
          sellableProductCode: sellableProduct.code,
          sellableProductName: sellableProduct.name,
          productId: productId,
          bottleTypeId: bottleInfo.id,
          bottleSize: bottleInfo.size || item.bottle_size || '-',
          capacityMl: capacityMl,
          totalQuantity: 0,
          volumeLiters: 0,
          materialCostPerBottle,
          bottleCostPerBottle,
          totalCostPerBottle,
          totalMaterialCost: 0,
          totalBottleCost: 0,
          totalCost: 0,
          orders: []
        });
      }

      const summary = productSummary.get(key)!;
      summary.totalQuantity += item.quantity;
      summary.volumeLiters += item.quantity * capacityLiters;
      summary.totalMaterialCost += item.quantity * materialCostPerBottle;
      summary.totalBottleCost += item.quantity * bottleCostPerBottle;
      summary.totalCost += item.quantity * totalCostPerBottle;
      summary.orders.push({
        orderId: order.id,
        orderNumber: order.order_number,
        customerName: (order.customer as any)?.name || 'Unknown',
        deliveryDate: order.delivery_date,
        quantity: item.quantity
      });

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

    // Calculate totals
    const totals = {
      totalBottles: summaryArray.reduce((sum, p) => sum + p.totalQuantity, 0),
      totalVolumeLiters: summaryArray.reduce((sum, p) => sum + p.volumeLiters, 0),
      totalMaterialCost: summaryArray.reduce((sum, p) => sum + p.totalMaterialCost, 0),
      totalBottleCost: summaryArray.reduce((sum, p) => sum + p.totalBottleCost, 0),
      totalCost: summaryArray.reduce((sum, p) => sum + p.totalCost, 0)
    };

    // Group by date
    const byDateMap = new Map<string, Map<string, ProductSummaryData>>();

    orderItems?.forEach(item => {
      const order = orderMap.get(item.order_id);
      if (!order) return;

      const sellableProduct = sellableProductMap.get(item.sellable_product_id);
      if (!sellableProduct) return;

      let bottleInfo: { id: string; size: string; capacity_ml: number; average_price: number } | null = null;

      if (item.variation_id) {
        const variation = variationMap.get(item.variation_id);
        if (variation?.bottle) {
          bottleInfo = variation.bottle as any;
        }
      } else if (sellableProduct.bottle_type_id) {
        bottleInfo = bottleTypeMap.get(sellableProduct.bottle_type_id) || null;
      }

      if (!bottleInfo) {
        bottleInfo = { id: '', size: item.bottle_size || '-', capacity_ml: 0, average_price: 0 };
      }

      const deliveryDate = order.delivery_date;
      const key = `${item.sellable_product_id}-${bottleInfo.id || item.bottle_size}`;
      const productId = sellableProduct.product_id;
      const capacityMl = bottleInfo.capacity_ml || 0;
      const capacityLiters = capacityMl / 1000;

      const costPerLiter = costPerLiterMap.get(productId) || 0;
      const materialCostPerBottle = costPerLiter * capacityLiters;
      const bottleCostPerBottle = bottleInfo.average_price || 0;
      const totalCostPerBottle = materialCostPerBottle + bottleCostPerBottle;

      if (!byDateMap.has(deliveryDate)) {
        byDateMap.set(deliveryDate, new Map());
      }

      const dateProducts = byDateMap.get(deliveryDate)!;
      if (!dateProducts.has(key)) {
        dateProducts.set(key, {
          sellableProductId: item.sellable_product_id,
          sellableProductCode: sellableProduct.code,
          sellableProductName: sellableProduct.name,
          productId: productId,
          bottleTypeId: bottleInfo.id,
          bottleSize: bottleInfo.size || item.bottle_size || '-',
          capacityMl: capacityMl,
          totalQuantity: 0,
          volumeLiters: 0,
          materialCostPerBottle,
          bottleCostPerBottle,
          totalCostPerBottle,
          totalMaterialCost: 0,
          totalBottleCost: 0,
          totalCost: 0,
          orders: []
        });
      }

      const dateSummary = dateProducts.get(key)!;
      dateSummary.totalQuantity += item.quantity;
      dateSummary.volumeLiters += item.quantity * capacityLiters;
      dateSummary.totalMaterialCost += item.quantity * materialCostPerBottle;
      dateSummary.totalBottleCost += item.quantity * bottleCostPerBottle;
      dateSummary.totalCost += item.quantity * totalCostPerBottle;
    });

    const byDateArray = Array.from(byDateMap.entries())
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, products]) => ({
        date,
        products: Array.from(products.values()).sort((a, b) => b.totalQuantity - a.totalQuantity),
        dateTotals: {
          totalBottles: Array.from(products.values()).reduce((sum, p) => sum + p.totalQuantity, 0),
          totalVolumeLiters: Array.from(products.values()).reduce((sum, p) => sum + p.volumeLiters, 0),
          totalCost: Array.from(products.values()).reduce((sum, p) => sum + p.totalCost, 0)
        }
      }));

    return NextResponse.json({
      report: {
        startDate,
        endDate,
        summary: summaryArray,
        byDate: byDateArray,
        materialsSummary: materialsSummaryArray,
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
