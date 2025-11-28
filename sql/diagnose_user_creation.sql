-- ========================================
-- Diagnostic Scripts for User Creation Issue
-- ========================================
-- Run these queries in Supabase SQL Editor to diagnose the problem

-- ========================================
-- 1. Check Triggers on auth.users table
-- ========================================
SELECT
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users'
ORDER BY trigger_name;

-- ========================================
-- 2. Check Triggers on public.user_profiles table
-- ========================================
SELECT
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'user_profiles'
ORDER BY trigger_name;

-- ========================================
-- 3. Check RLS Policies on auth.users
-- ========================================
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'auth'
  AND tablename = 'users';

-- ========================================
-- 4. Check RLS Policies on public.user_profiles
-- ========================================
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'user_profiles';

-- ========================================
-- 5. Check if RLS is enabled
-- ========================================
SELECT
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname IN ('auth', 'public')
  AND tablename IN ('users', 'user_profiles');

-- ========================================
-- 6. Check all constraints on user_profiles
-- ========================================
SELECT
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'user_profiles'
ORDER BY tc.constraint_type, tc.constraint_name;

-- ========================================
-- 7. Check for any trigger functions
-- ========================================
SELECT
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname LIKE '%user%'
  AND n.nspname IN ('public', 'auth')
ORDER BY n.nspname, p.proname;

-- ========================================
-- 8. Check unique constraint on line_user_id
-- ========================================
SELECT
    conname as constraint_name,
    contype as constraint_type,
    conkey as constrained_columns,
    condeferrable,
    condeferred
FROM pg_constraint
WHERE conrelid = 'public.user_profiles'::regclass
  AND contype = 'u'
ORDER BY conname;

-- ========================================
-- 9. Test if there are any existing duplicate emails
-- ========================================
SELECT
    email,
    COUNT(*) as count
FROM public.user_profiles
GROUP BY email
HAVING COUNT(*) > 1;

-- ========================================
-- 10. Test if there are any existing duplicate line_user_id (non-null)
-- ========================================
SELECT
    line_user_id,
    COUNT(*) as count
FROM public.user_profiles
WHERE line_user_id IS NOT NULL
GROUP BY line_user_id
HAVING COUNT(*) > 1;

-- ========================================
-- 11. Check auth.users table structure
-- ========================================
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'auth'
  AND table_name = 'users'
ORDER BY ordinal_position;

-- ========================================
-- 12. Check if service_role can insert into auth.users
-- ========================================
-- Note: This is a read-only check, doesn't actually insert
SELECT
    grantee,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'auth'
  AND table_name = 'users'
ORDER BY grantee, privilege_type;

-- ========================================
-- INSTRUCTIONS:
-- ========================================
-- 1. Copy and paste each query one by one into Supabase SQL Editor
-- 2. Look for any triggers that might be failing
-- 3. Look for RLS policies that might be blocking inserts
-- 4. Check if there are any constraint violations
-- 5. Pay special attention to triggers on auth.users table
-- 6. Check if any trigger function definitions have errors
