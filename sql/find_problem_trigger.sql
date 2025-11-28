-- ========================================
-- Find the problematic trigger or function
-- ========================================

-- 1. Show ALL functions that might run on user creation
SELECT
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname IN ('public', 'auth')
  AND (
    p.proname ILIKE '%user%'
    OR p.proname ILIKE '%profile%'
    OR p.proname ILIKE '%handle%'
  )
ORDER BY n.nspname, p.proname;

-- 2. Show triggers on auth.users
SELECT
    t.tgname AS trigger_name,
    t.tgenabled AS enabled,
    p.proname AS function_name,
    CASE t.tgtype::integer & 2
        WHEN 0 THEN 'BEFORE'
        ELSE 'AFTER'
    END AS trigger_timing,
    CASE t.tgtype::integer & 28
        WHEN 4 THEN 'INSERT'
        WHEN 8 THEN 'DELETE'
        WHEN 16 THEN 'UPDATE'
        ELSE 'MULTIPLE'
    END AS trigger_event
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
LEFT JOIN pg_proc p ON t.tgfoid = p.oid
WHERE n.nspname = 'auth'
  AND c.relname = 'users'
  AND NOT t.tgisinternal;

-- 3. Show triggers on public.user_profiles
SELECT
    t.tgname AS trigger_name,
    t.tgenabled AS enabled,
    p.proname AS function_name,
    CASE t.tgtype::integer & 2
        WHEN 0 THEN 'BEFORE'
        ELSE 'AFTER'
    END AS trigger_timing,
    CASE t.tgtype::integer & 28
        WHEN 4 THEN 'INSERT'
        WHEN 8 THEN 'DELETE'
        WHEN 16 THEN 'UPDATE'
        ELSE 'MULTIPLE'
    END AS trigger_event
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
LEFT JOIN pg_proc p ON t.tgfoid = p.oid
WHERE n.nspname = 'public'
  AND c.relname = 'user_profiles'
  AND NOT t.tgisinternal;

-- 4. Check if there are any check constraints on auth.users that might fail
SELECT
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'auth.users'::regclass
  AND contype = 'c';
