// Path: app/api/production/[id]/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Type definitions
interface PlannedItem {
  bottle_type_id: string;
  quantity: number;
}

interface ActualItem {
  bottle_type_id: string;
  quantity: number;
  defects?: number;
}

interface ActualMaterial {
  material_id: string;
  quantity_used: number;
}

interface ExecutionData {
  actual_items: ActualItem[];
  actual_materials: ActualMaterial[];
  brix_before?: number;
  brix_after?: number;
  acidity_before?: number;
  acidity_after?: number;
  quality_images?: string[];
  execution_notes?: string;
}

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

// GET - ดึงรายละเอียด production batch
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { isAuth } = await checkAuth(request);

    if (!isAuth) {
      return NextResponse.json(
        { error: 'Unauthorized. Login required.' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Fetch batch
    const { data: batch, error } = await supabaseAdmin
      .from('production_batches')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !batch) {
      return NextResponse.json(
        { error: 'Production batch not found' },
        { status: 404 }
      );
    }

    // Fetch product details
    const { data: product } = await supabaseAdmin
      .from('products')
      .select('id, name, image')
      .eq('id', batch.product_id)
      .single();

    // Fetch bottle types for planned items
    const bottleIds = (batch.planned_items as PlannedItem[] || [])
      .map(item => item.bottle_type_id);

    let bottleTypes: any[] = [];
    if (bottleIds.length > 0) {
      const { data } = await supabaseAdmin
        .from('bottle_types')
        .select('id, size, stock, capacity_ml')
        .in('id', bottleIds);
      bottleTypes = data || [];
    }

    // Fetch recipes and raw materials
    const { data: recipes } = await supabaseAdmin
      .from('product_recipes')
      .select(`
        raw_material_id,
        quantity_per_unit,
        raw_materials (id, name, current_stock, unit, average_price)
      `)
      .eq('product_id', batch.product_id);

    return NextResponse.json({
      batch,
      product,
      bottle_types: bottleTypes,
      recipes: recipes || []
    });
  } catch (error) {
    console.error('Error fetching batch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH - อัพเดทสถานะ production batch
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { isAuth, userId } = await checkAuth(request);

    if (!isAuth) {
      return NextResponse.json(
        { error: 'Unauthorized. Login required.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { action, ...data } = body;

    // Fetch current batch
    const { data: batch, error: fetchError } = await supabaseAdmin
      .from('production_batches')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !batch) {
      return NextResponse.json(
        { error: 'Production batch not found' },
        { status: 404 }
      );
    }

    let updateData: any = {
      updated_at: new Date().toISOString()
    };

    switch (action) {
      case 'start':
        // เริ่มผลิต
        if (batch.status !== 'planned') {
          return NextResponse.json(
            { error: 'Can only start production from planned status' },
            { status: 400 }
          );
        }
        updateData.status = 'in_progress';
        updateData.started_at = new Date().toISOString();
        updateData.started_by = userId;
        break;

      case 'complete':
        // เสร็จสิ้นการผลิต
        if (batch.status !== 'in_progress') {
          return NextResponse.json(
            { error: 'Can only complete production from in_progress status' },
            { status: 400 }
          );
        }

        const execData = data as ExecutionData;

        // Validate execution data
        if (!execData.actual_items || execData.actual_items.length === 0) {
          return NextResponse.json(
            { error: 'Actual items are required' },
            { status: 400 }
          );
        }

        // Deduct bottle stock
        for (const item of execData.actual_items) {
          const { data: bottle } = await supabaseAdmin
            .from('bottle_types')
            .select('id, stock')
            .eq('id', item.bottle_type_id)
            .single();

          if (bottle) {
            const newStock = bottle.stock - item.quantity;
            if (newStock < 0) {
              return NextResponse.json(
                { error: `Insufficient bottle stock for ${item.bottle_type_id}` },
                { status: 400 }
              );
            }

            await supabaseAdmin
              .from('bottle_types')
              .update({ stock: newStock, updated_at: new Date().toISOString() })
              .eq('id', item.bottle_type_id);

            // Create bottle stock transaction
            await supabaseAdmin
              .from('bottle_stock_transactions')
              .insert({
                bottle_id: item.bottle_type_id,
                transaction_type: 'production',
                quantity: item.quantity,
                notes: `Production batch: ${batch.batch_id}`,
                created_at: new Date().toISOString()
              });
          }
        }

        // Deduct raw materials
        if (execData.actual_materials && execData.actual_materials.length > 0) {
          for (const matUsage of execData.actual_materials) {
            const { data: material } = await supabaseAdmin
              .from('raw_materials')
              .select('id, name, current_stock, unit')
              .eq('id', matUsage.material_id)
              .single();

            if (material) {
              const newStock = material.current_stock - matUsage.quantity_used;

              await supabaseAdmin
                .from('raw_materials')
                .update({ current_stock: newStock, updated_at: new Date().toISOString() })
                .eq('id', matUsage.material_id);

              // Create stock transaction
              await supabaseAdmin
                .from('stock_transactions')
                .insert({
                  raw_material_id: matUsage.material_id,
                  transaction_type: 'out',
                  quantity: matUsage.quantity_used,
                  notes: `Production batch: ${batch.batch_id}`,
                  created_at: new Date().toISOString()
                });
            }
          }
        }

        updateData.status = 'completed';
        updateData.completed_at = new Date().toISOString();
        updateData.completed_by = userId;
        updateData.actual_items = execData.actual_items;
        updateData.actual_materials = execData.actual_materials;
        updateData.brix_before = execData.brix_before;
        updateData.brix_after = execData.brix_after;
        updateData.acidity_before = execData.acidity_before;
        updateData.acidity_after = execData.acidity_after;
        updateData.quality_images = execData.quality_images || [];
        updateData.execution_notes = execData.execution_notes;
        break;

      case 'cancel':
        // ยกเลิก
        if (batch.status === 'completed') {
          return NextResponse.json(
            { error: 'Cannot cancel completed production' },
            { status: 400 }
          );
        }
        updateData.status = 'cancelled';
        updateData.cancelled_at = new Date().toISOString();
        updateData.cancelled_by = userId;
        updateData.cancelled_reason = data.reason || null;
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    // Update batch
    const { data: updatedBatch, error: updateError } = await supabaseAdmin
      .from('production_batches')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      batch: updatedBatch,
      message: `Production ${action} successful`
    });
  } catch (error) {
    console.error('Error updating batch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
