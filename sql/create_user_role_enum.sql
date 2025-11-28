-- ========================================
-- Create user_role enum type
-- ========================================

-- 1. Check if enum already exists
SELECT typname, typtype
FROM pg_type
WHERE typname = 'user_role';

-- 2. Create the enum type if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'manager', 'operation', 'sales');
        RAISE NOTICE 'Created user_role enum type';
    ELSE
        RAISE NOTICE 'user_role enum type already exists';
    END IF;
END $$;

-- 3. Verify it was created
SELECT typname, typtype, enumlabel
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname = 'user_role'
ORDER BY enumsortorder;

-- 4. Verify the user_profiles table uses this type
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_profiles'
  AND column_name = 'role';
