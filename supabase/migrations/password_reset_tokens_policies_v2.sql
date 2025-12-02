-- PASSWORD_RESET_TOKENS CONSOLIDATED POLICIES v2
-- Reference implementation for secure password reset tokens
-- Service-exclusive access with backend verification

-- Complete lockdown for password reset tokens - backend verification only
DO $$
DECLARE
  p record;
BEGIN
  -- Ensure RLS is enabled for security
  EXECUTE 'ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;';

  -- Drop all existing policies on the table (complete reset)
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'password_reset_tokens'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.password_reset_tokens;', p.policyname);
  END LOOP;

  -- Create a single allow-all policy for Edge Functions (service_role)
  -- Token verification now handled in backend, not direct database access
  EXECUTE '
    CREATE POLICY password_reset_tokens_service_all ON public.password_reset_tokens
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);
  ';

END $$;
