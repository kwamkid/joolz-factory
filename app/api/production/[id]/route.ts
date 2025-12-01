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
        .select('id, size, stock, capacity_ml, price')
        .in('id', bottleIds);
      bottleTypes = data || [];
    }

    // Fetch sellable products with their variations for this product
    const { data: sellableProducts } = await supabaseAdmin
      .from('sellable_products')
      .select(`
        id,
        code,
        name,
        image,
        product_id,
        sellable_product_variations (
          id,
          bottle_type_id
        )
      `)
      .eq('product_id', batch.product_id);

    // Build a map of bottle_type_id -> sellable product for quick lookup
    const sellableByBottleType: Record<string, { id: string; code: string; name: string; image: string | null }> = {};
    sellableProducts?.forEach(sp => {
      const variations = sp.sellable_product_variations as any[];
      variations?.forEach(v => {
        if (v.bottle_type_id) {
          sellableByBottleType[v.bottle_type_id] = {
            id: sp.id,
            code: sp.code,
            name: sp.name,
            image: sp.image
          };
        }
      });
    });

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
      recipes: recipes || [],
      sellable_by_bottle_type: sellableByBottleType
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
        // เริ่มผลิต - ต้องตรวจสอบวัตถุดิบก่อน
        if (batch.status !== 'planned') {
          return NextResponse.json(
            { error: 'Can only start production from planned status' },
            { status: 400 }
          );
        }

        // คำนวณปริมาตรรวม
        const bottleIds = (batch.planned_items as PlannedItem[] || [])
          .map(item => item.bottle_type_id);
        const { data: bottles } = await supabaseAdmin
          .from('bottle_types')
          .select('id, capacity_ml')
          .in('id', bottleIds);

        let totalVolumeLiters = 0;
        for (const item of (batch.planned_items as PlannedItem[])) {
          const bottle = bottles?.find(b => b.id === item.bottle_type_id);
          if (bottle) {
            totalVolumeLiters += (bottle.capacity_ml / 1000) * item.quantity;
          }
        }

        // ตรวจสอบวัตถุดิบ
        try {
          const { data: availabilityCheck, error: checkError } = await supabaseAdmin
            .rpc('check_material_availability', {
              p_product_id: batch.product_id,
              p_total_volume_liters: totalVolumeLiters
            });

          if (!checkError && availabilityCheck && availabilityCheck.length > 0) {
            const check = availabilityCheck[0];
            if (!check.is_sufficient) {
              return NextResponse.json(
                {
                  error: 'วัตถุดิบไม่เพียงพอ กรุณาซื้อเพิ่มก่อนเริ่มผลิต',
                  insufficient_materials: check.insufficient_materials
                },
                { status: 400 }
              );
            }
          }
        } catch (err) {
          console.log('Material check error:', err);
          // ถ้า function ไม่มี ให้ผ่านไปได้
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

        if (!execData.actual_materials || execData.actual_materials.length === 0) {
          return NextResponse.json(
            { error: 'Actual materials are required' },
            { status: 400 }
          );
        }

        // Deduct bottle stock and calculate bottle cost
        let calculatedBottleCost = 0;
        let calculatedTotalVolumeMl = 0;

        for (const item of execData.actual_items) {
          const { data: bottle } = await supabaseAdmin
            .from('bottle_types')
            .select('id, stock, size, price, capacity_ml')
            .eq('id', item.bottle_type_id)
            .single();

          if (bottle) {
            const newStock = bottle.stock - item.quantity;
            if (newStock < 0) {
              const shortage = item.quantity - bottle.stock;
              return NextResponse.json(
                {
                  error: `ขวดไม่เพียงพอ: ขวด ${bottle.size} (ต้องการ ${item.quantity} ขวด, มีอยู่ ${bottle.stock} ขวด, ขาด ${shortage} ขวด)`
                },
                { status: 400 }
              );
            }

            // Calculate bottle cost
            const bottlePrice = bottle.price || 0;
            calculatedBottleCost += bottlePrice * item.quantity;
            calculatedTotalVolumeMl += (bottle.capacity_ml || 0) * item.quantity;

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

        // Deduct raw materials and use FIFO
        for (const matUsage of execData.actual_materials) {
          const { data: material } = await supabaseAdmin
            .from('raw_materials')
            .select('id, name, current_stock, unit')
            .eq('id', matUsage.material_id)
            .single();

          if (material) {
            const newStock = material.current_stock - matUsage.quantity_used;
            if (newStock < 0) {
              return NextResponse.json(
                { error: `Insufficient stock for ${material.name}` },
                { status: 400 }
              );
            }

            await supabaseAdmin
              .from('raw_materials')
              .update({ current_stock: newStock, updated_at: new Date().toISOString() })
              .eq('id', matUsage.material_id);

            // Create stock transaction
            const { data: transaction } = await supabaseAdmin
              .from('stock_transactions')
              .insert({
                raw_material_id: matUsage.material_id,
                transaction_type: 'production',
                quantity: matUsage.quantity_used,
                notes: `Production batch: ${batch.batch_id}`,
                created_at: new Date().toISOString()
              })
              .select()
              .single();

            // Call FIFO deduction
            if (transaction) {
              try {
                await supabaseAdmin.rpc('deduct_stock_fifo', {
                  p_raw_material_id: matUsage.material_id,
                  p_quantity_to_deduct: matUsage.quantity_used,
                  p_stock_transaction_id: transaction.id,
                  p_production_batch_id: id
                });
              } catch (fifoErr) {
                console.error('FIFO deduction error:', fifoErr);
                // Continue even if FIFO function doesn't exist
              }
            }
          }
        }

        // Calculate FIFO costing
        let costData: any = null;
        try {
          const { data: costResult, error: costError } = await supabaseAdmin
            .rpc('calculate_production_cost_fifo', {
              p_production_batch_id: id,
              p_actual_materials: execData.actual_materials,
              p_actual_items: execData.actual_items
            });

          if (!costError && costResult && costResult.length > 0) {
            costData = costResult[0];
          }
        } catch (costErr) {
          console.error('Cost calculation error:', costErr);
          // Continue without costing if function doesn't exist
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

        // Use costData from stored procedure, but always use calculated bottle cost
        const finalBottleCost = calculatedBottleCost;
        const finalTotalVolumeMl = calculatedTotalVolumeMl;
        const finalMaterialCost = costData?.total_material_cost || 0;
        const finalTotalCost = finalMaterialCost + finalBottleCost;
        const finalUnitCostPerMl = finalTotalVolumeMl > 0 ? finalTotalCost / finalTotalVolumeMl : 0;

        updateData.total_material_cost = finalMaterialCost;
        updateData.total_bottle_cost = finalBottleCost;
        updateData.total_volume_ml = finalTotalVolumeMl;
        updateData.unit_cost_per_ml = finalUnitCostPerMl;
        updateData.unit_cost = finalUnitCostPerMl; // backward compatibility
        if (costData?.cost_breakdown) {
          updateData.cost_breakdown = costData.cost_breakdown;
        }

        // Update batch first
        const { error: updateError } = await supabaseAdmin
          .from('production_batches')
          .update(updateData)
          .eq('id', id);

        if (updateError) {
          throw updateError;
        }

        // Create finished goods inventory
        for (const item of execData.actual_items) {
          const goodQuantity = item.quantity - (item.defects || 0);
          if (goodQuantity > 0) {
            // Get bottle capacity and price to calculate unit cost per bottle
            const { data: bottle } = await supabaseAdmin
              .from('bottle_types')
              .select('capacity_ml, price')
              .eq('id', item.bottle_type_id)
              .single();

            if (bottle) {
              // Unit cost per bottle = material cost per ml * capacity + bottle price
              const materialCostPerBottle = finalUnitCostPerMl > 0
                ? (finalMaterialCost / finalTotalVolumeMl) * bottle.capacity_ml
                : 0;
              const bottlePricePerUnit = bottle.price || 0;
              const unitCostPerBottle = materialCostPerBottle + bottlePricePerUnit;

              await supabaseAdmin
                .from('finished_goods')
                .insert({
                  product_id: batch.product_id,
                  bottle_type_id: item.bottle_type_id,
                  production_batch_id: id,
                  quantity: goodQuantity,
                  unit_cost: unitCostPerBottle,
                  total_cost: goodQuantity * unitCostPerBottle,
                  manufactured_date: new Date().toISOString(),
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                });
            }
          }
        }

        // Fetch the updated batch to return to the UI
        const { data: updatedBatch, error: fetchUpdatedError } = await supabaseAdmin
          .from('production_batches')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchUpdatedError) {
          throw fetchUpdatedError;
        }

        return NextResponse.json({
          success: true,
          batch: updatedBatch,
          message: 'Production completed successfully',
          costing: costData
        });

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

    // Update batch (for non-complete actions)
    if (action !== 'complete') {
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
    }

    return NextResponse.json({
      success: true,
      message: 'Action completed'
    });
  } catch (error) {
    console.error('Error updating batch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - ลบ production batch (Admin only, Hard delete)
export async function DELETE(
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

    // Check if user is admin
    const { data: { user } } = await supabaseAdmin.auth.getUser(
      request.headers.get('authorization')?.substring(7) || ''
    );

    if (user?.email !== 'kwamkid@gmail.com') {
      return NextResponse.json(
        { error: 'Forbidden. Admin access required.' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Fetch the batch to check if it exists
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

    // Delete related records first (to avoid foreign key constraints)

    // 1. Delete stock_lot_usages
    await supabaseAdmin
      .from('stock_lot_usages')
      .delete()
      .eq('production_batch_id', id);

    // 2. Delete finished_goods
    await supabaseAdmin
      .from('finished_goods')
      .delete()
      .eq('production_batch_id', id);

    // 3. Delete the production batch
    const { error: deleteError } = await supabaseAdmin
      .from('production_batches')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Production batch deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting batch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
