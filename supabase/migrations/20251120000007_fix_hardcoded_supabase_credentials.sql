-- Fix hardcoded Supabase URLs and service role keys in database functions
-- This migration replaces hardcoded credentials with environment variables

-- Function to get Supabase URL from settings
-- Falls back to constructing from project_ref if URL not set
CREATE OR REPLACE FUNCTION public.get_supabase_url()
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  url text;
  project_ref text;
BEGIN
  -- Try to get URL from app settings
  BEGIN
    url := current_setting('app.settings.supabase_url', true);
    IF url IS NOT NULL AND url != '' THEN
      RETURN url;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Fallback: construct from project_ref
  BEGIN
    project_ref := current_setting('app.settings.project_ref', true);
    IF project_ref IS NOT NULL AND project_ref != '' THEN
      RETURN 'https://' || project_ref || '.supabase.co';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Last resort: use environment variable (for local development)
  BEGIN
    url := current_setting('app.settings.supabase_url', true);
    RETURN COALESCE(url, '');
  EXCEPTION WHEN OTHERS THEN
    RETURN '';
  END;
END;
$$;

-- Function to get anon key from Supabase Vault
-- This should be set via: SELECT vault.create_secret('your-anon-key', 'anon_key');
CREATE OR REPLACE FUNCTION public.get_anon_key()
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  key text;
BEGIN
  -- Try to get from app settings first
  BEGIN
    key := current_setting('app.settings.anon_key', true);
    IF key IS NOT NULL AND key != '' THEN
      RETURN key;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Try to get from vault (recommended approach)
  BEGIN
    SELECT decrypted_secret INTO key
    FROM vault.decrypted_secrets
    WHERE name = 'anon_key'
    LIMIT 1;

    IF key IS NOT NULL AND key != '' THEN
      RETURN key;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Return empty string if not found (function will fail gracefully)
  RETURN '';
END;
$$;

-- Function to get service role key from Supabase Vault
-- This should be set via: SELECT vault.create_secret('your-service-role-key', 'service_role_key');
CREATE OR REPLACE FUNCTION public.get_service_role_key()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  key text;
BEGIN
  -- Try to get from app settings first
  BEGIN
    key := current_setting('app.settings.service_role_key', true);
    IF key IS NOT NULL AND key != '' THEN
      RETURN key;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Try to get from vault (recommended approach)
  BEGIN
    SELECT decrypted_secret INTO key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;
    
    IF key IS NOT NULL AND key != '' THEN
      RETURN key;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Return empty string if not found (function will fail gracefully)
  RETURN '';
END;
$$;

-- Note: The following functions are legacy and no longer in use:
-- - call_process_guest_report_pdf() - calls process-guest-report-pdf (legacy edge function)
-- - rpc_notify_orchestrator() - calls orchestrate-report-ready (legacy edge function)
-- These are left as-is to avoid breaking existing triggers. If you want to remove them entirely,
-- drop the functions and any triggers that use them.

-- Update intelligent_memory_buffer trigger function
-- Note: This function should use anon key, not service role key
CREATE OR REPLACE FUNCTION public.update_buffer_pending_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  new_count integer;
  conv_user_id uuid;
  supabase_url text;
  anon_key text;
  function_url text;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    -- Increment pending count and capture the updated value
    UPDATE conversation_activity
    SET 
      pending_buffer_count = pending_buffer_count + 1,
      updated_at = NOW()
    WHERE conversation_id = NEW.conversation_id
    RETURNING pending_buffer_count, user_id
    INTO new_count, conv_user_id;

    -- Auto-trigger processing when threshold reached
    IF new_count >= 5 THEN
      -- Get Supabase URL and anon key
      supabase_url := public.get_supabase_url();
      anon_key := public.get_anon_key();
      
      IF supabase_url = '' OR anon_key = '' THEN
        RAISE WARNING 'Supabase URL or anon key not configured. Skipping edge function call.';
        RETURN NEW;
      END IF;
      
      function_url := supabase_url || '/functions/v1/process-memory-buffer';
      
      PERFORM net.http_post(
        function_url,
        jsonb_build_object(
          'conversation_id', NEW.conversation_id,
          'user_id', conv_user_id,
          'trigger_reason', 'count_threshold'
        ),
        '{}'::jsonb, -- empty params
        jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || anon_key
        )
      );

      UPDATE conversation_activity
      SET buffer_processing_scheduled = true
      WHERE conversation_id = NEW.conversation_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_supabase_url() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_anon_key() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_service_role_key() TO service_role;

-- Add comment explaining configuration
COMMENT ON FUNCTION public.get_supabase_url() IS 
'Gets Supabase URL from app settings. Configure via: ALTER DATABASE postgres SET app.settings.supabase_url = ''https://api.therai.co'';';

COMMENT ON FUNCTION public.get_anon_key() IS
'Gets anon key from Supabase Vault. Configure via: SELECT vault.create_secret(''your-anon-key'', ''anon_key'')';

COMMENT ON FUNCTION public.get_service_role_key() IS 
'Gets service role key from Supabase Vault. Configure via: SELECT vault.create_secret(''your-service-role-key'', ''service_role_key'');';

