-- ========================================
-- Temporarily disable triggers to test if they're causing the issue
-- ========================================

-- WARNING: This is for TESTING ONLY. Re-enable triggers after testing.

-- 1. List all triggers on user_profiles
SELECT
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'user_profiles';

-- 2. Disable all triggers on user_profiles temporarily (FOR TESTING ONLY)
-- Uncomment the line below to disable:
-- ALTER TABLE public.user_profiles DISABLE TRIGGER ALL;

-- 3. After testing, re-enable triggers with:
-- ALTER TABLE public.user_profiles ENABLE TRIGGER ALL;

-- ========================================
-- Alternative: Check if there's a unique constraint issue
-- ========================================

-- Check for any NULL line_user_id entries (should be allowed)
SELECT COUNT(*) as null_line_user_id_count
FROM public.user_profiles
WHERE line_user_id IS NULL;

-- Check for duplicate line_user_id
SELECT line_user_id, COUNT(*) as count
FROM public.user_profiles
WHERE line_user_id IS NOT NULL
GROUP BY line_user_id
HAVING COUNT(*) > 1;

-- ========================================
-- Check auth.users schema to see if there are constraints
-- ========================================
SELECT
    con.conname AS constraint_name,
    con.contype AS constraint_type,
    CASE con.contype
        WHEN 'c' THEN 'CHECK'
        WHEN 'f' THEN 'FOREIGN KEY'
        WHEN 'p' THEN 'PRIMARY KEY'
        WHEN 'u' THEN 'UNIQUE'
        WHEN 't' THEN 'TRIGGER'
        WHEN 'x' THEN 'EXCLUSION'
        ELSE con.contype::text
    END AS constraint_type_desc,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON con.conrelid = rel.oid
JOIN pg_namespace nsp ON rel.relnamespace = nsp.oid
WHERE nsp.nspname = 'auth'
  AND rel.relname = 'users'
ORDER BY con.contype, con.conname;
