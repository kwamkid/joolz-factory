-- ========================================
-- Fix the handle_new_user trigger function
-- ========================================
-- The problem: COALESCE(new.raw_user_meta_data->>'role', 'admin')::user_role
-- fails to cast properly in some cases

-- Solution: Use explicit enum casting or handle the role separately

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  user_role_value user_role;
BEGIN
  -- Extract role from metadata, default to 'operation' if not provided
  -- Use 'operation' as default instead of 'admin' for security
  user_role_value := COALESCE(
    (new.raw_user_meta_data->>'role')::user_role,
    'operation'::user_role
  );

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

-- Verify the function was created successfully
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'handle_new_user';
