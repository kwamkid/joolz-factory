-- ========================================
-- Fix: Change trigger from BEFORE to AFTER
-- ========================================
-- Problem: BEFORE trigger failing causes the entire INSERT to fail
-- Solution: Use AFTER trigger instead

-- 1. Drop the old trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Recreate as AFTER trigger instead of BEFORE
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. Verify the trigger was created correctly
SELECT
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users'
  AND trigger_name = 'on_auth_user_created';
