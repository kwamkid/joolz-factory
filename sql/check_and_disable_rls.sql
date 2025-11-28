-- ========================================
-- Check and potentially disable RLS on auth.users
-- ========================================

-- 1. Check if RLS is enabled on auth.users
SELECT
    schemaname,
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'auth'
  AND tablename = 'users';

-- 2. Check ALL policies on auth.users (if any)
SELECT *
FROM pg_policies
WHERE schemaname = 'auth'
  AND tablename = 'users';

-- 3. If RLS is enabled and blocking, you can try to disable it (USE WITH CAUTION)
-- Note: Supabase manages auth.users internally, so this might not work or might be reset
-- Uncomment only if you understand the implications:

-- ALTER TABLE auth.users DISABLE ROW LEVEL SECURITY;

-- 4. Alternative: Check if there's a CHECK constraint or other constraint failing
SELECT
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'auth.users'::regclass
ORDER BY contype;

-- 5. Check if auth schema has correct permissions
SELECT
    n.nspname AS schema_name,
    n.nspowner::regrole AS owner,
    has_schema_privilege('service_role', n.nspname, 'USAGE') AS service_role_can_use
FROM pg_namespace n
WHERE n.nspname = 'auth';
