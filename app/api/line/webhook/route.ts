// Path: app/api/line/webhook/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

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

const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '';

// Verify LINE signature
function verifySignature(body: string, signature: string): boolean {
  if (!LINE_CHANNEL_SECRET) {
    console.error('LINE_CHANNEL_SECRET not set');
    return false;
  }

  const hash = crypto
    .createHmac('sha256', LINE_CHANNEL_SECRET)
    .update(body)
    .digest('base64');

  return hash === signature;
}

// LINE Webhook event types
interface LineEvent {
  type: string;
  timestamp: number;
  source: {
    type: string;
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  replyToken?: string;
  message?: {
    id: string;
    type: string;
    text?: string;
    fileName?: string;
    fileSize?: number;
    contentProvider?: {
      type: string;
      originalContentUrl?: string;
      previewImageUrl?: string;
    };
  };
  postback?: {
    data: string;
  };
}

interface LineWebhookBody {
  destination: string;
  events: LineEvent[];
}

// POST - Receive LINE webhook events
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-line-signature') || '';

    // Verify signature in production
    if (process.env.NODE_ENV === 'production' && !verifySignature(body, signature)) {
      console.error('Invalid LINE signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const webhookBody: LineWebhookBody = JSON.parse(body);

    // Process each event
    for (const event of webhookBody.events) {
      await processEvent(event);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('LINE webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Process individual LINE event
async function processEvent(event: LineEvent) {
  const lineUserId = event.source.userId;

  if (!lineUserId) {
    console.log('No userId in event');
    return;
  }

  // Handle message events
  if (event.type === 'message' && event.message) {
    await handleMessageEvent(lineUserId, event);
  }

  // Handle follow event (user adds friend)
  if (event.type === 'follow') {
    await handleFollowEvent(lineUserId);
  }

  // Handle unfollow event (user blocks)
  if (event.type === 'unfollow') {
    await handleUnfollowEvent(lineUserId);
  }
}

// Handle incoming message
async function handleMessageEvent(lineUserId: string, event: LineEvent) {
  const message = event.message!;

  // Get or create LINE contact
  const contact = await getOrCreateLineContact(lineUserId);

  if (!contact) {
    console.error('Failed to get/create contact for:', lineUserId);
    return;
  }

  // Prepare message content based on type
  let messageContent = '';
  let messageType = message.type;

  if (message.type === 'text' && message.text) {
    messageContent = message.text;
  } else if (message.type === 'image') {
    messageContent = '[รูปภาพ]';
  } else if (message.type === 'video') {
    messageContent = '[วิดีโอ]';
  } else if (message.type === 'audio') {
    messageContent = '[เสียง]';
  } else if (message.type === 'file') {
    messageContent = `[ไฟล์: ${message.fileName || 'unknown'}]`;
  } else if (message.type === 'sticker') {
    messageContent = '[สติกเกอร์]';
  } else if (message.type === 'location') {
    messageContent = '[ตำแหน่ง]';
  } else {
    messageContent = `[${message.type}]`;
  }

  // Save message to database
  const { error } = await supabaseAdmin
    .from('line_messages')
    .insert({
      line_contact_id: contact.id,
      line_message_id: message.id,
      direction: 'incoming',
      message_type: messageType,
      content: messageContent,
      raw_message: message,
      received_at: new Date(event.timestamp).toISOString(),
      created_at: new Date().toISOString()
    });

  if (error) {
    console.error('Failed to save message:', error);
  }

  // Update contact's last_message_at
  await supabaseAdmin
    .from('line_contacts')
    .update({
      last_message_at: new Date(event.timestamp).toISOString(),
      unread_count: contact.unread_count + 1,
      updated_at: new Date().toISOString()
    })
    .eq('id', contact.id);
}

// Handle follow event
async function handleFollowEvent(lineUserId: string) {
  // Get LINE profile
  const profile = await getLineProfile(lineUserId);

  // Create or update contact
  const { error } = await supabaseAdmin
    .from('line_contacts')
    .upsert({
      line_user_id: lineUserId,
      display_name: profile?.displayName || 'Unknown',
      picture_url: profile?.pictureUrl || null,
      status: 'active',
      followed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'line_user_id'
    });

  if (error) {
    console.error('Failed to create/update contact on follow:', error);
  }
}

// Handle unfollow event
async function handleUnfollowEvent(lineUserId: string) {
  const { error } = await supabaseAdmin
    .from('line_contacts')
    .update({
      status: 'blocked',
      updated_at: new Date().toISOString()
    })
    .eq('line_user_id', lineUserId);

  if (error) {
    console.error('Failed to update contact on unfollow:', error);
  }
}

// Get or create LINE contact
async function getOrCreateLineContact(lineUserId: string) {
  // Check if contact exists
  const { data: existing } = await supabaseAdmin
    .from('line_contacts')
    .select('*')
    .eq('line_user_id', lineUserId)
    .single();

  if (existing) {
    return existing;
  }

  // Get LINE profile
  const profile = await getLineProfile(lineUserId);

  // Create new contact
  const { data: newContact, error } = await supabaseAdmin
    .from('line_contacts')
    .insert({
      line_user_id: lineUserId,
      display_name: profile?.displayName || 'Unknown',
      picture_url: profile?.pictureUrl || null,
      status: 'active',
      unread_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create contact:', error);
    return null;
  }

  return newContact;
}

// Get LINE user profile
async function getLineProfile(lineUserId: string) {
  const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!LINE_CHANNEL_ACCESS_TOKEN) {
    console.error('LINE_CHANNEL_ACCESS_TOKEN not set');
    return null;
  }

  try {
    const response = await fetch(`https://api.line.me/v2/bot/profile/${lineUserId}`, {
      headers: {
        'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
      }
    });

    if (!response.ok) {
      console.error('Failed to get LINE profile:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching LINE profile:', error);
    return null;
  }
}

// GET - For LINE webhook verification
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
