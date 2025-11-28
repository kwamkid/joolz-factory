-- ========================================
-- Check for triggers and functions that might be blocking user creation
-- ========================================

-- 1. Check if there's a trigger on auth.users for new user creation
SELECT
    t.tgname AS trigger_name,
    t.tgenabled AS is_enabled,
    p.proname AS function_name,
    pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
LEFT JOIN pg_proc p ON t.tgfoid = p.oid
WHERE n.nspname = 'auth'
  AND c.relname = 'users'
  AND NOT t.tgisinternal
ORDER BY t.tgname;

-- 2. Show the actual function code that runs on auth.users triggers
SELECT
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS function_code
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE n.nspname = 'auth'
  AND c.relname = 'users'
  AND NOT t.tgisinternal;

-- 3. Check if RLS is enabled on auth.users
SELECT
    schemaname,
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'auth'
  AND tablename = 'users';

-- 4. Check for any function that creates user_profiles
SELECT
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE (p.proname ILIKE '%user%profile%'
   OR p.proname ILIKE '%handle%new%user%'
   OR p.proname ILIKE '%create%profile%')
  AND n.nspname IN ('public', 'auth')
ORDER BY n.nspname, p.proname;

-- 5. Check auth.users table permissions for all roles
SELECT
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'auth'
  AND table_name = 'users'
ORDER BY grantee, privilege_type;
