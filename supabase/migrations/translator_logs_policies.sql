-- TRANSLATOR_LOGS CONSOLIDATED POLICIES
-- Reference implementation for conversation-based access control
-- Translator logs accessible based on conversation ownership

-- Safe policy cleanup and recreation - CORRECTED VERSION
-- Removes unintended authenticated INSERT access, ensures service role only
DO $$
BEGIN
  -- Remove unintended policies that grant INSERT to authenticated users
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Service role can insert translator logs" ON public.translator_logs;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Service role can manage translator logs" ON public.translator_logs;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Clean up any other unintended policies
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Users can read their own translator logs" ON public.translator_logs;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Users can delete own translator logs" ON public.translator_logs;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS translator_logs_authenticated_select ON public.translator_logs;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS translator_logs_authenticated_delete ON public.translator_logs;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS translator_logs_authenticated_insert ON public.translator_logs;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Create conversation-based SELECT policy for authenticated users
  EXECUTE '
    CREATE POLICY translator_logs_authenticated_select
    ON public.translator_logs
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = public.translator_logs.chat_id
          AND c.user_id = (SELECT auth.uid())
      )
    );';

  -- IMPORTANT: No INSERT/UPDATE/DELETE policies for authenticated users
  -- Translator logs should be read-only for users, managed only by service role

  -- Re-create single explicit service_role policy only
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS translator_logs_service_all ON public.translator_logs;';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  EXECUTE '
    CREATE POLICY translator_logs_service_all
    ON public.translator_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
  ';

END $$;
