-- ========================================
-- Test creating a user directly via SQL to see the actual error
-- ========================================

-- This will attempt to insert directly into auth.users
-- WARNING: This is for DIAGNOSTIC purposes only!

DO $$
DECLARE
    test_user_id uuid;
    test_email text;
BEGIN
    -- Generate test email
    test_email := 'sqltest-' || floor(random() * 1000000)::text || '@example.com';
    test_user_id := gen_random_uuid();

    RAISE NOTICE 'Attempting to create test user: %', test_email;

    -- Try to insert into auth.users
    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        aud,
        role
    ) VALUES (
        test_user_id,
        '00000000-0000-0000-0000-000000000000'::uuid,
        test_email,
        crypt('Test123456', gen_salt('bf')),
        NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"name":"SQL Test User","role":"operation"}'::jsonb,
        NOW(),
        NOW(),
        '',
        'authenticated',
        'authenticated'
    );

    RAISE NOTICE 'Successfully created user: %', test_user_id;

    -- Clean up
    DELETE FROM auth.users WHERE id = test_user_id;
    RAISE NOTICE 'Cleaned up test user';

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'ERROR: % - %', SQLSTATE, SQLERRM;
        RAISE NOTICE 'DETAIL: %', COALESCE(PG_EXCEPTION_DETAIL, 'No detail available');
        RAISE NOTICE 'HINT: %', COALESCE(PG_EXCEPTION_HINT, 'No hint available');
END $$;
