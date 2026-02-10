// Path: app/api/orders/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Type definitions
interface OrderItemInput {
  variation_id: string; // sellable_product_variations.id
  sellable_product_id: string; // sellable_products.id
  product_code: string;
  product_name: string;
  bottle_size?: string;
  quantity: number;
  unit_price: number;
  discount_percent?: number;
  notes?: string;
  shipments: {
    shipping_address_id: string;
    quantity: number;
    delivery_notes?: string;
    shipping_fee?: number;
  }[];
}

interface OrderData {
  customer_id: string;
  delivery_date?: string;
  payment_method?: string;
  discount_amount?: number;
  notes?: string;
  internal_notes?: string;
  items: OrderItemInput[];
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

// POST - Create new order with items and shipments
export async function POST(request: NextRequest) {
  try {
    const { isAuth, userId } = await checkAuth(request);

    if (!isAuth) {
      return NextResponse.json(
        { error: 'Unauthorized. Login required.' },
        { status: 401 }
      );
    }

    const orderData: OrderData = await request.json();

    // Validate required fields
    if (!orderData.customer_id || !orderData.items || orderData.items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: customer_id and items' },
        { status: 400 }
      );
    }

    // Validate shipments for each item
    for (const item of orderData.items) {
      if (!item.shipments || item.shipments.length === 0) {
        return NextResponse.json(
          { error: 'Each item must have at least one shipment' },
          { status: 400 }
        );
      }

      // Validate total shipment quantity matches item quantity
      const totalShipmentQty = item.shipments.reduce((sum, s) => sum + s.quantity, 0);
      if (totalShipmentQty !== item.quantity) {
        return NextResponse.json(
          { error: `Total shipment quantity (${totalShipmentQty}) does not match item quantity (${item.quantity})` },
          { status: 400 }
        );
      }
    }

    // Calculate totals
    let subtotal = 0;
    const itemsWithTotals = orderData.items.map(item => {
      const discountPercent = item.discount_percent || 0;
      const itemSubtotal = item.quantity * item.unit_price;
      const discountAmountItem = itemSubtotal * (discountPercent / 100);
      const itemTotal = itemSubtotal - discountAmountItem;
      subtotal += itemTotal;
      return {
        ...item,
        discount_amount: discountAmountItem,
        subtotal: itemSubtotal,
        total: itemTotal
      };
    });

    // Calculate total shipping fee (deduplicated by address)
    const shippingFeeByAddress = new Map<string, number>();
    orderData.items.forEach(item => {
      item.shipments.forEach(s => {
        if (s.shipping_fee && !shippingFeeByAddress.has(s.shipping_address_id)) {
          shippingFeeByAddress.set(s.shipping_address_id, s.shipping_fee);
        }
      });
    });
    const totalShippingFee = Array.from(shippingFeeByAddress.values()).reduce((sum, f) => sum + f, 0);

    const discountAmount = orderData.discount_amount || 0;
    const vatAmount = (subtotal - discountAmount) * 0.07; // 7% VAT
    const totalAmount = subtotal - discountAmount + vatAmount + totalShippingFee;

    // Generate order number
    const { data: orderNumber, error: codeError } = await supabaseAdmin
      .rpc('generate_order_number');

    if (codeError) {
      console.error('Order number generation error:', codeError);
      return NextResponse.json(
        { error: 'Failed to generate order number' },
        { status: 500 }
      );
    }

    // Create order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_id: orderData.customer_id,
        delivery_date: orderData.delivery_date || null,
        subtotal,
        vat_amount: vatAmount,
        discount_amount: discountAmount,
        shipping_fee: totalShippingFee,
        total_amount: totalAmount,
        payment_method: orderData.payment_method || null,
        payment_status: 'pending',
        order_status: 'new',
        notes: orderData.notes || null,
        internal_notes: orderData.internal_notes || null,
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (orderError) {
      console.error('Order creation error:', orderError);
      return NextResponse.json(
        { error: orderError.message },
        { status: 400 }
      );
    }

    // Create order items and shipments
    for (const item of itemsWithTotals) {
      // Create order item
      const { data: orderItem, error: itemError } = await supabaseAdmin
        .from('order_items')
        .insert({
          order_id: order.id,
          variation_id: item.variation_id,
          sellable_product_id: item.sellable_product_id,
          product_code: item.product_code,
          product_name: item.product_name,
          bottle_size: item.bottle_size || null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent || 0,
          discount_amount: item.discount_amount,
          subtotal: item.subtotal,
          total: item.total,
          notes: item.notes || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (itemError) {
        console.error('Order item creation error:', itemError);
        // Rollback: delete the order
        await supabaseAdmin.from('orders').delete().eq('id', order.id);
        return NextResponse.json(
          { error: itemError.message },
          { status: 400 }
        );
      }

      // Create shipments for this item
      const shipmentsToInsert = item.shipments.map(shipment => ({
        order_item_id: orderItem.id,
        shipping_address_id: shipment.shipping_address_id,
        quantity: shipment.quantity,
        shipping_fee: shipment.shipping_fee || 0,
        delivery_status: 'pending',
        delivery_notes: shipment.delivery_notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error: shipmentError } = await supabaseAdmin
        .from('order_shipments')
        .insert(shipmentsToInsert);

      if (shipmentError) {
        console.error('Shipment creation error:', shipmentError);
        // Rollback: delete the order
        await supabaseAdmin.from('orders').delete().eq('id', order.id);
        return NextResponse.json(
          { error: shipmentError.message },
          { status: 400 }
        );
      }
    }

    // Fetch complete order details
    const { data: completeOrder } = await supabaseAdmin
      .rpc('get_order_details', { p_order_id: order.id });

    return NextResponse.json({
      success: true,
      order: completeOrder
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Get orders list or single order
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
    const orderId = searchParams.get('id');

    // If ID is provided, fetch single order with full details
    if (orderId) {
      // Fetch order with customer
      const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .select(`
          *,
          customer:customers (
            id,
            customer_code,
            name,
            contact_person,
            phone,
            email
          )
        `)
        .eq('id', orderId)
        .single();

      if (orderError || !order) {
        return NextResponse.json(
          { error: 'Order not found' },
          { status: 404 }
        );
      }

      // Fetch order items (product info already in order_items table)
      const { data: items, error: itemsError } = await supabaseAdmin
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);

      if (itemsError) {
        return NextResponse.json(
          { error: itemsError.message },
          { status: 500 }
        );
      }

      // Fetch shipments for each item
      const itemsWithShipments = await Promise.all(
        (items || []).map(async (item) => {
          const { data: shipments } = await supabaseAdmin
            .from('order_shipments')
            .select(`
              *,
              shipping_address:shipping_addresses (
                id,
                address_name,
                contact_person,
                phone,
                address_line1,
                district,
                amphoe,
                province,
                postal_code
              )
            `)
            .eq('order_item_id', item.id);

          return {
            ...item,
            shipments: shipments || []
          };
        })
      );

      return NextResponse.json({
        order: {
          ...order,
          items: itemsWithShipments
        }
      });
    }

    // Otherwise, fetch orders list
    const customerId = searchParams.get('customer_id');
    const status = searchParams.get('status');
    const paymentStatus = searchParams.get('payment_status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;

    // Use the order_summary view for efficient querying
    let query = supabaseAdmin
      .from('order_summary')
      .select('*', { count: 'exact' });

    // Apply filters
    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    if (status && status !== 'all') {
      query = query.eq('order_status', status);
    }

    if (paymentStatus && paymentStatus !== 'all') {
      query = query.eq('payment_status', paymentStatus);
    }

    if (search) {
      query = query.or(`order_number.ilike.%${search}%,customer_name.ilike.%${search}%`);
    }

    // Add pagination and ordering
    const { data: orders, error, count } = await query
      .order('order_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Early return if no orders
    if (!orders || orders.length === 0) {
      return NextResponse.json({
        orders: [],
        pagination: { page, limit, total: 0, totalPages: 0 }
      });
    }

    // Get all order IDs for batch fetching branch names
    const orderIds = orders.map(o => o.id);

    // Single optimized query: Get branch names directly via JOIN
    // This replaces 2 separate queries with 1 query
    const { data: branchData } = await supabaseAdmin
      .from('order_items')
      .select(`
        order_id,
        order_shipments!inner (
          shipping_address:shipping_addresses!inner (
            address_name
          )
        )
      `)
      .in('order_id', orderIds);

    // Build branch names map from joined data
    const orderBranchesMap = new Map<string, Set<string>>();
    (branchData || []).forEach((item: any) => {
      const orderId = item.order_id;
      if (!orderBranchesMap.has(orderId)) {
        orderBranchesMap.set(orderId, new Set());
      }
      (item.order_shipments || []).forEach((shipment: any) => {
        if (shipment.shipping_address?.address_name) {
          orderBranchesMap.get(orderId)!.add(shipment.shipping_address.address_name);
        }
      });
    });

    // Map orders with their branch names
    const ordersWithBranches = orders.map(order => ({
      ...order,
      branch_names: Array.from(orderBranchesMap.get(order.id) || [])
    }));

    return NextResponse.json({
      orders: ordersWithBranches,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update order (full update with items and shipments)
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
    const { id, items, delivery_date, payment_method, discount_amount, notes, internal_notes } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    // Check if order exists and is editable (only 'new' status can be fully edited)
    const { data: existingOrder, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('id, order_status')
      .eq('id', id)
      .single();

    if (fetchError || !existingOrder) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Allow editing only for 'new' orders, or allow simple status updates for any order
    const isFullUpdate = items && Array.isArray(items);
    if (isFullUpdate && existingOrder.order_status !== 'new') {
      return NextResponse.json(
        { error: `Cannot edit order items with status: ${existingOrder.order_status}. Only 'new' orders can be fully edited.` },
        { status: 400 }
      );
    }

    // If items are provided, this is a full update (delete old items/shipments and create new ones)
    if (items && Array.isArray(items)) {
      // Validate items structure
      if (items.length === 0) {
        return NextResponse.json(
          { error: 'Order must have at least one item' },
          { status: 400 }
        );
      }

      // Validate shipments for each item
      for (const item of items) {
        if (!item.shipments || item.shipments.length === 0) {
          return NextResponse.json(
            { error: 'Each item must have at least one shipment' },
            { status: 400 }
          );
        }

        const totalShipmentQty = item.shipments.reduce((sum: number, s: any) => sum + s.quantity, 0);
        if (totalShipmentQty !== item.quantity) {
          return NextResponse.json(
            { error: `Total shipment quantity (${totalShipmentQty}) does not match item quantity (${item.quantity})` },
            { status: 400 }
          );
        }
      }

      // Calculate totals
      let subtotal = 0;
      const itemsWithTotals = items.map((item: any) => {
        const discountPercent = item.discount_percent || 0;
        const itemSubtotal = item.quantity * item.unit_price;
        const discountAmountItem = itemSubtotal * (discountPercent / 100);
        const itemTotal = itemSubtotal - discountAmountItem;
        subtotal += itemTotal;
        return {
          ...item,
          discount_amount: discountAmountItem,
          subtotal: itemSubtotal,
          total: itemTotal
        };
      });

      // Calculate total shipping fee (deduplicated by address)
      const shippingFeeByAddress = new Map<string, number>();
      items.forEach((item: any) => {
        item.shipments.forEach((s: any) => {
          if (s.shipping_fee && !shippingFeeByAddress.has(s.shipping_address_id)) {
            shippingFeeByAddress.set(s.shipping_address_id, s.shipping_fee);
          }
        });
      });
      const totalShippingFee = Array.from(shippingFeeByAddress.values()).reduce((sum, f) => sum + f, 0);

      const orderDiscountAmount = discount_amount || 0;
      const vatAmount = (subtotal - orderDiscountAmount) * 0.07; // 7% VAT
      const totalAmount = subtotal - orderDiscountAmount + vatAmount + totalShippingFee;

      // Delete existing order items (cascades to shipments via foreign key)
      const { error: deleteItemsError } = await supabaseAdmin
        .from('order_items')
        .delete()
        .eq('order_id', id);

      if (deleteItemsError) {
        console.error('Error deleting old order items:', deleteItemsError);
        return NextResponse.json(
          { error: 'Failed to delete old order items' },
          { status: 500 }
        );
      }

      // Update order basic info
      const { error: updateOrderError } = await supabaseAdmin
        .from('orders')
        .update({
          delivery_date: delivery_date || null,
          subtotal,
          vat_amount: vatAmount,
          discount_amount: orderDiscountAmount,
          shipping_fee: totalShippingFee,
          total_amount: totalAmount,
          payment_method: payment_method || null,
          notes: notes || null,
          internal_notes: internal_notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateOrderError) {
        console.error('Order update error:', updateOrderError);
        return NextResponse.json(
          { error: updateOrderError.message },
          { status: 500 }
        );
      }

      // Create new order items and shipments
      for (const item of itemsWithTotals) {
        const { data: orderItem, error: itemError } = await supabaseAdmin
          .from('order_items')
          .insert({
            order_id: id,
            variation_id: item.variation_id,
            sellable_product_id: item.sellable_product_id,
            product_code: item.product_code,
            product_name: item.product_name,
            bottle_size: item.bottle_size || null,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount_percent: item.discount_percent || 0,
            discount_amount: item.discount_amount,
            subtotal: item.subtotal,
            total: item.total,
            notes: item.notes || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (itemError) {
          console.error('Order item creation error:', itemError);
          return NextResponse.json(
            { error: itemError.message },
            { status: 400 }
          );
        }

        // Create shipments for this item
        const shipmentsToInsert = item.shipments.map((shipment: any) => ({
          order_item_id: orderItem.id,
          shipping_address_id: shipment.shipping_address_id,
          quantity: shipment.quantity,
          shipping_fee: shipment.shipping_fee || 0,
          delivery_status: 'pending',
          delivery_notes: shipment.delivery_notes || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));

        const { error: shipmentError } = await supabaseAdmin
          .from('order_shipments')
          .insert(shipmentsToInsert);

        if (shipmentError) {
          console.error('Shipment creation error:', shipmentError);
          return NextResponse.json(
            { error: shipmentError.message },
            { status: 400 }
          );
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Order updated successfully'
      });
    } else {
      // Simple update (only basic fields, no items/shipments change)
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      // Only update fields that are provided
      if (delivery_date !== undefined) updateData.delivery_date = delivery_date || null;
      if (payment_method !== undefined) updateData.payment_method = payment_method || null;
      if (discount_amount !== undefined) updateData.discount_amount = discount_amount || 0;
      if (notes !== undefined) updateData.notes = notes || null;
      if (internal_notes !== undefined) updateData.internal_notes = internal_notes || null;
      if (body.shipping_fee !== undefined) updateData.shipping_fee = body.shipping_fee || 0;
      if (body.order_status !== undefined) updateData.order_status = body.order_status;
      if (body.payment_status !== undefined) updateData.payment_status = body.payment_status;

      const { error: updateError } = await supabaseAdmin
        .from('orders')
        .update(updateData)
        .eq('id', id);

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Order updated successfully'
      });
    }
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Cancel order
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
    const orderId = searchParams.get('id');

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    // Cancel order - set both order_status and payment_status to cancelled
    const { error } = await supabaseAdmin
      .from('orders')
      .update({
        order_status: 'cancelled',
        payment_status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

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
