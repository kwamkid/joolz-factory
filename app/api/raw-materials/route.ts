// Path: app/api/raw-materials/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Type definitions
interface RawMaterialData {
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  average_price: number;
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

// POST - สร้างวัตถุดิบใหม่
export async function POST(request: NextRequest) {
  try {
    const isAuth = await checkAuth(request);

    if (!isAuth) {
      return NextResponse.json(
        { error: 'Unauthorized. Login required.' },
        { status: 401 }
      );
    }

    const materialData: RawMaterialData = await request.json();

    // Validate required fields
    if (!materialData.name || !materialData.unit) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if material name already exists
    const { data: existingMaterial } = await supabaseAdmin
      .from('raw_materials')
      .select('id')
      .eq('name', materialData.name)
      .single();

    if (existingMaterial) {
      return NextResponse.json(
        { error: 'Raw material name already exists' },
        { status: 400 }
      );
    }

    // Create raw material
    const { data, error } = await supabaseAdmin
      .from('raw_materials')
      .insert({
        name: materialData.name,
        unit: materialData.unit,
        current_stock: materialData.current_stock !== undefined ? materialData.current_stock : 0,
        min_stock: materialData.min_stock !== undefined ? materialData.min_stock : 0,
        average_price: materialData.average_price !== undefined ? materialData.average_price : 0,
        image: materialData.image || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Raw material creation error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      material: data
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - ดึงรายการวัตถุดิบ
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
      .from('raw_materials')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ materials: data });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - อัพเดทวัตถุดิบ
export async function PUT(request: NextRequest) {
  try {
    const isAuth = await checkAuth(request);

    if (!isAuth) {
      return NextResponse.json(
        { error: 'Unauthorized. Login required.' },
        { status: 401 }
      );
    }

    const { id, name, unit, current_stock, min_stock, average_price, image } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Raw material ID is required' },
        { status: 400 }
      );
    }

    // Check if name is being changed and if it already exists
    if (name) {
      const { data: existingMaterial } = await supabaseAdmin
        .from('raw_materials')
        .select('id')
        .eq('name', name)
        .neq('id', id)
        .single();

      if (existingMaterial) {
        return NextResponse.json(
          { error: 'Raw material name already exists' },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabaseAdmin
      .from('raw_materials')
      .update({
        name,
        unit,
        current_stock,
        min_stock,
        average_price,
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
      material: data
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - ลบวัตถุดิบ
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
    const materialId = searchParams.get('id');

    if (!materialId) {
      return NextResponse.json(
        { error: 'Raw material ID is required' },
        { status: 400 }
      );
    }

    // Hard delete
    const { error } = await supabaseAdmin
      .from('raw_materials')
      .delete()
      .eq('id', materialId);

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
