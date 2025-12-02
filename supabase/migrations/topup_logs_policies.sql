-- TOPUP_LOGS CONSOLIDATED POLICIES
-- Reference implementation for optimized RLS policies
-- User-isolated access with schema-aware conditional logic

-- Dynamic policy recreation with column existence check
DO $$
DECLARE pol RECORD;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='topup_logs'
  ) THEN
    -- Drop all existing policies dynamically
    FOR pol IN (
      SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename='topup_logs'
    ) LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.topup_logs;', pol.policyname);
    END LOOP;

    -- Service role: full access
    EXECUTE 'CREATE POLICY topup_logs_service_all ON public.topup_logs FOR ALL TO service_role USING (true) WITH CHECK (true);';

    -- Conditional user access based on schema
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema=''public'' AND table_name=''topup_logs'' AND column_name=''user_id''
    ) THEN
      -- User isolation if user_id column exists
      EXECUTE ''CREATE POLICY topup_logs_user_select ON public.topup_logs FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);'';
      EXECUTE ''CREATE POLICY topup_logs_user_insert ON public.topup_logs FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);'';
      EXECUTE ''CREATE POLICY topup_logs_user_update ON public.topup_logs FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);'';
      -- No user DELETE (security - topup logs should be immutable)
    ELSE
      -- Deny authenticated access if no user_id column
      EXECUTE ''CREATE POLICY topup_logs_user_deny ON public.topup_logs FOR ALL TO authenticated USING (false) WITH CHECK (false);'';
    END IF;

  END IF;
END$$;
