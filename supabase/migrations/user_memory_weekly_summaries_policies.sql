-- USER_MEMORY_WEEKLY_SUMMARIES CONSOLIDATED POLICIES
-- Reference implementation for weekly memory summary access
-- User isolation with service-managed summary generation

-- Safe policy recreation with RLS enablement
DO $$
BEGIN
  -- Ensure RLS is enabled for security
  EXECUTE 'ALTER TABLE public.user_memory_weekly_summaries ENABLE ROW LEVEL SECURITY;';

  -- Drop conflicting or overly broad policies
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Service role can manage weekly summaries" ON public.user_memory_weekly_summaries;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view their own weekly summaries" ON public.user_memory_weekly_summaries;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS user_memory_weekly_summaries_select_own ON public.user_memory_weekly_summaries;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS user_memory_weekly_summaries_delete_own ON public.user_memory_weekly_summaries;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS user_memory_weekly_summaries_service_all ON public.user_memory_weekly_summaries;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Create precise user policies
  EXECUTE '
    CREATE POLICY user_memory_weekly_summaries_select_own
    ON public.user_memory_weekly_summaries
    FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);
  ';

  EXECUTE '
    CREATE POLICY user_memory_weekly_summaries_delete_own
    ON public.user_memory_weekly_summaries
    FOR DELETE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);
  ';

  -- Service role: full access for summary generation and management
  EXECUTE '
    CREATE POLICY user_memory_weekly_summaries_service_all
    ON public.user_memory_weekly_summaries
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
  ';

END $$;
