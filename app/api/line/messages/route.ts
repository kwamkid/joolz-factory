// Path: app/api/line/messages/route.ts
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

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';

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

// GET - Get messages for a contact
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
    const contactId = searchParams.get('contact_id');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!contactId) {
      return NextResponse.json(
        { error: 'contact_id is required' },
        { status: 400 }
      );
    }

    // Get messages
    const { data: messages, error } = await supabaseAdmin
      .from('line_messages')
      .select(`
        *,
        sent_by_user:user_profiles!sent_by(id, name)
      `)
      .eq('line_contact_id', contactId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Mark as read - reset unread count
    await supabaseAdmin
      .from('line_contacts')
      .update({ unread_count: 0 })
      .eq('id', contactId);

    // Return messages in chronological order (oldest first for chat display)
    return NextResponse.json({
      messages: (messages || []).reverse()
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Send a message
export async function POST(request: NextRequest) {
  try {
    const { isAuth, userId } = await checkAuth(request);

    if (!isAuth) {
      return NextResponse.json(
        { error: 'Unauthorized. Login required.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { contact_id, message } = body;

    if (!contact_id || !message) {
      return NextResponse.json(
        { error: 'contact_id and message are required' },
        { status: 400 }
      );
    }

    // Get contact's LINE user ID
    const { data: contact, error: contactError } = await supabaseAdmin
      .from('line_contacts')
      .select('line_user_id')
      .eq('id', contact_id)
      .single();

    if (contactError || !contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    // Send message via LINE API
    const lineResponse = await sendLineMessage(contact.line_user_id, message);

    if (!lineResponse.success) {
      return NextResponse.json(
        { error: lineResponse.error || 'Failed to send LINE message' },
        { status: 500 }
      );
    }

    // Save message to database
    const { data: savedMessage, error: saveError } = await supabaseAdmin
      .from('line_messages')
      .insert({
        line_contact_id: contact_id,
        direction: 'outgoing',
        message_type: 'text',
        content: message,
        sent_by: userId,
        sent_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      })
      .select(`
        *,
        sent_by_user:user_profiles!sent_by(id, name)
      `)
      .single();

    if (saveError) {
      console.error('Failed to save message:', saveError);
    }

    // Update contact's last_message_at
    await supabaseAdmin
      .from('line_contacts')
      .update({
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', contact_id);

    return NextResponse.json({
      success: true,
      message: savedMessage
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Send message via LINE Messaging API
async function sendLineMessage(lineUserId: string, message: string): Promise<{ success: boolean; error?: string }> {
  if (!LINE_CHANNEL_ACCESS_TOKEN) {
    return { success: false, error: 'LINE_CHANNEL_ACCESS_TOKEN not configured' };
  }

  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [
          {
            type: 'text',
            text: message
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('LINE API error:', errorData);
      return { success: false, error: errorData.message || 'LINE API error' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error sending LINE message:', error);
    return { success: false, error: 'Failed to send message' };
  }
}
