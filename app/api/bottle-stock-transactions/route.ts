// Path: app/api/bottle-stock-transactions/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Type definitions
interface BottleStockTransactionData {
  bottle_id: string;
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

// POST - สร้างรายการเข้า/ออกสต็อกขวด
export async function POST(request: NextRequest) {
  try {
    const isAuth = await checkAuth(request);

    if (!isAuth) {
      return NextResponse.json(
        { error: 'Unauthorized. Login required.' },
        { status: 401 }
      );
    }

    const transactionData: BottleStockTransactionData = await request.json();

    // Validate required fields
    if (!transactionData.bottle_id || !transactionData.transaction_type || !transactionData.quantity) {
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
    const { data: bottle, error: fetchError } = await supabaseAdmin
      .from('bottle_types')
      .select('stock, size')
      .eq('id', transactionData.bottle_id)
      .single();

    if (fetchError || !bottle) {
      return NextResponse.json(
        { error: 'Bottle type not found' },
        { status: 404 }
      );
    }

    // Calculate new stock
    let newStock = bottle.stock;
    if (transactionData.transaction_type === 'in') {
      newStock += transactionData.quantity;
    } else {
      // production หรือ damage ต้องลดสต็อก
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
      .from('bottle_types')
      .update({
        stock: newStock,
        updated_at: new Date().toISOString()
      })
      .eq('id', transactionData.bottle_id);

    if (updateError) {
      console.error('Stock update error:', updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      );
    }

    // Create transaction record
    const { data, error } = await supabaseAdmin
      .from('bottle_stock_transactions')
      .insert({
        bottle_id: transactionData.bottle_id,
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

// GET - ดึงรายการเข้า/ออกสต็อกขวด
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
    const bottleId = searchParams.get('bottle_id');

    let query = supabaseAdmin
      .from('bottle_stock_transactions')
      .select(`
        *,
        bottle_types (
          size
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (bottleId) {
      query = query.eq('bottle_id', bottleId);
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
