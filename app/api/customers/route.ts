// Path: app/api/customers/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Type definitions
interface CustomerData {
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  district?: string;
  amphoe?: string;
  province?: string;
  postal_code?: string;
  tax_id?: string;
  customer_type: 'retail' | 'wholesale' | 'distributor';
  credit_limit?: number;
  credit_days?: number;
  assigned_salesperson?: string;
  is_active?: boolean;
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

// POST - สร้างลูกค้าใหม่
export async function POST(request: NextRequest) {
  try {
    const { isAuth, userId } = await checkAuth(request);

    if (!isAuth) {
      return NextResponse.json(
        { error: 'Unauthorized. Login required.' },
        { status: 401 }
      );
    }

    const customerData: CustomerData = await request.json();

    // Validate required fields
    if (!customerData.name || !customerData.customer_type) {
      return NextResponse.json(
        { error: 'Missing required fields: name and customer_type' },
        { status: 400 }
      );
    }

    // Generate customer code
    const { data: codeData, error: codeError } = await supabaseAdmin
      .rpc('generate_customer_code');

    if (codeError) {
      console.error('Customer code generation error:', codeError);
      return NextResponse.json(
        { error: 'Failed to generate customer code' },
        { status: 500 }
      );
    }

    // Create customer
    const { data, error } = await supabaseAdmin
      .from('customers')
      .insert({
        customer_code: codeData,
        name: customerData.name,
        contact_person: customerData.contact_person || null,
        phone: customerData.phone || null,
        email: customerData.email || null,
        address: customerData.address || null,
        district: customerData.district || null,
        amphoe: customerData.amphoe || null,
        province: customerData.province || null,
        postal_code: customerData.postal_code || null,
        tax_id: customerData.tax_id || null,
        customer_type_new: customerData.customer_type,
        credit_limit: customerData.credit_limit || 0,
        credit_days: customerData.credit_days || 0,
        assigned_salesperson: customerData.assigned_salesperson || null,
        is_active: customerData.is_active !== undefined ? customerData.is_active : true,
        notes: customerData.notes || null,
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Customer creation error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    // Auto-create default shipping address if address info is provided
    if (data && customerData.address && customerData.province) {
      try {
        await supabaseAdmin
          .from('shipping_addresses')
          .insert({
            customer_id: data.id,
            address_name: 'สำนักงานใหญ่', // Default name
            contact_person: customerData.contact_person || null,
            phone: customerData.phone || null,
            address_line1: customerData.address,
            district: customerData.district || null,
            amphoe: customerData.amphoe || null,
            province: customerData.province,
            postal_code: customerData.postal_code || null,
            is_default: true,
            is_active: true,
            created_by: userId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
      } catch (shippingError) {
        console.error('Shipping address creation error:', shippingError);
        // Don't fail the customer creation if shipping address fails
      }
    }

    return NextResponse.json({
      success: true,
      customer: data
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - ดึงรายการลูกค้า
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
    const search = searchParams.get('search');
    const customerType = searchParams.get('type');
    const isActive = searchParams.get('active');

    let query = supabaseAdmin
      .from('customers')
      .select('*');

    // Apply filters
    if (search) {
      query = query.or(`name.ilike.%${search}%,customer_code.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    if (customerType && customerType !== 'all') {
      query = query.eq('customer_type', customerType);
    }

    if (isActive !== null && isActive !== undefined && isActive !== 'all') {
      query = query.eq('is_active', isActive === 'true');
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ customers: data });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - อัพเดทลูกค้า
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
    const { id, customer_type, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    // Map customer_type to customer_type_new for database
    const dataToUpdate = {
      ...updateData,
      updated_at: new Date().toISOString()
    };

    // Add customer_type_new if customer_type is provided
    if (customer_type) {
      dataToUpdate.customer_type_new = customer_type;
    }

    const { data, error } = await supabaseAdmin
      .from('customers')
      .update(dataToUpdate)
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
      customer: data
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - ลบลูกค้า (soft delete)
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
    const customerId = searchParams.get('id');

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    // Soft delete - ปิดการใช้งาน
    const { error } = await supabaseAdmin
      .from('customers')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', customerId);

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
