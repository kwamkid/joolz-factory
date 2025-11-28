-- ========================================
-- Fix trigger function to use explicit schema for user_role
-- ========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  user_role_value public.user_role;  -- Explicitly specify schema
BEGIN
  -- Extract role from metadata, default to 'operation' if not provided
  BEGIN
    user_role_value := COALESCE(
      (new.raw_user_meta_data->>'role')::public.user_role,
      'operation'::public.user_role
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- If casting fails, use default
      user_role_value := 'operation'::public.user_role;
      RAISE WARNING 'Failed to cast role, using default: %', SQLERRM;
  END;

  -- Insert or update user profile
  INSERT INTO public.user_profiles (id, email, name, role, is_active)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    user_role_value,
    true
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    updated_at = NOW();

  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and re-raise to prevent user creation if profile fails
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    RAISE;
END;
$function$;

-- Verify the function was updated
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'handle_new_user'
  AND pronamespace = 'public'::regnamespace;
