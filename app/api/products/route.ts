// Path: app/api/products/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Type definitions
interface ProductData {
  code: string;
  name: string;
  description?: string;
  category: string;
  image?: string;
  is_active?: boolean;
  product_type?: 'manufactured' | 'purchased';
  ingredients?: Array<{
    raw_material_id: string;
    quantity_per_unit: number;
  }>;
}

// สร้าง Supabase Admin client (service role)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Debug: ตรวจสอบว่า service role key ถูกโหลดหรือไม่
console.log('Supabase URL:', supabaseUrl ? 'OK' : 'MISSING');
console.log('Service Role Key:', serviceRoleKey ? `OK (length: ${serviceRoleKey.length})` : 'MISSING');

const supabaseAdmin = createClient(
  supabaseUrl,
  serviceRoleKey,
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

// POST - สร้างสินค้าใหม่
export async function POST(request: NextRequest) {
  try {
    const isAuth = await checkAuth(request);

    if (!isAuth) {
      return NextResponse.json(
        { error: 'Unauthorized. Login required.' },
        { status: 401 }
      );
    }

    const productData: ProductData = await request.json();

    // Validate required fields
    if (!productData.code || !productData.name || !productData.category) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if product code already exists
    const { data: existingProduct } = await supabaseAdmin
      .from('products')
      .select('id')
      .eq('code', productData.code)
      .single();

    if (existingProduct) {
      return NextResponse.json(
        { error: 'Product code already exists' },
        { status: 400 }
      );
    }

    // Create product
    const { data, error } = await supabaseAdmin
      .from('products')
      .insert({
        code: productData.code,
        name: productData.name,
        description: productData.description || null,
        category: productData.category,
        image: productData.image || null,
        is_active: productData.is_active !== undefined ? productData.is_active : true,
        product_type: productData.product_type || 'manufactured',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Product creation error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    // Save recipes if provided
    if (productData.ingredients && productData.ingredients.length > 0) {
      const recipesToInsert = productData.ingredients
        .filter(ing => ing.quantity_per_unit > 0)
        .map(ing => ({
          product_id: data.id,
          raw_material_id: ing.raw_material_id,
          quantity_per_unit: ing.quantity_per_unit
        }));

      if (recipesToInsert.length > 0) {
        const { error: recipeError } = await supabaseAdmin
          .from('product_recipes')
          .insert(recipesToInsert);

        if (recipeError) {
          console.error('Recipe creation error:', recipeError);
          // Don't fail the whole request, just log the error
        }
      }
    }

    return NextResponse.json({
      success: true,
      product: data
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - ดึงรายการสินค้า
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
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ products: data });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - อัพเดทสินค้า
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
    const { id, code, name, description, category, image, is_active, product_type, ingredients } = body;

    console.log('PUT request body:', JSON.stringify(body, null, 2));
    console.log('Ingredients received:', ingredients);

    if (!id) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    // Check if code is being changed and if it already exists
    if (code) {
      const { data: existingProduct } = await supabaseAdmin
        .from('products')
        .select('id')
        .eq('code', code)
        .neq('id', id)
        .single();

      if (existingProduct) {
        return NextResponse.json(
          { error: 'Product code already exists' },
          { status: 400 }
        );
      }
    }

    const { data, error} = await supabaseAdmin
      .from('products')
      .update({
        code,
        name,
        description,
        category,
        image,
        is_active,
        product_type,
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

    // Update recipes if provided
    if (ingredients !== undefined) {
      console.log('Processing ingredients update for product:', id);

      // Delete old recipes
      const { error: deleteError } = await supabaseAdmin
        .from('product_recipes')
        .delete()
        .eq('product_id', id);

      if (deleteError) {
        console.error('Delete recipes error:', deleteError);
      } else {
        console.log('Old recipes deleted successfully');
      }

      // Insert new recipes
      if (ingredients && ingredients.length > 0) {
        const recipesToInsert = ingredients
          .filter((ing: { quantity_per_unit: number }) => ing.quantity_per_unit > 0)
          .map((ing: { raw_material_id: string; quantity_per_unit: number }) => ({
            product_id: id,
            raw_material_id: ing.raw_material_id,
            quantity_per_unit: ing.quantity_per_unit
          }));

        console.log('Recipes to insert:', recipesToInsert);

        if (recipesToInsert.length > 0) {
          const { data: insertedData, error: recipeError } = await supabaseAdmin
            .from('product_recipes')
            .insert(recipesToInsert)
            .select();

          if (recipeError) {
            console.error('Recipe insert error:', recipeError);
          } else {
            console.log('Recipes inserted successfully:', insertedData);
          }
        } else {
          console.log('No valid recipes to insert (all quantities are 0)');
        }
      } else {
        console.log('No ingredients provided');
      }
    } else {
      console.log('Ingredients not provided in request');
    }

    return NextResponse.json({
      success: true,
      product: data
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - ลบสินค้า
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
    const productId = searchParams.get('id');

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    // Hard delete - ลบถาวร
    // ลบ recipes ก่อน (foreign key constraint)
    await supabaseAdmin
      .from('product_recipes')
      .delete()
      .eq('product_id', productId);

    // ลบสินค้า
    const { error } = await supabaseAdmin
      .from('products')
      .delete()
      .eq('id', productId);

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
