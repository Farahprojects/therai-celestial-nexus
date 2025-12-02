-- CRITICAL SECURITY FIX: Remove hardcoded JWT tokens from database functions
-- This migration updates functions that were created with hardcoded credentials
-- to use the secure credential functions instead

-- Update the call_process_guest_report_pdf function from 20251028230808_remote_schema.sql
CREATE OR REPLACE FUNCTION public.call_process_guest_report_pdf(guest_report_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response jsonb;
  status_code int;
  error_msg text;
  supabase_url text;
  service_role_key text;
BEGIN
  -- Get credentials securely
  supabase_url := public.get_supabase_url();
  service_role_key := public.get_service_role_key();

  IF supabase_url = '' OR service_role_key = '' THEN
    RAISE WARNING 'Supabase URL or service role key not configured. Skipping edge function call.';
    RETURN jsonb_build_object('success', false, 'error', 'Configuration missing');
  END IF;

  -- Send the HTTP POST and capture the response
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/process-guest-report-pdf',
    body := jsonb_build_object('guest_report_id', guest_report_id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    )
  ) INTO response;

  -- Get the status code from the response
  status_code := (response ->> 'status')::int;

  -- Log success or failure
  IF status_code != 200 THEN
    error_msg := COALESCE(response ->> 'body', 'Unknown error');
    INSERT INTO debug_logs (source, message, label, details)
    VALUES ('call_process_guest_report_pdf', 'HTTP request failed', 'failure', jsonb_build_object(
      'guest_report_id', guest_report_id,
      'status_code', status_code,
      'error', error_msg
    ));
    RETURN jsonb_build_object('success', false, 'error', error_msg, 'status_code', status_code);
  ELSE
    INSERT INTO debug_logs (source, message, label, details)
    VALUES ('call_process_guest_report_pdf', 'HTTP request succeeded', 'success', jsonb_build_object(
      'guest_report_id', guest_report_id,
      'status_code', status_code
    ));
    RETURN jsonb_build_object('success', true, 'response', response);
  END IF;
END;
$$;

-- Update the rpc_notify_orchestrator function from 20251028230808_remote_schema.sql
CREATE OR REPLACE FUNCTION public.rpc_notify_orchestrator(guest_report_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response jsonb;
  status_code int;
  error_msg text;
  supabase_url text;
  service_role_key text;
BEGIN
  -- Get credentials securely
  supabase_url := public.get_supabase_url();
  service_role_key := public.get_service_role_key();

  IF supabase_url = '' OR service_role_key = '' THEN
    RAISE WARNING 'Supabase URL or service role key not configured. Skipping edge function call.';
    RETURN jsonb_build_object('success', false, 'error', 'Configuration missing');
  END IF;

  -- Send the HTTP POST and capture the response
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/orchestrate-report-ready',
    body := jsonb_build_object('guest_report_id', guest_report_id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    )
  ) INTO response;

  -- Get the status code from the response
  status_code := (response ->> 'status')::int;

  -- Log success or failure
  IF status_code != 200 THEN
    error_msg := COALESCE(response ->> 'body', 'Unknown error');
    INSERT INTO debug_logs (source, message, label, details)
    VALUES ('rpc_notify_orchestrator', 'HTTP request failed', 'failure', jsonb_build_object(
      'guest_report_id', guest_report_id,
      'status_code', status_code,
      'error', error_msg
    ));
    RETURN jsonb_build_object('success', false, 'error', error_msg, 'status_code', status_code);
  ELSE
    INSERT INTO debug_logs (source, message, label, details)
    VALUES ('rpc_notify_orchestrator', 'HTTP request succeeded', 'success', jsonb_build_object(
      'guest_report_id', guest_report_id,
      'status_code', status_code
    ));
    RETURN jsonb_build_object('success', true, 'response', response);
  END IF;
END;
$$;

-- Update the update_buffer_pending_count function from 20250214000000_intelligent_memory_buffer.sql
-- (Note: This was already partially updated in the fix migration, but ensuring it's using the new function)
CREATE OR REPLACE FUNCTION public.update_buffer_pending_count()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Update the call_process_guest_report_pdf function from 20251112030000_remote_schema.sql
-- (This appears to be a duplicate of the one from 20251028230808, but updating it too)
CREATE OR REPLACE FUNCTION public.call_process_guest_report_pdf(guest_report_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response jsonb;
  status_code int;
  error_msg text;
  supabase_url text;
  service_role_key text;
BEGIN
  -- Get credentials securely
  supabase_url := public.get_supabase_url();
  service_role_key := public.get_service_role_key();

  IF supabase_url = '' OR service_role_key = '' THEN
    RAISE WARNING 'Supabase URL or service role key not configured. Skipping edge function call.';
    RETURN jsonb_build_object('success', false, 'error', 'Configuration missing');
  END IF;

  -- Send the HTTP POST and capture the response
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/process-guest-report-pdf',
    body := jsonb_build_object('guest_report_id', guest_report_id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    )
  ) INTO response;

  -- Get the status code from the response
  status_code := (response ->> 'status')::int;

  -- Log success or failure
  IF status_code != 200 THEN
    error_msg := COALESCE(response ->> 'body', 'Unknown error');
    INSERT INTO debug_logs (source, message, label, details)
    VALUES ('call_process_guest_report_pdf', 'HTTP request failed', 'failure', jsonb_build_object(
      'guest_report_id', guest_report_id,
      'status_code', status_code,
      'error', error_msg
    ));
    RETURN jsonb_build_object('success', false, 'error', error_msg, 'status_code', status_code);
  ELSE
    INSERT INTO debug_logs (source, message, label, details)
    VALUES ('call_process_guest_report_pdf', 'HTTP request succeeded', 'success', jsonb_build_object(
      'guest_report_id', guest_report_id,
      'status_code', status_code
    ));
    RETURN jsonb_build_object('success', true, 'response', response);
  END IF;
END;
$$;

-- Update the rpc_notify_orchestrator function from 20251112030000_remote_schema.sql
CREATE OR REPLACE FUNCTION public.rpc_notify_orchestrator(guest_report_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response jsonb;
  status_code int;
  error_msg text;
  supabase_url text;
  service_role_key text;
BEGIN
  -- Get credentials securely
  supabase_url := public.get_supabase_url();
  service_role_key := public.get_service_role_key();

  IF supabase_url = '' OR service_role_key = '' THEN
    RAISE WARNING 'Supabase URL or service role key not configured. Skipping edge function call.';
    RETURN jsonb_build_object('success', false, 'error', 'Configuration missing');
  END IF;

  -- Send the HTTP POST and capture the response
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/orchestrate-report-ready',
    body := jsonb_build_object('guest_report_id', guest_report_id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    )
  ) INTO response;

  -- Get the status code from the response
  status_code := (response ->> 'status')::int;

  -- Log success or failure
  IF status_code != 200 THEN
    error_msg := COALESCE(response ->> 'body', 'Unknown error');
    INSERT INTO debug_logs (source, message, label, details)
    VALUES ('rpc_notify_orchestrator', 'HTTP request failed', 'failure', jsonb_build_object(
      'guest_report_id', guest_report_id,
      'status_code', status_code,
      'error', error_msg
    ));
    RETURN jsonb_build_object('success', false, 'error', error_msg, 'status_code', status_code);
  ELSE
    INSERT INTO debug_logs (source, message, label, details)
    VALUES ('rpc_notify_orchestrator', 'HTTP request succeeded', 'success', jsonb_build_object(
      'guest_report_id', guest_report_id,
      'status_code', status_code
    ));
    RETURN jsonb_build_object('success', true, 'response', response);
  END IF;
END;
$$;

-- Add security comments
COMMENT ON FUNCTION public.call_process_guest_report_pdf(UUID) IS 'Secure version: Gets credentials from vault instead of hardcoded tokens';
COMMENT ON FUNCTION public.rpc_notify_orchestrator(UUID) IS 'Secure version: Gets credentials from vault instead of hardcoded tokens';
COMMENT ON FUNCTION public.update_buffer_pending_count() IS 'Secure version: Gets credentials from vault instead of hardcoded tokens';
