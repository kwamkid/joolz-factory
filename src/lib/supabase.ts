// Path: src/lib/supabase.ts

import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper function to handle Supabase errors
export const handleSupabaseError = (error: Error | null): string => {
  if (error) {
    console.error('Supabase error:', error);
    return error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
  }
  return '';
};

// Check if user is authenticated
export const checkAuth = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Auth error:', error);
    return null;
  }
  return session;
};

// Get current user
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Get user error:', error);
    return null;
  }
  return user;
};