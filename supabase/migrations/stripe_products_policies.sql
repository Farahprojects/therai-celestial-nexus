-- STRIPE_PRODUCTS CONSOLIDATED POLICIES
-- Reference implementation for optimized RLS policies
-- Public product catalog with service role management

-- Dynamic policy recreation with table existence check
DO $$
DECLARE pol RECORD;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='stripe_products'
  ) THEN
    -- Drop all existing policies dynamically
    FOR pol IN (
      SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename='stripe_products'
    ) LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.stripe_products;', pol.policyname);
    END LOOP;

    -- Public read access for product catalog
    EXECUTE 'CREATE POLICY stripe_products_public_read ON public.stripe_products FOR SELECT TO anon, authenticated USING (true);';

    -- Service role full management access
    EXECUTE 'CREATE POLICY stripe_products_service_all ON public.stripe_products FOR ALL TO service_role USING (true) WITH CHECK (true);';

  END IF;
END$$;
