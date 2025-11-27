// Path: app/api/stock-transactions/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Type definitions
interface StockTransactionData {
  raw_material_id: string;
  transaction_type: 'in' | 'production' | 'damage';
  quantity: number;
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

    // Create transaction record
    const { data, error } = await supabaseAdmin
      .from('stock_transactions')
      .insert({
        raw_material_id: transactionData.raw_material_id,
        transaction_type: transactionData.transaction_type,
        quantity: transactionData.quantity,
        notes: transactionData.notes || null,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Transaction creation error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      transaction: data,
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
