// Path: app/api/settings/delete-all-data/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

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

// Helper function: Check authentication and admin role
async function checkAdminAuth(request: NextRequest): Promise<{ isAdmin: boolean; userId?: string; error?: string }> {
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return { isAdmin: false, error: 'Unauthorized. Login required.' };
    }

    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return { isAdmin: false, error: 'Unauthorized. Invalid token.' };
    }

    // Check if user is admin
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return { isAdmin: false, error: 'Forbidden. Admin access required.' };
    }

    return { isAdmin: true, userId: user.id };
  } catch (error) {
    console.error('Auth check error:', error);
    return { isAdmin: false, error: 'Authentication error' };
  }
}

// DELETE - Delete all data except users
export async function DELETE(request: NextRequest) {
  try {
    const authCheck = await checkAdminAuth(request);

    if (!authCheck.isAdmin) {
      return NextResponse.json(
        { error: authCheck.error || 'Unauthorized' },
        { status: authCheck.error?.includes('Forbidden') ? 403 : 401 }
      );
    }

    console.log('Starting to delete all data...');

    // Delete in order to respect foreign key constraints
    // Start with child tables first, then parent tables

    // 1. Delete order shipments (child of order_items)
    console.log('Deleting order_shipments...');
    await supabaseAdmin.from('order_shipments').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 2. Delete order items (child of orders)
    console.log('Deleting order_items...');
    await supabaseAdmin.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 3. Delete orders
    console.log('Deleting orders...');
    await supabaseAdmin.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 4. Delete production usage (child of production)
    console.log('Deleting production_raw_material_usage...');
    await supabaseAdmin.from('production_raw_material_usage').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 5. Delete production bottle usage
    console.log('Deleting production_bottle_usage...');
    await supabaseAdmin.from('production_bottle_usage').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 6. Delete production batches
    console.log('Deleting production_batches...');
    await supabaseAdmin.from('production_batches').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 7. Delete sellable product variations
    console.log('Deleting sellable_product_variations...');
    await supabaseAdmin.from('sellable_product_variations').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 8. Delete sellable products
    console.log('Deleting sellable_products...');
    await supabaseAdmin.from('sellable_products').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 9. Delete product recipes
    console.log('Deleting product_recipes...');
    await supabaseAdmin.from('product_recipes').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 10. Delete products
    console.log('Deleting products...');
    await supabaseAdmin.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 11. Delete bottle stock transactions
    console.log('Deleting bottle_stock_transactions...');
    await supabaseAdmin.from('bottle_stock_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 12. Delete bottle types
    console.log('Deleting bottle_types...');
    await supabaseAdmin.from('bottle_types').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 13. Delete stock transactions
    console.log('Deleting stock_transactions...');
    await supabaseAdmin.from('stock_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 14. Delete raw materials
    console.log('Deleting raw_materials...');
    await supabaseAdmin.from('raw_materials').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 15. Delete shipping addresses
    console.log('Deleting shipping_addresses...');
    await supabaseAdmin.from('shipping_addresses').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 16. Delete customers
    console.log('Deleting customers...');
    await supabaseAdmin.from('customers').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 17. Delete suppliers
    console.log('Deleting suppliers...');
    await supabaseAdmin.from('suppliers').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    console.log('All data deleted successfully!');

    return NextResponse.json({
      success: true,
      message: 'ลบข้อมูลทั้งหมดสำเร็จ (ยกเว้นข้อมูลผู้ใช้)'
    });
  } catch (error) {
    console.error('Error deleting all data:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}
