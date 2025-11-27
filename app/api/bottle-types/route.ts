// Path: app/api/bottle-types/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Type definitions
interface BottleTypeData {
  size: string;
  capacity_ml: number;
  price: number;
  stock?: number;
  min_stock?: number;
  image?: string;
}

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

// POST - Create new bottle type
export async function POST(request: NextRequest) {
  try {
    const isAuth = await checkAuth(request);

    if (!isAuth) {
      return NextResponse.json(
        { error: 'Unauthorized. Login required.' },
        { status: 401 }
      );
    }

    const bottleData: BottleTypeData = await request.json();

    // Validate required fields
    if (!bottleData.size || !bottleData.capacity_ml || bottleData.price === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: size, capacity_ml, price' },
        { status: 400 }
      );
    }

    // Check if size already exists
    const { data: existing } = await supabaseAdmin
      .from('bottle_types')
      .select('id')
      .eq('size', bottleData.size)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Bottle size already exists' },
        { status: 400 }
      );
    }

    // Create bottle type
    const { data, error } = await supabaseAdmin
      .from('bottle_types')
      .insert({
        size: bottleData.size,
        capacity_ml: bottleData.capacity_ml,
        price: bottleData.price,
        stock: bottleData.stock || 0,
        min_stock: bottleData.min_stock || 0,
        image: bottleData.image || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Bottle type creation error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      bottle_type: data
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Get all bottle types
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
      .order('capacity_ml', { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ bottle_types: data });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update bottle type
export async function PUT(request: NextRequest) {
  try {
    const isAuth = await checkAuth(request);

    if (!isAuth) {
      return NextResponse.json(
        { error: 'Unauthorized. Login required.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Bottle type ID is required' },
        { status: 400 }
      );
    }

    // Check if size is being changed and if it already exists
    if (updateData.size) {
      const { data: existing } = await supabaseAdmin
        .from('bottle_types')
        .select('id')
        .eq('size', updateData.size)
        .neq('id', id)
        .single();

      if (existing) {
        return NextResponse.json(
          { error: 'Bottle size already exists' },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabaseAdmin
      .from('bottle_types')
      .update({
        ...updateData,
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
      bottle_type: data
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete bottle type
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
        { error: 'Bottle type ID is required' },
        { status: 400 }
      );
    }

    // Check if bottle type is being used in sellable products
    const { data: usedInProducts } = await supabaseAdmin
      .from('sellable_products')
      .select('id')
      .eq('bottle_type_id', bottleId)
      .limit(1);

    if (usedInProducts && usedInProducts.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete bottle type that is being used in sellable products' },
        { status: 400 }
      );
    }

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
