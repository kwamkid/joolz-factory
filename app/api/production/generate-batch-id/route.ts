// Path: app/api/production/generate-batch-id/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

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

export async function GET(request: NextRequest) {
  try {
    const isAuth = await checkAuth(request);

    if (!isAuth) {
      return NextResponse.json(
        { error: 'Unauthorized. Login required.' },
        { status: 401 }
      );
    }

    const year = new Date().getFullYear().toString();

    // Get the latest batch number for this year
    const { data: latestBatch } = await supabaseAdmin
      .from('production_batches')
      .select('batch_id')
      .like('batch_id', `BATCH-${year}-%`)
      .order('batch_id', { ascending: false })
      .limit(1)
      .single();

    let sequenceNum = 1;

    if (latestBatch?.batch_id) {
      const parts = latestBatch.batch_id.split('-');
      if (parts.length === 3) {
        sequenceNum = parseInt(parts[2], 10) + 1;
      }
    }

    const batchId = `BATCH-${year}-${sequenceNum.toString().padStart(4, '0')}`;

    return NextResponse.json({ batch_id: batchId });
  } catch (error) {
    console.error('Error generating batch ID:', error);
    // Return a fallback batch ID
    const fallbackId = `BATCH-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
    return NextResponse.json({ batch_id: fallbackId });
  }
}
