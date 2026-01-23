// Path: app/api/dashboard/route.ts
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
async function checkAuth(request: NextRequest): Promise<boolean> {
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return false;
    }

    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Auth check error:', error);
    return false;
  }
}

// GET - Get dashboard stats
export async function GET(request: NextRequest) {
  try {
    const isAuth = await checkAuth(request);

    if (!isAuth) {
      return NextResponse.json(
        { error: 'Unauthorized. Login required.' },
        { status: 401 }
      );
    }

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 1. Today's production batches
    const { data: productionBatches, error: productionError } = await supabaseAdmin
      .from('production_batches')
      .select(`
        id,
        batch_id,
        status,
        total_bottles,
        created_at,
        products (
          name
        )
      `)
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString())
      .order('created_at', { ascending: false });

    if (productionError) {
      console.error('Production error:', productionError);
    }

    // 2. Low stock raw materials
    const { data: lowStockMaterials, error: materialsError } = await supabaseAdmin
      .from('raw_materials')
      .select('id, name, current_stock, min_stock, unit')
      .lte('current_stock', supabaseAdmin.rpc('get_min_stock_threshold'))
      .or('current_stock.lte.min_stock')
      .order('current_stock', { ascending: true })
      .limit(10);

    // Alternative query if the above doesn't work
    const { data: allMaterials } = await supabaseAdmin
      .from('raw_materials')
      .select('id, name, current_stock, min_stock, unit')
      .order('current_stock', { ascending: true });

    const lowMaterials = (allMaterials || []).filter(
      (m: any) => m.current_stock <= m.min_stock
    ).slice(0, 10);

    // 3. Low stock bottles
    const { data: allBottles } = await supabaseAdmin
      .from('bottle_types')
      .select('id, size, current_stock, min_stock, capacity_ml')
      .order('current_stock', { ascending: true });

    const lowBottles = (allBottles || []).filter(
      (b: any) => b.current_stock <= b.min_stock
    ).slice(0, 10);

    // 4. Orders to deliver today
    const { data: todayDeliveries, error: deliveriesError } = await supabaseAdmin
      .from('orders')
      .select(`
        id,
        order_number,
        delivery_date,
        order_status,
        total_amount,
        customers (
          id,
          name,
          phone
        )
      `)
      .gte('delivery_date', today.toISOString().split('T')[0])
      .lt('delivery_date', tomorrow.toISOString().split('T')[0])
      .in('order_status', ['new', 'shipping'])
      .order('delivery_date', { ascending: true });

    if (deliveriesError) {
      console.error('Deliveries error:', deliveriesError);
    }

    // Format the data
    const stats = {
      todayProduction: {
        count: productionBatches?.length || 0,
        batches: (productionBatches || []).map((batch: any) => ({
          id: batch.id,
          batchNumber: batch.batch_id,
          productName: batch.products?.name || 'Unknown',
          status: batch.status,
          quantity: batch.total_bottles,
          createdAt: batch.created_at
        }))
      },
      lowStockMaterials: {
        count: lowMaterials.length,
        items: lowMaterials.map((item: any) => ({
          id: item.id,
          name: item.name,
          currentStock: item.current_stock,
          minStock: item.min_stock,
          unit: item.unit,
          shortage: item.min_stock - item.current_stock
        }))
      },
      lowStockBottles: {
        count: lowBottles.length,
        items: lowBottles.map((item: any) => ({
          id: item.id,
          size: item.size,
          capacityMl: item.capacity_ml,
          currentStock: item.current_stock,
          minStock: item.min_stock,
          shortage: item.min_stock - item.current_stock
        }))
      },
      todayDeliveries: {
        count: todayDeliveries?.length || 0,
        orders: (todayDeliveries || []).map((order: any) => ({
          id: order.id,
          orderNumber: order.order_number,
          deliveryDate: order.delivery_date,
          status: order.order_status,
          totalAmount: order.total_amount,
          customer: {
            id: order.customers?.id,
            name: order.customers?.name,
            phone: order.customers?.phone
          }
        }))
      }
    };

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
