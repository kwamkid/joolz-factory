// Path: app/api/sellable-products/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Type definitions
interface SellableProductData {
  product_id: string;
  code: string;
  name: string;
  description?: string;
  image?: string;
  product_type: 'simple' | 'variation';
  is_active?: boolean;

  // Simple product fields
  bottle_type_id?: string;
  default_price?: number;
  discount_price?: number;
  stock?: number;
  min_stock?: number;

  // Variation product fields
  variations?: VariationData[];
}

interface VariationData {
  id?: string;
  bottle_type_id: string;
  default_price: number;
  discount_price?: number;
  stock?: number;
  min_stock?: number;
  is_active?: boolean;
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

// POST - Create new sellable product
export async function POST(request: NextRequest) {
  try {
    const { isAuth, userId } = await checkAuth(request);

    if (!isAuth) {
      return NextResponse.json(
        { error: 'Unauthorized. Login required.' },
        { status: 401 }
      );
    }

    const productData: SellableProductData = await request.json();

    // Validate required fields
    if (!productData.product_id || !productData.code || !productData.name || !productData.product_type) {
      return NextResponse.json(
        { error: 'Missing required fields: product_id, code, name, product_type' },
        { status: 400 }
      );
    }

    // Validate based on product type
    if (productData.product_type === 'simple') {
      if (!productData.bottle_type_id || productData.default_price === undefined) {
        return NextResponse.json(
          { error: 'Simple product requires: bottle_type_id, default_price' },
          { status: 400 }
        );
      }
    } else if (productData.product_type === 'variation') {
      if (!productData.variations || productData.variations.length === 0) {
        return NextResponse.json(
          { error: 'Variation product requires at least one variation' },
          { status: 400 }
        );
      }
    }

    // Check if code already exists
    const { data: existingCode } = await supabaseAdmin
      .from('sellable_products')
      .select('id')
      .eq('code', productData.code)
      .single();

    if (existingCode) {
      return NextResponse.json(
        { error: 'Product code already exists' },
        { status: 400 }
      );
    }

    // Create sellable product (minimal fields only - price/stock go in variations table)
    const { data: newProduct, error: productError } = await supabaseAdmin
      .from('sellable_products')
      .insert({
        product_id: productData.product_id,
        code: productData.code,
        name: productData.name,
        description: productData.description || null,
        image: productData.image || null,
        // For simple products, store bottle_type_id here (used by view to determine product_type)
        bottle_type_id: productData.product_type === 'simple' ? productData.bottle_type_id : null,
        is_active: productData.is_active !== undefined ? productData.is_active : true,
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (productError) {
      console.error('Sellable product creation error:', productError);
      return NextResponse.json(
        { error: productError.message },
        { status: 400 }
      );
    }

    // Create variations for BOTH simple and variation products
    // For simple products: create a single variation row
    // For variation products: create multiple variation rows
    if (productData.product_type === 'simple') {
      // Simple product: create one variation row
      const { error: variationError } = await supabaseAdmin
        .from('sellable_product_variations')
        .insert({
          sellable_product_id: newProduct.id,
          bottle_type_id: productData.bottle_type_id,
          default_price: productData.default_price,
          discount_price: productData.discount_price || 0,
          stock: productData.stock || 0,
          min_stock: productData.min_stock || 0,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (variationError) {
        // Rollback: delete the product
        await supabaseAdmin
          .from('sellable_products')
          .delete()
          .eq('id', newProduct.id);

        return NextResponse.json(
          { error: 'Failed to create simple product variation: ' + variationError.message },
          { status: 400 }
        );
      }
    } else if (productData.product_type === 'variation' && productData.variations && productData.variations.length > 0) {
      // Variation product: create multiple variation rows
      const variationsToInsert = productData.variations.map(v => ({
        sellable_product_id: newProduct.id,
        bottle_type_id: v.bottle_type_id,
        default_price: v.default_price,
        discount_price: v.discount_price || 0,
        stock: v.stock || 0,
        min_stock: v.min_stock || 0,
        is_active: v.is_active !== undefined ? v.is_active : true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error: variationsError } = await supabaseAdmin
        .from('sellable_product_variations')
        .insert(variationsToInsert);

      if (variationsError) {
        // Rollback: delete the product
        await supabaseAdmin
          .from('sellable_products')
          .delete()
          .eq('id', newProduct.id);

        return NextResponse.json(
          { error: 'Failed to create variations: ' + variationsError.message },
          { status: 400 }
        );
      }
    }

    // Fetch complete product using view
    const { data: completeProduct } = await supabaseAdmin
      .from('sellable_products_with_variations')
      .select('*')
      .eq('sellable_product_id', newProduct.id)
      .single();

    return NextResponse.json({
      success: true,
      sellable_product: completeProduct || newProduct
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Get sellable products (with joins)
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
    const productId = searchParams.get('id');

    // If ID provided, get single product
    if (productId) {
      const { data, error } = await supabaseAdmin
        .from('sellable_products_view')
        .select('*')
        .eq('id', productId)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: 'Sellable product not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ sellable_product: data });
    }

    // Get all sellable products using the with_variations view
    // Only show active products (is_active = true)
    const { data, error } = await supabaseAdmin
      .from('sellable_products_with_variations')
      .select('*')
      .eq('is_active', true)
      .order('product_name', { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Group by sellable_product_id and aggregate variations
    const groupedProducts = (data || []).reduce((acc: any[], row: any) => {
      const existingProduct = acc.find(p => p.sellable_product_id === row.sellable_product_id);

      if (existingProduct) {
        // Add variation to existing product
        if (row.variation_id) {
          if (!existingProduct.variations) {
            existingProduct.variations = [];
          }
          existingProduct.variations.push({
            variation_id: row.variation_id,
            bottle_type_id: row.bottle_type_id,
            bottle_size: row.bottle_size,
            bottle_capacity_ml: row.bottle_capacity_ml,
            default_price: row.default_price,
            discount_price: row.discount_price,
            stock: row.stock,
            min_stock: row.min_stock,
            is_active: row.variation_is_active
          });
        }
      } else {
        // Create new product entry
        const newProduct: any = {
          sellable_product_id: row.sellable_product_id,
          code: row.code,
          name: row.name,
          description: row.description,
          image: row.image,
          product_type: row.product_type,
          is_active: row.is_active,
          product_id: row.product_id,
          product_code: row.product_code,
          product_name: row.product_name,
          product_category: row.product_category,
          created_at: row.created_at,
          updated_at: row.updated_at
        };

        // Add simple product fields or initialize variations array
        if (row.product_type === 'simple') {
          newProduct.simple_bottle_type_id = row.simple_bottle_type_id;
          newProduct.simple_bottle_size = row.simple_bottle_size;
          newProduct.simple_bottle_capacity_ml = row.simple_bottle_capacity_ml;
          newProduct.simple_default_price = row.simple_default_price;
          newProduct.simple_discount_price = row.simple_discount_price;
          newProduct.simple_stock = row.simple_stock;
          newProduct.simple_min_stock = row.simple_min_stock;
          // Simple products also have one variation row - include it for consistency
          newProduct.variations = row.variation_id ? [{
            variation_id: row.variation_id,
            bottle_type_id: row.simple_bottle_type_id,
            bottle_size: row.simple_bottle_size,
            bottle_capacity_ml: row.simple_bottle_capacity_ml,
            default_price: row.simple_default_price,
            discount_price: row.simple_discount_price,
            stock: row.simple_stock,
            min_stock: row.simple_min_stock,
            is_active: row.variation_is_active
          }] : [];
        } else {
          newProduct.variations = row.variation_id ? [{
            variation_id: row.variation_id,
            bottle_type_id: row.bottle_type_id,
            bottle_size: row.bottle_size,
            bottle_capacity_ml: row.bottle_capacity_ml,
            default_price: row.default_price,
            discount_price: row.discount_price,
            stock: row.stock,
            min_stock: row.min_stock,
            is_active: row.variation_is_active
          }] : [];
        }

        acc.push(newProduct);
      }

      return acc;
    }, []);

    return NextResponse.json({ sellable_products: groupedProducts });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update sellable product
export async function PUT(request: NextRequest) {
  try {
    const { isAuth } = await checkAuth(request);

    if (!isAuth) {
      return NextResponse.json(
        { error: 'Unauthorized. Login required.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      id,
      variations,
      // Extract fields that belong to sellable_products table only
      product_id,
      code,
      name,
      description,
      image,
      bottle_type_id,
      is_active,
      // Ignore fields that belong to variations table (default_price, stock, etc.)
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Sellable product ID is required' },
        { status: 400 }
      );
    }

    // Check if code is being changed and if it already exists
    if (code) {
      const { data: existingCode } = await supabaseAdmin
        .from('sellable_products')
        .select('id')
        .eq('code', code)
        .neq('id', id)
        .single();

      if (existingCode) {
        return NextResponse.json(
          { error: 'Product code already exists' },
          { status: 400 }
        );
      }
    }

    // Build update object with only valid fields
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (product_id !== undefined && product_id !== '') updateData.product_id = product_id;
    if (code !== undefined && code !== '') updateData.code = code;
    if (name !== undefined && name !== '') updateData.name = name;
    if (description !== undefined) updateData.description = description || null;
    if (image !== undefined) updateData.image = image || null;
    // For bottle_type_id: empty string should become null (for variation products)
    if (bottle_type_id !== undefined) {
      updateData.bottle_type_id = bottle_type_id === '' ? null : bottle_type_id;
    }
    if (is_active !== undefined) updateData.is_active = is_active;

    // Update main product
    const { data, error } = await supabaseAdmin
      .from('sellable_products')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Determine product type from data.bottle_type_id
    // Simple product: has bottle_type_id in sellable_products table
    // Variation product: bottle_type_id is null in sellable_products table
    const isSimpleProduct = data.bottle_type_id !== null;

    if (isSimpleProduct) {
      // For simple products: update the single variation row
      // Get the variation price/stock data from body
      const { default_price, discount_price, stock, min_stock } = body;

      if (default_price !== undefined || discount_price !== undefined || stock !== undefined || min_stock !== undefined) {
        // Find the existing variation for this simple product
        const { data: existingVariation } = await supabaseAdmin
          .from('sellable_product_variations')
          .select('id')
          .eq('sellable_product_id', id)
          .single();

        if (existingVariation) {
          // Update existing variation
          const variationUpdate: any = { updated_at: new Date().toISOString() };
          if (default_price !== undefined) variationUpdate.default_price = default_price;
          if (discount_price !== undefined) variationUpdate.discount_price = discount_price;
          if (stock !== undefined) variationUpdate.stock = stock;
          if (min_stock !== undefined) variationUpdate.min_stock = min_stock;
          if (bottle_type_id !== undefined) variationUpdate.bottle_type_id = bottle_type_id;

          await supabaseAdmin
            .from('sellable_product_variations')
            .update(variationUpdate)
            .eq('id', existingVariation.id);
        }
      }
    } else {
      // For variation products: update multiple variation rows
      if (variations && Array.isArray(variations)) {
        // Get existing variations
        const { data: existingVariations } = await supabaseAdmin
          .from('sellable_product_variations')
          .select('id, bottle_type_id')
          .eq('sellable_product_id', id);

        const existingIds = existingVariations?.map(v => v.id) || [];
        const providedIds = variations.filter(v => v.id).map(v => v.id);

        // Delete variations that are no longer in the list
        const toDelete = existingIds.filter(id => !providedIds.includes(id));
        if (toDelete.length > 0) {
          await supabaseAdmin
            .from('sellable_product_variations')
            .delete()
            .in('id', toDelete);
        }

        // Update or insert variations
        for (const variation of variations) {
          if (variation.id) {
            // Update existing
            await supabaseAdmin
              .from('sellable_product_variations')
              .update({
                bottle_type_id: variation.bottle_type_id,
                default_price: variation.default_price,
                discount_price: variation.discount_price || 0,
                stock: variation.stock || 0,
                min_stock: variation.min_stock || 0,
                is_active: variation.is_active !== undefined ? variation.is_active : true,
                updated_at: new Date().toISOString()
              })
              .eq('id', variation.id);
          } else {
            // Insert new
            await supabaseAdmin
              .from('sellable_product_variations')
              .insert({
                sellable_product_id: id,
                bottle_type_id: variation.bottle_type_id,
                default_price: variation.default_price,
                discount_price: variation.discount_price || 0,
                stock: variation.stock || 0,
                min_stock: variation.min_stock || 0,
                is_active: variation.is_active !== undefined ? variation.is_active : true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
          }
        }
      }
    }

    // Fetch complete product with variations
    const { data: completeProduct } = await supabaseAdmin
      .from('sellable_products_with_variations')
      .select('*')
      .eq('sellable_product_id', id)
      .single();

    return NextResponse.json({
      success: true,
      sellable_product: completeProduct || data
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Deactivate sellable product (soft delete)
export async function DELETE(request: NextRequest) {
  try {
    const { isAuth } = await checkAuth(request);

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
        { error: 'Sellable product ID is required' },
        { status: 400 }
      );
    }

    // Instead of deleting, deactivate the product (soft delete)
    const { error } = await supabaseAdmin
      .from('sellable_products')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', productId);

    if (error) {
      console.error('Error deactivating sellable product:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Also deactivate all variations
    await supabaseAdmin
      .from('sellable_product_variations')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('sellable_product_id', productId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
