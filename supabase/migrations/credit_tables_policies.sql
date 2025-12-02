-- CREDIT TABLES CONSOLIDATED POLICIES
-- Reference implementation for user_credits and credit_transactions tables
-- Financial data access with strict user isolation and audit protection

-- Multi-table policy recreation with column existence checks
DO $$
DECLARE pol RECORD;
BEGIN
  -- user_credits table policies
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='user_credits'
  ) THEN
    -- Drop all existing policies dynamically
    FOR pol IN (
      SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename='user_credits'
    ) LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_credits;', pol.policyname);
    END LOOP;

    -- Service role: full access
    EXECUTE 'CREATE POLICY user_credits_service_all ON public.user_credits FOR ALL TO service_role USING (true) WITH CHECK (true);';

    -- Conditional user access based on schema
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema=''public'' AND table_name=''user_credits'' AND column_name=''user_id''
    ) THEN
      -- User can view and update their own credits
      EXECUTE ''CREATE POLICY user_credits_user_select ON public.user_credits FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);'';
      EXECUTE ''CREATE POLICY user_credits_user_update ON public.user_credits FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);'';
      -- No user INSERT/DELETE (credits managed by service operations)
    ELSE
      -- Deny authenticated access if no user_id column
      EXECUTE ''CREATE POLICY user_credits_user_deny ON public.user_credits FOR ALL TO authenticated USING (false) WITH CHECK (false);'';
    END IF;
  END IF;

  -- credit_transactions table policies
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='credit_transactions'
  ) THEN
    -- Drop all existing policies dynamically
    FOR pol IN (
      SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename='credit_transactions'
    ) LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.credit_transactions;', pol.policyname);
    END LOOP;

    -- Service role: full access
    EXECUTE 'CREATE POLICY credit_tx_service_all ON public.credit_transactions FOR ALL TO service_role USING (true) WITH CHECK (true);';

    -- Conditional user access based on schema
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema=''public'' AND table_name=''credit_transactions'' AND column_name=''user_id''
    ) THEN
      -- User can only view their own transaction history
      EXECUTE ''CREATE POLICY credit_tx_user_select ON public.credit_transactions FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);'';
      -- All modifications (INSERT/UPDATE/DELETE) are service-only for audit integrity
    ELSE
      -- Deny authenticated access if no user_id column
      EXECUTE ''CREATE POLICY credit_tx_user_deny ON public.credit_transactions FOR ALL TO authenticated USING (false) WITH CHECK (false);'';
    END IF;
  END IF;

END$$;
