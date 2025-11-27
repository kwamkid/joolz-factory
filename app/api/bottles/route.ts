// Path: app/api/bottles/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Type definitions
interface BottleData {
  size: string;
  capacity_ml: number;
  price: number;
  stock: number;
  min_stock: number;
  image?: string;
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

// POST - สร้างขวดใหม่
export async function POST(request: NextRequest) {
  try {
    const isAuth = await checkAuth(request);

    if (!isAuth) {
      return NextResponse.json(
        { error: 'Unauthorized. Login required.' },
        { status: 401 }
      );
    }

    const bottleData: BottleData = await request.json();

    // Validate required fields
    if (!bottleData.size || !bottleData.capacity_ml || bottleData.price === undefined || bottleData.stock === undefined || bottleData.min_stock === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if bottle size already exists
    const { data: existingBottle } = await supabaseAdmin
      .from('bottle_types')
      .select('id')
      .eq('size', bottleData.size)
      .single();

    if (existingBottle) {
      return NextResponse.json(
        { error: 'Bottle size already exists' },
        { status: 400 }
      );
    }

    // Create bottle
    const { data, error } = await supabaseAdmin
      .from('bottle_types')
      .insert({
        size: bottleData.size,
        capacity_ml: bottleData.capacity_ml,
        price: bottleData.price,
        stock: bottleData.stock,
        min_stock: bottleData.min_stock,
        image: bottleData.image || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Bottle creation error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      bottle: data
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - ดึงรายการขวด
export async function GET(request: NextRequest) {
  try {
    const isAuth = await checkAuth(request);

    if (!isAuth) {
      return NextResponse.json(
        { error: 'Unauthorized. Login required.' },
        { status: 401 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('bottle_types')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ bottles: data });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - อัพเดทขวด
export async function PUT(request: NextRequest) {
  try {
    const isAuth = await checkAuth(request);

    if (!isAuth) {
      return NextResponse.json(
        { error: 'Unauthorized. Login required.' },
        { status: 401 }
      );
    }

    const { id, size, capacity_ml, price, stock, min_stock, image } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Bottle ID is required' },
        { status: 400 }
      );
    }

    // Check if size is being changed and if it already exists
    if (size) {
      const { data: existingBottle } = await supabaseAdmin
        .from('bottle_types')
        .select('id')
        .eq('size', size)
        .neq('id', id)
        .single();

      if (existingBottle) {
        return NextResponse.json(
          { error: 'Bottle size already exists' },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabaseAdmin
      .from('bottle_types')
      .update({
        size,
        capacity_ml,
        price,
        stock,
        min_stock,
        image,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      bottle: data
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - ลบขวด
export async function DELETE(request: NextRequest) {
  try {
    const isAuth = await checkAuth(request);

    if (!isAuth) {
      return NextResponse.json(
        { error: 'Unauthorized. Login required.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const bottleId = searchParams.get('id');

    if (!bottleId) {
      return NextResponse.json(
        { error: 'Bottle ID is required' },
        { status: 400 }
      );
    }

    // Hard delete
    const { error } = await supabaseAdmin
      .from('bottle_types')
      .delete()
      .eq('id', bottleId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
