-- VOICE_USAGE CONSOLIDATED POLICIES
-- Reference implementation for voice usage tracking policies
-- User isolation with service-only management

-- Safe policy cleanup and recreation for voice usage tracking
DO $$
BEGIN
  -- Voice usage: restrict the service policy to service_role only and keep a single user SELECT policy

  -- Drop the existing broad service/public policy
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Service role manages voice usage" ON public.voice_usage;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Create explicit service_role ALL policy
  EXECUTE '
    CREATE POLICY voice_usage_service_all ON public.voice_usage
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);
  ';

  -- Ensure single authenticated SELECT policy exists, re-create idempotently
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view own voice usage" ON public.voice_usage;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  EXECUTE '
    CREATE POLICY voice_usage_user_select ON public.voice_usage
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);
  ';

END $$;
