-- PLAN_LIMITS CONSOLIDATED POLICIES
-- Reference implementation for subscription plan limits
-- Public read access with service-only management

-- Safe policy cleanup and recreation for plan limits configuration
DO $$
BEGIN
  -- Drop existing conflicting policies if they exist
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Only admins can modify plan limits" ON public.plan_limits;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Plan limits are publicly readable" ON public.plan_limits;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Service role: full access for app; isolated from user planning
  EXECUTE '
    CREATE POLICY plan_limits_service_all ON public.plan_limits
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);
  ';

  -- Public read access (anon + authenticated)
  EXECUTE '
    CREATE POLICY plan_limits_public_read ON public.plan_limits
    FOR SELECT TO public
    USING (true);
  ';

END $$;
