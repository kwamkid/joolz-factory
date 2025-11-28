-- ========================================
-- Fix: Grant service_role permissions on auth.users
-- ========================================
-- This fixes the "Database error creating new user" issue
-- by granting the service_role the necessary permissions

-- Grant all privileges to service_role on auth.users table
GRANT ALL ON auth.users TO service_role;

-- Grant all privileges to service_role on auth schema (if needed)
GRANT USAGE ON SCHEMA auth TO service_role;

-- Verify the grants were applied
SELECT
    grantee,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'auth'
  AND table_name = 'users'
  AND grantee = 'service_role'
ORDER BY grantee, privilege_type;
