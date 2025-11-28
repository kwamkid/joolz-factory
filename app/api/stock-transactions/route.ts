// Path: app/api/stock-transactions/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Type definitions
interface StockTransactionData {
  raw_material_id: string;
  transaction_type: 'in' | 'production' | 'damage';
  quantity: number;
  unit_price?: number; // ราคาต่อหน่วย (สำหรับการซื้อเข้า)
  total_price?: number; // ราคารวม (สำหรับการซื้อเข้า)
  notes?: string;
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

// Helper function: ตรวจสอบว่าล็อกอินหรือไม่
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

// POST - สร้างรายการเข้า/ออกสต็อก
export async function POST(request: NextRequest) {
  try {
    const isAuth = await checkAuth(request);

    if (!isAuth) {
      return NextResponse.json(
        { error: 'Unauthorized. Login required.' },
        { status: 401 }
      );
    }

    const transactionData: StockTransactionData = await request.json();

    // Validate required fields
    if (!transactionData.raw_material_id || !transactionData.transaction_type || !transactionData.quantity) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (transactionData.quantity <= 0) {
      return NextResponse.json(
        { error: 'Quantity must be greater than 0' },
        { status: 400 }
      );
    }

    // Validate price fields for 'in' transaction
    if (transactionData.transaction_type === 'in') {
      if (!transactionData.unit_price || transactionData.unit_price <= 0) {
        return NextResponse.json(
          { error: 'กรุณาระบุราคาต่อหน่วยสำหรับการซื้อเข้า' },
          { status: 400 }
        );
      }
      // Calculate total_price if not provided
      if (!transactionData.total_price) {
        transactionData.total_price = transactionData.unit_price * transactionData.quantity;
      }
    }

    // Get current stock
    const { data: material, error: fetchError } = await supabaseAdmin
      .from('raw_materials')
      .select('current_stock, name, unit')
      .eq('id', transactionData.raw_material_id)
      .single();

    if (fetchError || !material) {
      return NextResponse.json(
        { error: 'Raw material not found' },
        { status: 404 }
      );
    }

    // Calculate new stock
    let newStock = material.current_stock;
    if (transactionData.transaction_type === 'in') {
      newStock += transactionData.quantity;
    } else {
      // Both 'production' and 'damage' decrease stock
      newStock -= transactionData.quantity;
      if (newStock < 0) {
        return NextResponse.json(
          { error: 'Insufficient stock' },
          { status: 400 }
        );
      }
    }

    // Create transaction record first
    const { data: transaction, error: transactionError } = await supabaseAdmin
      .from('stock_transactions')
      .insert({
        raw_material_id: transactionData.raw_material_id,
        transaction_type: transactionData.transaction_type,
        quantity: transactionData.quantity,
        unit_price: transactionData.unit_price || 0,
        total_price: transactionData.total_price || 0,
        notes: transactionData.notes || null,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (transactionError) {
      console.error('Transaction creation error:', transactionError);
      return NextResponse.json(
        { error: transactionError.message },
        { status: 400 }
      );
    }

    // Handle stock lot for 'in' transaction (FIFO)
    if (transactionData.transaction_type === 'in') {
      // Create a new stock lot
      const { error: lotError } = await supabaseAdmin
        .from('stock_lots')
        .insert({
          raw_material_id: transactionData.raw_material_id,
          stock_transaction_id: transaction.id,
          quantity_remaining: transactionData.quantity,
          unit_price: transactionData.unit_price,
          purchase_date: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (lotError) {
        console.error('Stock lot creation error:', lotError);
        // Don't fail the transaction, just log the error
      }
    } else {
      // For 'production' or 'damage', use FIFO to deduct from lots
      try {
        const { error: fifoError } = await supabaseAdmin.rpc('deduct_stock_fifo', {
          p_raw_material_id: transactionData.raw_material_id,
          p_quantity_to_deduct: transactionData.quantity,
          p_stock_transaction_id: transaction.id,
          p_production_batch_id: null
        });

        if (fifoError) {
          console.error('FIFO deduction error:', fifoError);
          // Don't fail if FIFO function doesn't exist yet
          // (backward compatibility during migration)
        }
      } catch (err) {
        console.error('FIFO function call error:', err);
        // Continue even if function doesn't exist
      }
    }

    // Update stock
    const { error: updateError } = await supabaseAdmin
      .from('raw_materials')
      .update({
        current_stock: newStock,
        updated_at: new Date().toISOString()
      })
      .eq('id', transactionData.raw_material_id);

    if (updateError) {
      console.error('Stock update error:', updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      transaction: transaction,
      new_stock: newStock
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - ดึงรายการเข้า/ออกสต็อก
export async function GET(request: NextRequest) {
  try {
    const isAuth = await checkAuth(request);

    if (!isAuth) {
      return NextResponse.json(
        { error: 'Unauthorized. Login required.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const rawMaterialId = searchParams.get('raw_material_id');

    let query = supabaseAdmin
      .from('stock_transactions')
      .select(`
        *,
        raw_materials (
          name,
          unit,
          image
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (rawMaterialId) {
      query = query.eq('raw_material_id', rawMaterialId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ transactions: data });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
