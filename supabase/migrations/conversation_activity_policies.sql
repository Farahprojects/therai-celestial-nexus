-- CONVERSATION_ACTIVITY CONSOLIDATED POLICIES
-- Reference implementation for conversation activity tracking
-- Service-exclusive access for operational analytics

-- Complete lockdown for conversation activity data
DO $$
DECLARE
  p record;
BEGIN
  -- Ensure RLS is enabled for security
  EXECUTE 'ALTER TABLE public.conversation_activity ENABLE ROW LEVEL SECURITY;';

  -- Drop specific user-facing policies if they exist
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'conversation_activity'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.conversation_activity;', p.policyname);
  END LOOP;

  -- Create a single allow-all policy for Edge Functions (service_role)
  EXECUTE '
    CREATE POLICY conversation_activity_service_all ON public.conversation_activity
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);
  ';

END $$;
