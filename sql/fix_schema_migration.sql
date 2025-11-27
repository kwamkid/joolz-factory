-- ============================================================
-- MIGRATION SCRIPT: Fix Schema to Match Application Code
-- ============================================================
-- This script updates the database schema to match the actual
-- code implementation currently running in production.
-- ============================================================

-- 1. RENAME TABLES (if they exist with old names)
-- ============================================================

-- Rename sales_orders to orders (if needed)
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sales_orders'
    ) AND NOT EXISTS (
        SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'orders'
    ) THEN
        ALTER TABLE public.sales_orders RENAME TO orders;
    END IF;
END $$;

-- Rename sales_order_items to order_items (if needed)
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sales_order_items'
    ) AND NOT EXISTS (
        SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'order_items'
    ) THEN
        ALTER TABLE public.sales_order_items RENAME TO order_items;
    END IF;
END $$;

-- 2. UPDATE ORDERS TABLE STRUCTURE
-- ============================================================

-- Add missing columns to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS vat_amount NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- Rename columns if using old names
DO $$
BEGIN
    -- Rename 'status' to 'order_status' if needed
    IF EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'orders'
        AND column_name = 'status'
    ) AND NOT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'orders'
        AND column_name = 'order_status'
    ) THEN
        ALTER TABLE public.orders RENAME COLUMN status TO order_status;
    END IF;

    -- Rename 'total' to 'total_amount' if needed
    IF EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'orders'
        AND column_name = 'total'
    ) AND NOT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'orders'
        AND column_name = 'total_amount'
    ) THEN
        ALTER TABLE public.orders RENAME COLUMN total TO total_amount;
    END IF;

    -- Rename 'discount' to 'discount_amount' if needed
    IF EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'orders'
        AND column_name = 'discount'
    ) AND NOT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'orders'
        AND column_name = 'discount_amount'
    ) THEN
        ALTER TABLE public.orders RENAME COLUMN discount TO discount_amount;
    END IF;
END $$;

-- Drop old CHECK constraint and create new one with correct statuses
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_status_check;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_order_status_check
    CHECK (order_status = ANY (ARRAY['new'::text, 'shipping'::text, 'completed'::text, 'cancelled'::text]));

-- Update payment_status constraint
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check
    CHECK (payment_status = ANY (ARRAY['pending'::text, 'paid'::text]));

-- 3. CREATE ORDER_SHIPMENTS TABLE (if not exists)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.order_shipments (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    order_item_id UUID NOT NULL,
    shipping_address_id UUID NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    delivery_status TEXT NOT NULL DEFAULT 'pending'::text,
    delivery_date TIMESTAMP WITH TIME ZONE,
    received_date TIMESTAMP WITH TIME ZONE,
    delivery_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT order_shipments_pkey PRIMARY KEY (id),
    CONSTRAINT order_shipments_order_item_id_fkey FOREIGN KEY (order_item_id)
        REFERENCES public.order_items(id) ON DELETE CASCADE,
    CONSTRAINT order_shipments_shipping_address_id_fkey FOREIGN KEY (shipping_address_id)
        REFERENCES public.shipping_addresses(id)
);

-- 4. CREATE SHIPPING_ADDRESSES TABLE (if not exists)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.shipping_addresses (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    address_name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    district TEXT,
    amphoe TEXT,
    province TEXT NOT NULL,
    postal_code TEXT,
    google_maps_link TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    delivery_notes TEXT,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT shipping_addresses_pkey PRIMARY KEY (id),
    CONSTRAINT shipping_addresses_customer_id_fkey FOREIGN KEY (customer_id)
        REFERENCES public.customers(id) ON DELETE CASCADE,
    CONSTRAINT shipping_addresses_created_by_fkey FOREIGN KEY (created_by)
        REFERENCES auth.users(id)
);

-- 5. UPDATE ORDER_ITEMS TABLE
-- ============================================================

ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS variation_id UUID;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS sellable_product_id UUID;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS product_code TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS bottle_size TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS discount_percent NUMERIC DEFAULT 0
    CHECK (discount_percent >= 0 AND discount_percent <= 100);
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS subtotal NUMERIC;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS notes TEXT;

-- Rename price_per_unit to unit_price if needed
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'order_items'
        AND column_name = 'price_per_unit'
    ) AND NOT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'order_items'
        AND column_name = 'unit_price'
    ) THEN
        ALTER TABLE public.order_items RENAME COLUMN price_per_unit TO unit_price;
    END IF;
END $$;

-- Add foreign keys for new columns
ALTER TABLE public.order_items
    DROP CONSTRAINT IF EXISTS order_items_variation_id_fkey;
ALTER TABLE public.order_items
    ADD CONSTRAINT order_items_variation_id_fkey
    FOREIGN KEY (variation_id) REFERENCES public.sellable_product_variations(id);

ALTER TABLE public.order_items
    DROP CONSTRAINT IF EXISTS order_items_sellable_product_id_fkey;
ALTER TABLE public.order_items
    ADD CONSTRAINT order_items_sellable_product_id_fkey
    FOREIGN KEY (sellable_product_id) REFERENCES public.sellable_products(id);

-- 6. UPDATE CUSTOMERS TABLE
-- ============================================================

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS customer_code TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS amphoe TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS tax_id TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS assigned_salesperson UUID;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS name TEXT;

-- Rename columns if using old names
DO $$
BEGIN
    -- Rename 'business_name' to 'name' if needed (keep business_name too)
    -- We'll just ensure 'name' exists

    -- Rename 'contact_name' to 'contact_person' if needed
    IF EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'customers'
        AND column_name = 'contact_name'
    ) AND NOT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'customers'
        AND column_name = 'contact_person'
    ) THEN
        ALTER TABLE public.customers RENAME COLUMN contact_name TO contact_person;
    END IF;

    -- Rename 'type' to 'customer_type_new' if needed
    IF EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'customers'
        AND column_name = 'type'
    ) AND NOT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'customers'
        AND column_name = 'customer_type_new'
    ) THEN
        ALTER TABLE public.customers RENAME COLUMN type TO customer_type_new;
    END IF;

    -- Rename 'credit_term' to 'credit_days' if needed
    IF EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'customers'
        AND column_name = 'credit_term'
    ) AND NOT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'customers'
        AND column_name = 'credit_days'
    ) THEN
        ALTER TABLE public.customers RENAME COLUMN credit_term TO credit_days;
    END IF;

    -- Rename 'total_revenue' to 'total_sales' if needed
    IF EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'customers'
        AND column_name = 'total_revenue'
    ) AND NOT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'customers'
        AND column_name = 'total_sales'
    ) THEN
        ALTER TABLE public.customers RENAME COLUMN total_revenue TO total_sales;
    END IF;
END $$;

-- Add foreign keys
ALTER TABLE public.customers
    DROP CONSTRAINT IF EXISTS customers_assigned_salesperson_fkey;
ALTER TABLE public.customers
    ADD CONSTRAINT customers_assigned_salesperson_fkey
    FOREIGN KEY (assigned_salesperson) REFERENCES auth.users(id);

ALTER TABLE public.customers
    DROP CONSTRAINT IF EXISTS customers_created_by_fkey;
ALTER TABLE public.customers
    ADD CONSTRAINT customers_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id);

-- Make customer_code unique if not already
CREATE UNIQUE INDEX IF NOT EXISTS customers_customer_code_key
    ON public.customers(customer_code);

-- 7. CREATE SELLABLE_PRODUCTS TABLE (if not exists)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sellable_products (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL,
    bottle_type_id UUID,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    image TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT sellable_products_pkey PRIMARY KEY (id),
    CONSTRAINT sellable_products_product_id_fkey FOREIGN KEY (product_id)
        REFERENCES public.products(id) ON DELETE CASCADE,
    CONSTRAINT sellable_products_bottle_type_id_fkey FOREIGN KEY (bottle_type_id)
        REFERENCES public.bottle_types(id)
);

-- 8. CREATE SELLABLE_PRODUCT_VARIATIONS TABLE (if not exists)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sellable_product_variations (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    sellable_product_id UUID NOT NULL,
    bottle_type_id UUID NOT NULL,
    default_price NUMERIC NOT NULL DEFAULT 0,
    discount_price NUMERIC DEFAULT 0,
    stock INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT sellable_product_variations_pkey PRIMARY KEY (id),
    CONSTRAINT sellable_product_variations_bottle_type_id_fkey FOREIGN KEY (bottle_type_id)
        REFERENCES public.bottle_types(id),
    CONSTRAINT sellable_product_variations_sellable_product_id_fkey FOREIGN KEY (sellable_product_id)
        REFERENCES public.sellable_products(id) ON DELETE CASCADE
);

-- 9. CREATE PAYMENT_RECORDS TABLE (if not exists)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payment_records (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    payment_method VARCHAR NOT NULL CHECK (payment_method IN ('cash', 'transfer', 'credit', 'cheque')),
    payment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    amount NUMERIC NOT NULL,
    collected_by VARCHAR,
    transfer_date DATE,
    transfer_time TIME,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID,
    CONSTRAINT payment_records_pkey PRIMARY KEY (id),
    CONSTRAINT payment_records_order_id_fkey FOREIGN KEY (order_id)
        REFERENCES public.orders(id) ON DELETE CASCADE,
    CONSTRAINT payment_records_created_by_fkey FOREIGN KEY (created_by)
        REFERENCES auth.users(id)
);

-- 10. CREATE STOCK_TRANSACTIONS TABLE (if not exists)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.stock_transactions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    raw_material_id UUID NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('in', 'out')),
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT stock_transactions_pkey PRIMARY KEY (id),
    CONSTRAINT stock_transactions_raw_material_id_fkey FOREIGN KEY (raw_material_id)
        REFERENCES public.raw_materials(id)
);

-- 11. CREATE BOTTLE_STOCK_TRANSACTIONS TABLE (if not exists)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bottle_stock_transactions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    bottle_id UUID NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('in', 'production', 'damage')),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT bottle_stock_transactions_pkey PRIMARY KEY (id),
    CONSTRAINT bottle_stock_transactions_bottle_id_fkey FOREIGN KEY (bottle_id)
        REFERENCES public.bottle_types(id)
);

-- 12. UPDATE PRODUCTS TABLE
-- ============================================================

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'manufactured'::text
    CHECK (product_type IN ('manufactured', 'purchased'));
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS default_price NUMERIC DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS discount_price NUMERIC DEFAULT 0;

-- 13. CREATE PRODUCT_RECIPES TABLE (if not exists)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.product_recipes (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL,
    raw_material_id UUID NOT NULL,
    quantity_per_unit NUMERIC NOT NULL CHECK (quantity_per_unit > 0),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT product_recipes_pkey PRIMARY KEY (id),
    CONSTRAINT product_recipes_product_id_fkey FOREIGN KEY (product_id)
        REFERENCES public.products(id) ON DELETE CASCADE,
    CONSTRAINT product_recipes_raw_material_id_fkey FOREIGN KEY (raw_material_id)
        REFERENCES public.raw_materials(id)
);

-- 14. UPDATE BOTTLE_TYPES TABLE
-- ============================================================

ALTER TABLE public.bottle_types ADD COLUMN IF NOT EXISTS capacity_ml INTEGER;

-- 15. UPDATE PRODUCTION_BATCHES TABLE
-- ============================================================

-- Rename batch_number to batch_id if needed
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'production_batches'
        AND column_name = 'batch_number'
    ) AND NOT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'production_batches'
        AND column_name = 'batch_id'
    ) THEN
        ALTER TABLE public.production_batches RENAME COLUMN batch_number TO batch_id;
    END IF;
END $$;

ALTER TABLE public.production_batches ADD COLUMN IF NOT EXISTS planned_date DATE;
ALTER TABLE public.production_batches ADD COLUMN IF NOT EXISTS planned_items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.production_batches ADD COLUMN IF NOT EXISTS planned_notes TEXT;
ALTER TABLE public.production_batches ADD COLUMN IF NOT EXISTS planned_by UUID;
ALTER TABLE public.production_batches ADD COLUMN IF NOT EXISTS planned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.production_batches ADD COLUMN IF NOT EXISTS actual_items JSONB;
ALTER TABLE public.production_batches ADD COLUMN IF NOT EXISTS actual_materials JSONB;
ALTER TABLE public.production_batches ADD COLUMN IF NOT EXISTS brix_before NUMERIC;
ALTER TABLE public.production_batches ADD COLUMN IF NOT EXISTS brix_after NUMERIC;
ALTER TABLE public.production_batches ADD COLUMN IF NOT EXISTS acidity_before NUMERIC;
ALTER TABLE public.production_batches ADD COLUMN IF NOT EXISTS acidity_after NUMERIC;
ALTER TABLE public.production_batches ADD COLUMN IF NOT EXISTS quality_images JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.production_batches ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.production_batches ADD COLUMN IF NOT EXISTS started_by UUID;
ALTER TABLE public.production_batches ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.production_batches ADD COLUMN IF NOT EXISTS completed_by UUID;
ALTER TABLE public.production_batches ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.production_batches ADD COLUMN IF NOT EXISTS cancelled_by UUID;
ALTER TABLE public.production_batches ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;
ALTER TABLE public.production_batches ADD COLUMN IF NOT EXISTS execution_notes TEXT;

-- Add foreign keys
ALTER TABLE public.production_batches
    DROP CONSTRAINT IF EXISTS production_batches_planned_by_fkey;
ALTER TABLE public.production_batches
    ADD CONSTRAINT production_batches_planned_by_fkey
    FOREIGN KEY (planned_by) REFERENCES auth.users(id);

ALTER TABLE public.production_batches
    DROP CONSTRAINT IF EXISTS production_batches_started_by_fkey;
ALTER TABLE public.production_batches
    ADD CONSTRAINT production_batches_started_by_fkey
    FOREIGN KEY (started_by) REFERENCES auth.users(id);

ALTER TABLE public.production_batches
    DROP CONSTRAINT IF EXISTS production_batches_completed_by_fkey;
ALTER TABLE public.production_batches
    ADD CONSTRAINT production_batches_completed_by_fkey
    FOREIGN KEY (completed_by) REFERENCES auth.users(id);

ALTER TABLE public.production_batches
    DROP CONSTRAINT IF EXISTS production_batches_cancelled_by_fkey;
ALTER TABLE public.production_batches
    ADD CONSTRAINT production_batches_cancelled_by_fkey
    FOREIGN KEY (cancelled_by) REFERENCES auth.users(id);

-- ============================================================
-- COMPLETED
-- ============================================================

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_order_shipments_order_item_id ON public.order_shipments(order_item_id);
CREATE INDEX IF NOT EXISTS idx_order_shipments_shipping_address_id ON public.order_shipments(shipping_address_id);
CREATE INDEX IF NOT EXISTS idx_shipping_addresses_customer_id ON public.shipping_addresses(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON public.orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_order_id ON public.payment_records(order_id);
CREATE INDEX IF NOT EXISTS idx_sellable_products_product_id ON public.sellable_products(product_id);
CREATE INDEX IF NOT EXISTS idx_sellable_product_variations_sellable_product_id ON public.sellable_product_variations(sellable_product_id);

-- End of migration
