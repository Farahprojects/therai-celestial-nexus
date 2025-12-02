-- PASSWORD_RESET_TOKENS CONSOLIDATED POLICIES
-- Reference implementation for secure password reset token access
-- Public read access for verification, service-only management

-- Safe policy cleanup and recreation for security-sensitive table
DO $$
BEGIN
  -- Clean existing policies with exception handling
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS password_reset_tokens_select ON public.password_reset_tokens;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS password_reset_tokens_insert ON public.password_reset_tokens;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS password_reset_tokens_update ON public.password_reset_tokens;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS password_reset_tokens_delete ON public.password_reset_tokens;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Anon can read reset tokens" ON public.password_reset_tokens;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Users can read reset tokens" ON public.password_reset_tokens;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Public SELECT access for token verification
  -- Password reset flows require clients to verify tokens exist
  EXECUTE '
    CREATE POLICY password_reset_tokens_select
    ON public.password_reset_tokens
    FOR SELECT
    TO anon, authenticated
    USING (true);
  ';

  -- Service role: explicit full access for token management
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS password_reset_tokens_service_all ON public.password_reset_tokens;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  EXECUTE '
    CREATE POLICY password_reset_tokens_service_all
    ON public.password_reset_tokens
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
  ';

END $$;
