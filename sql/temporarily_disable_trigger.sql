-- ========================================
-- Temporarily DISABLE the trigger to test
-- ========================================
-- This will help us determine if the trigger is causing the issue

-- 1. Disable the trigger
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;

-- 2. Verify it's disabled
SELECT
    trigger_name,
    event_manipulation,
    action_timing,
    tgenabled AS enabled_status
FROM information_schema.triggers
JOIN pg_trigger ON trigger_name = tgname
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users'
  AND trigger_name = 'on_auth_user_created';

-- tgenabled values:
-- 'O' = enabled
-- 'D' = disabled
-- 'R' = enabled for replica
-- 'A' = always enabled

-- ========================================
-- After testing, RE-ENABLE the trigger with:
-- ========================================
-- ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;
