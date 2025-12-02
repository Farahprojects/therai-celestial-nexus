-- USER_MEMORY_MONTHLY_SUMMARIES CONSOLIDATED POLICIES
-- Reference implementation for monthly memory summary access
-- User isolation with controlled deletion and service management

-- Safe policy cleanup and recreation for monthly memory summaries
DO $$
BEGIN
  -- Clean up existing broad policies
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Service role can manage monthly summaries" ON public.user_memory_monthly_summaries;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view their own monthly summaries" ON public.user_memory_monthly_summaries;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Users can delete their own monthly summaries" ON public.user_memory_monthly_summaries;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Service role: full access; doesn't affect user planning
  EXECUTE '
    CREATE POLICY user_monthly_summaries_service_all ON public.user_memory_monthly_summaries
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);
  ';

  -- Authenticated users: read own
  EXECUTE '
    CREATE POLICY user_monthly_summaries_user_select ON public.user_memory_monthly_summaries
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);
  ';

  -- Authenticated users: delete own
  EXECUTE '
    CREATE POLICY user_monthly_summaries_user_delete ON public.user_memory_monthly_summaries
    FOR DELETE TO authenticated
    USING ((SELECT auth.uid()) = user_id);
  ';

END $$;
