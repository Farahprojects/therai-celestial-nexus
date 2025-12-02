-- CRITICAL SECURITY FIX: Remove hardcoded JWT tokens from database functions
-- This migration updates functions that were created with hardcoded credentials
-- to use the secure credential functions instead
-- Note: Legacy functions call_process_guest_report_pdf and rpc_notify_orchestrator
-- have been dropped as they are no longer needed

-- Update the update_buffer_pending_count function from 20250214000000_intelligent_memory_buffer.sql
-- This function was using hardcoded anon key JWT token and needs to be updated to use secure credential retrieval
CREATE OR REPLACE FUNCTION public.update_buffer_pending_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  new_count integer;
  conv_user_id uuid;
  supabase_url text;
  anon_key text;
  function_url text;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    -- Increment pending count and capture the updated value
    UPDATE public.conversation_activity
    SET
      pending_buffer_count = pending_buffer_count + 1,
      updated_at = pg_catalog.now()
    WHERE conversation_id = NEW.conversation_id
    RETURNING pending_buffer_count, user_id
    INTO new_count, conv_user_id;

    -- Auto-trigger processing when threshold reached
    IF new_count >= 5 THEN
      -- Get Supabase URL and anon key securely
      supabase_url := public.get_supabase_url();
      anon_key := public.get_anon_key();

      IF supabase_url = '' OR anon_key = '' THEN
        RAISE WARNING 'Supabase URL or anon key not configured. Skipping edge function call.';
        RETURN NEW;
      END IF;

      function_url := supabase_url || '/functions/v1/process-memory-buffer';

      PERFORM net.http_post(
        function_url,
        pg_catalog.jsonb_build_object(
          'conversation_id', NEW.conversation_id,
          'user_id', conv_user_id,
          'trigger_reason', 'count_threshold'
        ),
        '{}'::jsonb, -- empty params
        pg_catalog.jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || anon_key
        )
      );

      UPDATE public.conversation_activity
      SET buffer_processing_scheduled = true
      WHERE conversation_id = NEW.conversation_id;

      RAISE LOG '[update_buffer_pending_count] Auto-triggered processing for conversation % (count: %)', NEW.conversation_id, new_count;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Add security comment
COMMENT ON FUNCTION public.update_buffer_pending_count() IS 'Secure version: Gets credentials from vault instead of hardcoded JWT tokens';
