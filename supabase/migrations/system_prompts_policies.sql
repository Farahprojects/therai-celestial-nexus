-- SYSTEM_PROMPTS CONSOLIDATED POLICIES
-- Reference implementation for AI system prompts security
-- Service-exclusive access for Edge Functions and AI operations

-- Complete policy reset and service-only access for system prompts
DO $$
DECLARE
  p record;
BEGIN
  -- Ensure RLS is enabled for security
  EXECUTE 'ALTER TABLE public.system_prompts ENABLE ROW LEVEL SECURITY;';

  -- Drop all existing policies on the table (complete reset)
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'system_prompts'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.system_prompts;', p.policyname);
  END LOOP;

  -- Create a single allow-all policy for Edge Functions (service_role)
  EXECUTE '
    CREATE POLICY system_prompts_service_all ON public.system_prompts
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);
  ';

END $$;
