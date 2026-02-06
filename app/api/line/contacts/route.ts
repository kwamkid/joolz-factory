// Path: app/api/line/contacts/route.ts
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

// GET - Get LINE contacts list
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
    const unreadOnly = searchParams.get('unread_only') === 'true';

    let query = supabaseAdmin
      .from('line_contacts')
      .select(`
        *,
        customer:customers(id, name, customer_code)
      `)
      .eq('status', 'active')
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (search) {
      query = query.ilike('display_name', `%${search}%`);
    }

    if (unreadOnly) {
      query = query.gt('unread_count', 0);
    }

    const { data: contacts, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Get last message for each contact
    const contactIds = (contacts || []).map(c => c.id);

    // Get latest message per contact
    const { data: lastMessages } = await supabaseAdmin
      .from('line_messages')
      .select('line_contact_id, content, message_type')
      .in('line_contact_id', contactIds)
      .order('created_at', { ascending: false });

    // Build a map of contact_id -> last message
    const lastMessageMap = new Map<string, string>();
    (lastMessages || []).forEach(msg => {
      if (!lastMessageMap.has(msg.line_contact_id)) {
        // Format last message preview
        let preview = msg.content;
        if (msg.message_type === 'sticker') preview = '🎭 สติกเกอร์';
        else if (msg.message_type === 'image') preview = '🖼️ รูปภาพ';
        else if (msg.message_type === 'video') preview = '🎬 วิดีโอ';
        else if (msg.message_type === 'audio') preview = '🎵 เสียง';
        else if (msg.message_type === 'location') preview = '📍 ตำแหน่ง';
        else if (msg.message_type === 'file') preview = '📎 ไฟล์';
        lastMessageMap.set(msg.line_contact_id, preview);
      }
    });

    // Add last_message to contacts
    const contactsWithLastMessage = (contacts || []).map(contact => ({
      ...contact,
      last_message: lastMessageMap.get(contact.id) || null
    }));

    // Get unread counts summary
    const totalUnread = (contacts || []).reduce((sum, c) => sum + (c.unread_count || 0), 0);

    return NextResponse.json({
      contacts: contactsWithLastMessage,
      summary: {
        total: contacts?.length || 0,
        totalUnread
      }
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update LINE contact (link to customer, etc.)
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
    const { id, customer_id } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Contact ID is required' },
        { status: 400 }
      );
    }

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (customer_id !== undefined) {
      updateData.customer_id = customer_id || null;
    }

    const { error } = await supabaseAdmin
      .from('line_contacts')
      .update(updateData)
      .eq('id', id);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
