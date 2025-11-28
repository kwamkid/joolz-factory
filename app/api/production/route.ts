// Path: app/api/production/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Type definitions
interface PlannedItem {
  bottle_type_id: string;
  quantity: number;
}

interface ProductionPlanData {
  batch_id: string;
  product_id: string;
  planned_date: string;
  planned_items: PlannedItem[];
  planned_notes?: string;
}

// สร้าง Supabase Admin client (service role)
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

// Helper function: ตรวจสอบว่าล็อกอินหรือไม่ และคืนค่า user
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

// POST - สร้างแผนการผลิต
export async function POST(request: NextRequest) {
  try {
    const { isAuth, userId } = await checkAuth(request);

    if (!isAuth) {
      return NextResponse.json(
        { error: 'Unauthorized. Login required.' },
        { status: 401 }
      );
    }

    const planData: ProductionPlanData = await request.json();

    // Validate required fields
    if (!planData.batch_id || !planData.product_id || !planData.planned_date || !planData.planned_items) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate planned_items
    const validItems = planData.planned_items.filter(item => item.quantity > 0);
    if (validItems.length === 0) {
      return NextResponse.json(
        { error: 'At least one bottle type with quantity > 0 is required' },
        { status: 400 }
      );
    }

    // Check if batch_id already exists
    const { data: existingBatch } = await supabaseAdmin
      .from('production_batches')
      .select('id')
      .eq('batch_id', planData.batch_id)
      .single();

    if (existingBatch) {
      return NextResponse.json(
        { error: 'Batch ID already exists' },
        { status: 400 }
      );
    }

    // Verify product exists
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('id, name')
      .eq('id', planData.product_id)
      .single();

    if (productError || !product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Calculate total volume (in liters) from planned items
    const bottleIds = validItems.map(item => item.bottle_type_id);
    const { data: bottles } = await supabaseAdmin
      .from('bottle_types')
      .select('id, capacity_ml')
      .in('id', bottleIds);

    let totalVolumeLiters = 0;
    for (const item of validItems) {
      const bottle = bottles?.find(b => b.id === item.bottle_type_id);
      if (bottle) {
        totalVolumeLiters += (bottle.capacity_ml / 1000) * item.quantity;
      }
    }

    // Check material availability
    let insufficientMaterials = null;
    let hasWarning = false;

    try {
      const { data: availabilityCheck, error: checkError } = await supabaseAdmin
        .rpc('check_material_availability', {
          p_product_id: planData.product_id,
          p_total_volume_liters: totalVolumeLiters
        });

      if (!checkError && availabilityCheck && availabilityCheck.length > 0) {
        const check = availabilityCheck[0];
        if (!check.is_sufficient) {
          insufficientMaterials = check.insufficient_materials;
          hasWarning = true;
        }
      }
    } catch (err) {
      console.log('Material availability check error (function may not exist yet):', err);
      // Continue without check if function doesn't exist
    }

    // Create production batch record (allow creation even if materials insufficient)
    const { data: batch, error: batchError } = await supabaseAdmin
      .from('production_batches')
      .insert({
        batch_id: planData.batch_id,
        product_id: planData.product_id,
        planned_date: planData.planned_date,
        planned_items: validItems,
        planned_notes: planData.planned_notes || null,
        planned_by: userId,
        planned_at: new Date().toISOString(),
        status: 'planned',
        insufficient_materials: insufficientMaterials,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (batchError) {
      console.error('Batch creation error:', batchError);
      return NextResponse.json(
        { error: batchError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      id: batch.id,
      batch_id: batch.batch_id,
      has_warning: hasWarning,
      insufficient_materials: insufficientMaterials,
      message: hasWarning
        ? 'แผนการผลิตถูกสร้างแล้ว แต่วัตถุดิบไม่เพียงพอ กรุณาซื้อเพิ่ม'
        : 'สร้างแผนการผลิตสำเร็จ'
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - ดึงรายการผลิต
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
    const productId = searchParams.get('product_id');
    const status = searchParams.get('status');

    let query = supabaseAdmin
      .from('production_batches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (productId) {
      query = query.eq('product_id', productId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: batches, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Fetch product details for each batch
    const batchesWithDetails = await Promise.all(
      (batches || []).map(async (batch) => {
        const { data: product } = await supabaseAdmin
          .from('products')
          .select('name, image')
          .eq('id', batch.product_id)
          .single();

        // Fetch bottle types for each planned item
        const plannedItems = batch.planned_items as PlannedItem[] || [];
        console.log('Batch:', batch.batch_id, 'Planned items:', plannedItems);

        const itemsWithBottleTypes = await Promise.all(
          plannedItems.map(async (item) => {
            const { data: bottleType, error: bottleError } = await supabaseAdmin
              .from('bottle_types')
              .select('size')
              .eq('id', item.bottle_type_id)
              .single();

            if (bottleError) {
              console.error('Error fetching bottle type:', item.bottle_type_id, bottleError);
            }

            console.log('Bottle type for', item.bottle_type_id, ':', bottleType);

            return {
              ...item,
              bottle_types: bottleType ? { size: bottleType.size } : undefined
            };
          })
        );

        console.log('Items with bottle types:', itemsWithBottleTypes);

        // Calculate total bottles from planned_items
        const totalBottles = plannedItems.reduce((sum, item) => sum + item.quantity, 0);

        return {
          ...batch,
          planned_items: itemsWithBottleTypes,
          products: {
            name: product?.name,
            image: product?.image
          },
          total_bottles: totalBottles
        };
      })
    );

    return NextResponse.json({ batches: batchesWithDetails });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
