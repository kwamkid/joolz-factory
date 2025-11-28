import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Test 1: Check environment variables
    const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!hasUrl || !hasServiceKey) {
      return NextResponse.json({
        error: 'Missing environment variables',
        hasUrl,
        hasServiceKey
      }, { status: 500 });
    }

    // Test 2: Create admin client
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

    // Test 3: Try to list users (this should work if service_role is correct)
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      return NextResponse.json({
        error: 'Failed to list users',
        details: listError.message,
        code: listError.code
      }, { status: 500 });
    }

    // Test 4: Try to create a test user
    const testEmail = `test-${Date.now()}@example.com`;
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: 'Test123456',
      email_confirm: true,
      user_metadata: {
        name: 'Test User',
        role: 'operation'
      }
    });

    if (createError) {
      // Clean up: Delete the test user if it was created
      if (authData?.user) {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      }

      return NextResponse.json({
        error: 'Failed to create test user',
        details: createError.message,
        code: createError.code,
        status: createError.status,
        fullError: JSON.stringify(createError, null, 2)
      }, { status: 500 });
    }

    // Success - clean up the test user
    if (authData?.user) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    }

    return NextResponse.json({
      success: true,
      message: 'All tests passed',
      userCount: users?.users?.length || 0,
      testUserCreated: !!authData?.user
    });

  } catch (error: any) {
    return NextResponse.json({
      error: 'Unexpected error',
      message: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
