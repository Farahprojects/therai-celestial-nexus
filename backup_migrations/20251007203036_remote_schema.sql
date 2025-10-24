

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'Guest functionality removed - auth-only system. guest_reports table dropped.';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "http" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."queue_status" AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed'
);


ALTER TYPE "public"."queue_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'admin',
    'user'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."call_process_guest_report_pdf"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  response json;
  status int;
  error_msg text;
begin
  begin
    select net.http_post(
      'https://wrvqqvqvwqmfdqvqmaar.supabase.co/functions/v1/process-guest-report-pdf',
      jsonb_build_object('guest_report_id', NEW.id),
      '{}'::jsonb, -- empty params
      '{
        "Content-Type": "application/json",
        "Authorization": "Bearer [SERVICE_ROLE_KEY]"
      }'::jsonb
    ) into response;

    status := (response ->> 'status')::int;

    if status != 200 then
      error_msg := coalesce(response ->> 'body', 'Unknown error');
      update guest_reports
      set report_pdf_status = 'error',
          report_pdf_error = error_msg
      where id = NEW.id;
    else
      update guest_reports
      set report_pdf_status = 'sent',
          report_pdf_error = null
      where id = NEW.id;
    end if;

  exception when others then
    update guest_reports
    set report_pdf_status = 'trigger_failed',
        report_pdf_error = SQLERRM
    where id = NEW.id;
  end;

  return NEW;
end;
$$;


ALTER FUNCTION "public"."call_process_guest_report_pdf"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_report_logs_constraints"() RETURNS TABLE("constraint_name" "text", "constraint_type" "text", "column_name" "text", "data_type" "text", "udt_name" "text", "is_nullable" "text", "column_default" "text", "constraint_definition" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    con.conname::text as constraint_name,
    CASE con.contype
      WHEN 'p' THEN 'PRIMARY KEY'
      WHEN 'f' THEN 'FOREIGN KEY'
      WHEN 'u' THEN 'UNIQUE'
      WHEN 'c' THEN 'CHECK'
      ELSE 'OTHER'
    END::text as constraint_type,
    cols.column_name::text,
    cols.data_type::text,
    cols.udt_name::text,
    cols.is_nullable::text,
    cols.column_default::text,
    pg_get_constraintdef(con.oid) as constraint_definition
  FROM pg_constraint con
  INNER JOIN pg_class rel ON rel.oid = con.conrelid
  INNER JOIN pg_namespace nsp ON nsp.oid = con.connamespace
  INNER JOIN information_schema.columns cols
    ON cols.table_name = rel.relname
    AND cols.column_name = ANY (con.conkey::int[]::text[])
    AND cols.table_schema = nsp.nspname
  WHERE rel.relname = 'report_logs'
    AND cols.column_name = 'user_id'
    AND nsp.nspname = 'public';
END;
$$;


ALTER FUNCTION "public"."check_report_logs_constraints"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_user_admin_role"("user_id_param" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = user_id_param AND role = 'admin'
  );
$$;


ALTER FUNCTION "public"."check_user_admin_role"("user_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clean_completed_topups"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM topup_queue
  WHERE status = 'completed'
    AND EXISTS (
      SELECT 1
      FROM topup_logs
      WHERE topup_logs.stripe_payment_intent_id = 
        regexp_replace(topup_queue.message, '^PI\s+', '')
    );
END;
$$;


ALTER FUNCTION "public"."clean_completed_topups"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_user_after_payment"("user_id" "uuid", "plan_type" "text" DEFAULT 'starter'::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  new_api_key TEXT;
  user_email TEXT;
  stripe_customer TEXT;
  api_call_limit INTEGER;
BEGIN
  -- Get the user's email from auth.users
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = user_id;

  IF user_email IS NULL THEN
    RAISE EXCEPTION 'No user found with ID %', user_id;
  END IF;

  -- Get the stripe_customer_id for this email
  SELECT stripe_customer_id INTO stripe_customer
  FROM public.stripe_users
  WHERE email = user_email;

  IF stripe_customer IS NULL THEN
    RAISE EXCEPTION 'No stripe customer found for email %', user_email;
  END IF;

  -- Set API call limit based on plan
  api_call_limit := CASE 
    WHEN plan_type = 'starter' THEN 50000
    WHEN plan_type = 'growth' THEN 200000
    WHEN plan_type = 'professional' THEN 750000
    ELSE 50000
  END;

  -- Generate API key
  new_api_key := generate_api_key();

  -- Insert into users table
  INSERT INTO public.users (
    id, 
    email,
    plan_type, 
    calls_limit, 
    calls_made,
    stripe_customer_id,
    status
  ) VALUES (
    user_id,
    user_email,
    plan_type,
    api_call_limit,
    0,
    stripe_customer,
    'active'
  )
  ON CONFLICT (id) DO UPDATE 
  SET 
    plan_type = EXCLUDED.plan_type,
    calls_limit = EXCLUDED.calls_limit,
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    status = EXCLUDED.status;
  
  -- Insert into app_users table
  INSERT INTO public.app_users (
    id, 
    stripe_customer_id,
    email,
    api_key,
    plan_name,
    api_calls_count,
    api_call_limit
  ) VALUES (
    user_id,
    stripe_customer,
    user_email,
    new_api_key,
    plan_type,
    0,
    api_call_limit
  )
  ON CONFLICT (id) DO UPDATE 
  SET 
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    plan_name = EXCLUDED.plan_name,
    api_call_limit = EXCLUDED.api_call_limit;

  -- Log successful creation
  RAISE NOTICE 'Successfully created user records for ID: %, Email: %, Plan: %', user_id, user_email, plan_type;
END;
$$;


ALTER FUNCTION "public"."create_user_after_payment"("user_id" "uuid", "plan_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."deactivate_old_payment_methods"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE payment_method
  SET active = FALSE,
      status_reason = 'replaced_by_user',
      status_changed_at = NOW()
  WHERE user_id = NEW.user_id
    AND active = TRUE
    AND id <> NEW.id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."deactivate_old_payment_methods"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_user_account"("user_id_to_delete" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Log the start of deletion process
  INSERT INTO admin_logs (page, event_type, user_id, logs, meta, created_at)
  VALUES (
    'delete_account', 
    'deletion_started', 
    user_id_to_delete, 
    'Starting user account deletion',
    jsonb_build_object(
      'user_id', user_id_to_delete,
      'timestamp', now()
    ),
    now()
  );

  -- Delete from user_preferences table
  DELETE FROM user_preferences WHERE user_id = user_id_to_delete;
  
  -- Delete from payment_method table
  DELETE FROM payment_method WHERE user_id = user_id_to_delete;
  
  -- Delete from profiles table
  DELETE FROM profiles WHERE id = user_id_to_delete;
  
  -- Delete from conversations table (will cascade to messages)
  DELETE FROM conversations WHERE user_id = user_id_to_delete;
  
  -- Delete from folders table (will cascade to conversation_folders)
  DELETE FROM folders WHERE user_id = user_id_to_delete;
  
  -- Delete from calendar_sessions table
  DELETE FROM calendar_sessions WHERE coach_id = user_id_to_delete;

  -- Log successful database cleanup
  INSERT INTO admin_logs (page, event_type, user_id, logs, meta, created_at)
  VALUES (
    'delete_account', 
    'database_cleanup_completed', 
    user_id_to_delete, 
    'Successfully deleted user data',
    jsonb_build_object(
      'user_id', user_id_to_delete,
      'timestamp', now()
    ),
    now()
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Log the database cleanup error
    INSERT INTO admin_logs (page, event_type, user_id, logs, meta, created_at)
    VALUES (
      'delete_account', 
      'database_cleanup_error', 
      user_id_to_delete, 
      'Error during database cleanup: ' || SQLERRM,
      jsonb_build_object(
        'user_id', user_id_to_delete,
        'error', SQLERRM,
        'timestamp', now()
      ),
      now()
    );
    
    -- Re-raise the exception
    RAISE;
END;
$$;


ALTER FUNCTION "public"."delete_user_account"("user_id_to_delete" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_profile_for_current_user"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  uid uuid := auth.uid();
  uemail text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get email from auth.users via existing helper
  uemail := public.get_user_email_by_id(uid);

  -- Create if missing; if exists, hydrate email if empty
  INSERT INTO public.profiles (id, email)
  VALUES (uid, COALESCE(uemail, ''))
  ON CONFLICT (id) DO UPDATE
    SET email = COALESCE(EXCLUDED.email, public.profiles.email);

END;
$$;


ALTER FUNCTION "public"."ensure_profile_for_current_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gen_random_bytes"(integer) RETURNS "bytea"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'extensions', 'pg_temp'
    AS $_$
  SELECT extensions.gen_random_bytes($1);
$_$;


ALTER FUNCTION "public"."gen_random_bytes"(integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_api_key"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN 'thp_' || encode(digest(gen_random_uuid()::text, 'sha256'), 'hex');
END;
$$;


ALTER FUNCTION "public"."generate_api_key"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_all_users_admin"() RETURNS TABLE("user_id" "uuid", "email" "text", "created_at" timestamp with time zone, "last_sign_in_at" timestamp with time zone, "email_confirmed_at" timestamp with time zone, "role" "text", "balance_usd" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.email,
    u.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at,
    COALESCE(ur.role::text, 'user') as role,
    COALESCE(uc.balance_usd, 0) as balance_usd
  FROM auth.users u
  LEFT JOIN public.user_roles ur ON u.id = ur.user_id
  LEFT JOIN public.user_credits uc ON u.id = uc.user_id
  ORDER BY u.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_all_users_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_flow_status"("user_email" "text") RETURNS TABLE("session_id" "text", "flow_state" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY 
    SELECT 
      f.session_id, 
      f.flow_state, 
      f.created_at,
      f.updated_at
    FROM public.stripe_flow_tracking f
    WHERE f.email = user_email
    ORDER BY f.created_at DESC
    LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_flow_status"("user_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_next_engine_sequence"() RETURNS bigint
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT nextval('engine_selector_seq');
$$;


ALTER FUNCTION "public"."get_next_engine_sequence"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_stripe_customer_id_for_user"("user_id_param" "uuid") RETURNS TABLE("stripe_customer_id" "text", "stripe_payment_method_id" "text")
    LANGUAGE "sql"
    AS $$
  SELECT stripe_customer_id, stripe_payment_method_id
  FROM public.credit_transactions
  WHERE user_id = user_id_param
    AND stripe_customer_id IS NOT NULL
    AND stripe_payment_method_id IS NOT NULL
  ORDER BY ts DESC
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_stripe_customer_id_for_user"("user_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_email_by_id"("user_id_param" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    user_email TEXT;
BEGIN
    -- Get email from auth.users table
    SELECT email INTO user_email
    FROM auth.users
    WHERE id = user_id_param;
    
    RETURN user_email;
END;
$$;


ALTER FUNCTION "public"."get_user_email_by_id"("user_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Create profiles row with display_name
  INSERT INTO public.profiles (
    id,
    email,
    email_verified,
    display_name,
    created_at,
    updated_at,
    last_seen_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN true ELSE false END,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)), -- Use display_name from meta or email prefix
    COALESCE(NEW.created_at, now()),
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    email_verified = EXCLUDED.email_verified,
    display_name = COALESCE(profiles.display_name, EXCLUDED.display_name), -- Keep existing display_name if set
    updated_at = now();

  -- Create user_preferences row
  INSERT INTO public.user_preferences (
    user_id,
    email_notifications_enabled,
    client_view_mode,
    tts_voice,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    true, -- Default to enabled
    'grid', -- Default view mode
    'Puck', -- Default voice
    now(),
    now()
  )
  ON CONFLICT (user_id) DO NOTHING; -- Don't update if already exists
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_role" "public"."user_role", "_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = _user_id AND role = _role
  );
$$;


ALTER FUNCTION "public"."has_role"("_role" "public"."user_role", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_promo_code_usage"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Only trigger when payment_status changes from 'pending' to 'paid' 
  -- and promo_code_used is not null
  IF OLD.payment_status = 'pending' 
     AND NEW.payment_status = 'paid' 
     AND NEW.promo_code_used IS NOT NULL THEN
    
    -- Atomically increment promo code usage with optimistic locking
    -- This prevents race conditions and ensures accurate counting
    UPDATE promo_codes 
    SET times_used = times_used + 1
    WHERE code = NEW.promo_code_used
      AND is_active = true
      AND (max_uses IS NULL OR times_used < max_uses);
    
    -- Log the promo code increment for debugging
    INSERT INTO debug_logs (source, message, details)
    VALUES (
      'increment_promo_code_usage_trigger',
      'Promo code usage incremented via database trigger',
      jsonb_build_object(
        'guest_report_id', NEW.id,
        'promo_code', NEW.promo_code_used,
        'payment_status_change', 'pending -> paid'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."increment_promo_code_usage"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_user_verified"("_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(
    (SELECT email_verified FROM public.profiles WHERE id = _user_id),
    false
  );
$$;


ALTER FUNCTION "public"."is_user_verified"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_modal_ready_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Log the modal_ready change for debugging
  INSERT INTO debug_logs(source, message, details)
  VALUES (
    'trg_notify', 
    'set modal_ready', 
    jsonb_build_object(
      'guest_report_id', NEW.id,
      'user_id', NEW.user_id,
      'old_modal_ready', OLD.modal_ready,
      'new_modal_ready', NEW.modal_ready,
      'timestamp', NOW()
    )
  );
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_modal_ready_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_profile_verified"("user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  confirmed_at timestamptz;
  effective_user uuid := user_id;
BEGIN
  IF effective_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Read from auth.users (allowed in SECURITY DEFINER)
  SELECT u.email_confirmed_at
  INTO confirmed_at
  FROM auth.users u
  WHERE u.id = effective_user;

  IF confirmed_at IS NOT NULL THEN
    UPDATE public.profiles
    SET email_verified = true,
        verification_status = 'verified',
        updated_at = now()
    WHERE id = effective_user;

    RETURN true;
  END IF;

  RETURN false;
END;
$$;


ALTER FUNCTION "public"."mark_profile_verified"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_notify_orchestrator"("guest_report_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  response json;
  status_code integer;
  error_msg text;
BEGIN
  BEGIN
    -- Send the HTTP POST and capture the response
    SELECT net.http_post(
      url := 'https://wrvqqvqvwqmfdqvqmaar.supabase.co/functions/v1/orchestrate-report-ready',
      body := jsonb_build_object('guest_report_id', guest_report_id),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndydnFxdnF2d3FtZmRxdnFtYWFyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTU4MDQ2MiwiZXhwIjoyMDYxMTU2NDYyfQ.lmtvouakq3-TxFH7nmUCpw9Gl5dO1ejyg76S3DBd82E'
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
    ELSE
      INSERT INTO debug_logs (source, message, label, details)
      VALUES ('rpc_notify_orchestrator', 'HTTP request successful', 'success', jsonb_build_object(
        'guest_report_id', guest_report_id,
        'status_code', status_code
      ));
    END IF;

  EXCEPTION WHEN OTHERS THEN
    INSERT INTO debug_logs (source, message, label, details)
    VALUES ('rpc_notify_orchestrator', 'Unhandled exception', 'error', jsonb_build_object(
      'guest_report_id', guest_report_id,
      'exception', SQLERRM
    ));
  END;
END;
$$;


ALTER FUNCTION "public"."rpc_notify_orchestrator"("guest_report_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_notification_email"("template_type" "text", "recipient_email" "text", "variables" "jsonb" DEFAULT '{}'::"jsonb") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  template_record RECORD;
BEGIN
  -- Get the template
  SELECT * INTO template_record
  FROM public.email_notification_templates
  WHERE template_type = template_type;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Email template % not found', template_type;
  END IF;
  
  -- In a real implementation, you would call an email sending service here
  -- For now, we'll just log the attempt
  INSERT INTO public.admin_logs 
    (page, event_type, logs, meta)
  VALUES 
    ('EmailSystem', 'send_notification', 
    'Email notification ' || template_type || ' queued for ' || recipient_email,
    jsonb_build_object(
      'template_type', template_type,
      'recipient', recipient_email,
      'variables', variables,
      'subject', template_record.subject
    ));
  
  -- In production, you would return true only if the email was actually sent
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."send_notification_email"("template_type" "text", "recipient_email" "text", "variables" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_has_report_flag"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF OLD.report_log_id IS NULL AND NEW.report_log_id IS NOT NULL THEN
    NEW.has_report = true;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_has_report_flag"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_report_error_flag"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Set has_error to true if error_message is not null and not empty
  IF NEW.error_message IS NOT NULL AND TRIM(NEW.error_message) != '' THEN
    NEW.has_error = true;
  ELSE
    NEW.has_error = false;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_report_error_flag"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_active_payment_method"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO public.active_payment_method (
    id,
    user_id,
    ts,
    stripe_pid,
    email,
    country,
    postal_code,
    card_last4,
    card_brand,
    stripe_customer_id,
    billing_name,
    billing_address_line1,
    billing_address_line2,
    city,
    state,
    payment_method_type,
    payment_status,
    stripe_payment_method_id,
    exp_month,
    exp_year,
    fingerprint,
    is_default
  )
  VALUES (
    NEW.id,
    NEW.user_id,
    NEW.ts,
    NEW.stripe_pid,
    NEW.email,
    NEW.country,
    NEW.postal_code,
    NEW.card_last4,
    NEW.card_brand,
    NEW.stripe_customer_id,
    NEW.billing_name,
    NEW.billing_address_line1,
    NEW.billing_address_line2,
    NEW.city,
    NEW.state,
    NEW.payment_method_type,
    NEW.payment_status,
    NEW.stripe_payment_method_id,
    NEW.exp_month,
    NEW.exp_year,
    NEW.fingerprint,
    NEW.is_default
  )
  ON CONFLICT (user_id) DO UPDATE SET
    id                     = EXCLUDED.id,
    ts                     = EXCLUDED.ts,
    stripe_pid             = EXCLUDED.stripe_pid,
    email                  = EXCLUDED.email,
    country                = EXCLUDED.country,
    postal_code            = EXCLUDED.postal_code,
    card_last4             = EXCLUDED.card_last4,
    card_brand             = EXCLUDED.card_brand,
    stripe_customer_id     = EXCLUDED.stripe_customer_id,
    billing_name           = EXCLUDED.billing_name,
    billing_address_line1  = EXCLUDED.billing_address_line1,
    billing_address_line2  = EXCLUDED.billing_address_line2,
    city                   = EXCLUDED.city,
    state                  = EXCLUDED.state,
    payment_method_type    = EXCLUDED.payment_method_type,
    payment_status         = EXCLUDED.payment_status,
    stripe_payment_method_id = EXCLUDED.stripe_payment_method_id,
    exp_month              = EXCLUDED.exp_month,
    exp_year               = EXCLUDED.exp_year,
    fingerprint            = EXCLUDED.fingerprint,
    is_default             = EXCLUDED.is_default;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_active_payment_method"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_user_verification_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Only update if there are actual changes, don't auto-verify
  IF OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at THEN
    UPDATE public.profiles
    SET 
      updated_at = now()
      -- Remove automatic verification logic
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.debug_logs (source, message, details)
  VALUES (
    'sync_user_verification_status',
    'Failed to sync verification status',
    jsonb_build_object(
      'error', SQLERRM,
      'auth_user_id', NEW.id
    )
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_user_verification_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_addon"("user_id_param" "uuid", "addon_name" "text", "enabled" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF addon_name = 'transits' THEN
    UPDATE public.users SET addon_transits = enabled WHERE id = user_id_param;
  ELSIF addon_name = 'relationship' THEN
    UPDATE public.users SET addon_relationship = enabled WHERE id = user_id_param;
  ELSIF addon_name = 'yearly_cycle' THEN
    UPDATE public.users SET addon_yearly_cycle = enabled WHERE id = user_id_param;
  END IF;
END;
$$;


ALTER FUNCTION "public"."toggle_addon"("user_id_param" "uuid", "addon_name" "text", "enabled" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;


ALTER FUNCTION "public"."touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_api_keys_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_api_keys_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_api_usage_costs"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  report_price NUMERIC(10,2);
  geo_price NUMERIC(10,2);
  core_price NUMERIC(10,2);
  report_tier_text TEXT;
  used_geo BOOLEAN;
BEGIN
  -- Fetch the full inserted row
  SELECT report_tier, used_geo_lookup, unit_price_usd
  INTO report_tier_text, used_geo, core_price
  FROM public.api_usage
  WHERE id = NEW.id;

  -- Look up report price (if report_tier is set)
  IF report_tier_text IS NOT NULL THEN
    SELECT unit_price_usd INTO report_price
    FROM public.price_list
    WHERE report_tier = report_tier_text;

    IF report_price IS NULL THEN
      report_price := 0;
    END IF;
  ELSE
    report_price := 0;
  END IF;

  -- Look up geo price if used_geo_lookup is true
  IF used_geo = TRUE THEN
    SELECT unit_price_usd INTO geo_price
    FROM public.price_list
    WHERE endpoint = 'geo_lookup';

    IF geo_price IS NULL THEN
      geo_price := 0;
    END IF;
  ELSE
    geo_price := 0;
  END IF;

  -- Update the inserted row
  UPDATE public.api_usage
  SET report_price_usd = report_price,
      geo_price_usd = geo_price,
      total_cost_usd = COALESCE(core_price, 0) + report_price + geo_price
  WHERE id = NEW.id;

  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_api_usage_costs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_coach_websites_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_coach_websites_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_email_templates_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_email_templates_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_geo_cache_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_geo_cache_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_landing_page_config_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_landing_page_config_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_message_block_summaries_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_message_block_summaries_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_modified_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_modified_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_service_purchases_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.payment_status = 'completed' AND OLD.payment_status != 'completed' THEN
    NEW.completed_at = now();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_service_purchases_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_stripe_flow_tracking_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_stripe_flow_tracking_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_token_emails_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_token_emails_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_profile_list_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_user_profile_list_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_voice_previews_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_voice_previews_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upgrade_plan"("user_id_param" "uuid", "new_plan" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  UPDATE public.users 
  SET 
    plan_type = new_plan,
    calls_limit = CASE 
      WHEN new_plan = 'starter' THEN 50000
      WHEN new_plan = 'growth' THEN 200000
      WHEN new_plan = 'professional' THEN 750000
    END
  WHERE id = user_id_param;
END;
$$;


ALTER FUNCTION "public"."upgrade_plan"("user_id_param" "uuid", "new_plan" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_owns_insight"("report_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.insights
        WHERE insights.id = report_id
        AND insights.user_id = auth.uid()
    );
END;
$$;


ALTER FUNCTION "public"."user_owns_insight"("report_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "page" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "logs" "text",
    "meta" "jsonb",
    "user_id" "uuid"
);


ALTER TABLE "public"."admin_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."api_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "translator_log_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "report_tier" "text",
    "used_geo_lookup" boolean DEFAULT false,
    "unit_price_usd" numeric(6,2) NOT NULL,
    "total_cost_usd" numeric(6,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "report_price_usd" numeric(10,2) DEFAULT 0,
    "geo_price_usd" numeric(10,2) DEFAULT 0,
    "request_params" "jsonb"
);


ALTER TABLE "public"."api_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blog_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "content" "text" NOT NULL,
    "cover_image_url" "text",
    "author_name" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "published" boolean DEFAULT true,
    "like_count" integer DEFAULT 0,
    "share_count" integer DEFAULT 0
);


ALTER TABLE "public"."blog_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calendar_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "event_type" "text" DEFAULT 'session'::"text",
    "color_tag" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."calendar_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "meta" "jsonb" DEFAULT '{}'::"jsonb",
    "is_public" boolean DEFAULT false,
    "share_token" "text",
    "share_mode" "text" DEFAULT 'view_only'::"text",
    "owner_user_id" "uuid"
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


COMMENT ON COLUMN "public"."conversations"."share_mode" IS 'Sharing mode: view_only or join_conversation';



CREATE TABLE IF NOT EXISTS "public"."conversations_participants" (
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "invited_by" "uuid",
    CONSTRAINT "conversations_participants_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."conversations_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_method" (
    "id" bigint NOT NULL,
    "user_id" "uuid",
    "ts" timestamp with time zone DEFAULT "now"(),
    "stripe_pid" "text",
    "email" "text",
    "country" "text",
    "postal_code" "text",
    "card_last4" "text",
    "card_brand" "text",
    "stripe_customer_id" "text",
    "billing_name" "text",
    "billing_address_line1" "text",
    "billing_address_line2" "text",
    "city" "text",
    "state" "text",
    "payment_method_type" "text",
    "payment_status" "text",
    "stripe_payment_method_id" "text",
    "exp_month" smallint,
    "exp_year" smallint,
    "fingerprint" "text",
    "active" boolean DEFAULT true,
    "status_reason" "text",
    "status_changed_at" timestamp with time zone,
    "last_charge_at" timestamp with time zone,
    "last_charge_status" "text",
    "last_invoice_id" "text",
    "last_invoice_number" "text",
    "last_invoice_amount_cents" integer,
    "last_invoice_currency" "text" DEFAULT 'usd'::"text",
    "last_receipt_url" "text",
    "next_billing_at" timestamp with time zone,
    "invoice_history" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL
);


ALTER TABLE "public"."payment_method" OWNER TO "postgres";


COMMENT ON COLUMN "public"."payment_method"."last_charge_at" IS 'Timestamp of the most recent successful or attempted charge tied to the active subscription';



COMMENT ON COLUMN "public"."payment_method"."last_charge_status" IS 'Status of the last charge (e.g., succeeded, failed, requires_payment_method)';



COMMENT ON COLUMN "public"."payment_method"."last_invoice_id" IS 'Stripe invoice ID of the last charge (if available)';



COMMENT ON COLUMN "public"."payment_method"."last_invoice_number" IS 'Human-friendly invoice number (if available)';



COMMENT ON COLUMN "public"."payment_method"."last_invoice_amount_cents" IS 'Amount of the last charge in cents';



COMMENT ON COLUMN "public"."payment_method"."last_invoice_currency" IS 'Currency of the last charge';



COMMENT ON COLUMN "public"."payment_method"."last_receipt_url" IS 'Receipt URL for the last charge (if available)';



COMMENT ON COLUMN "public"."payment_method"."next_billing_at" IS 'Next scheduled billing date for the active subscription';



COMMENT ON COLUMN "public"."payment_method"."invoice_history" IS 'Array of compact invoice entries for display in the Billing UI';



CREATE SEQUENCE IF NOT EXISTS "public"."credit_transactions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."credit_transactions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."credit_transactions_id_seq" OWNED BY "public"."payment_method"."id";



CREATE TABLE IF NOT EXISTS "public"."debug_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source" "text",
    "message" "text",
    "user_id" "text",
    "inserted_at" timestamp with time zone DEFAULT "now"(),
    "label" "text",
    "details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."debug_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."domain_slugs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "domain" "text" NOT NULL,
    "info" boolean DEFAULT false,
    "media" boolean DEFAULT false,
    "billing" boolean DEFAULT false,
    "support" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "noreply" boolean DEFAULT false,
    "hello" boolean DEFAULT false,
    "contact" boolean DEFAULT false,
    "help" boolean DEFAULT false,
    "marketing" boolean DEFAULT false,
    "admin" boolean DEFAULT false,
    "legal" boolean DEFAULT false,
    "hr" boolean DEFAULT false,
    "dev" boolean DEFAULT false
);


ALTER TABLE "public"."domain_slugs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "from_address" "text" NOT NULL,
    "to_address" "text" NOT NULL,
    "direction" "text" NOT NULL,
    "subject" "text",
    "body" "text",
    "sent_via" "text" DEFAULT 'email'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "raw_headers" "text",
    "is_starred" boolean DEFAULT false NOT NULL,
    "is_archived" boolean DEFAULT false NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "attachments" "jsonb" DEFAULT '[]'::"jsonb",
    "attachment_count" integer DEFAULT 0,
    "has_attachments" boolean DEFAULT false,
    CONSTRAINT "email_messages_direction_check" CHECK (("direction" = ANY (ARRAY['inbound'::"text", 'outbound'::"text"])))
);


ALTER TABLE "public"."email_messages" OWNER TO "postgres";


COMMENT ON COLUMN "public"."email_messages"."is_starred" IS 'Indicates if the email is starred by the user';



COMMENT ON COLUMN "public"."email_messages"."is_archived" IS 'Indicates if the email is archived (hidden from main view)';



COMMENT ON COLUMN "public"."email_messages"."is_read" IS 'Indicates if the email is read or unread for UI purposes';



CREATE TABLE IF NOT EXISTS "public"."email_notification_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_type" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "body_html" "text" NOT NULL,
    "body_text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."email_notification_templates" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."engine_selector_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."engine_selector_seq" OWNER TO "postgres";


COMMENT ON SEQUENCE "public"."engine_selector_seq" IS 'Used for atomic round-robin selection of AI report engines';



CREATE TABLE IF NOT EXISTS "public"."geo_cache" (
    "lat" double precision NOT NULL,
    "lon" double precision NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "place_id" "text" NOT NULL,
    "place" "text"
);


ALTER TABLE "public"."geo_cache" OWNER TO "postgres";


COMMENT ON TABLE "public"."geo_cache" IS 'Caches Google Place Details API responses using place_id as the key to reduce expensive API calls';



CREATE TABLE IF NOT EXISTS "public"."insights" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "report_type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "is_ready" boolean DEFAULT false,
    CONSTRAINT "insights_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"])))
);

ALTER TABLE ONLY "public"."insights" REPLICA IDENTITY FULL;


ALTER TABLE "public"."insights" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ip_allowlist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ip_address" "text" NOT NULL,
    "description" "text",
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone
);


ALTER TABLE "public"."ip_allowlist" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."journal_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "title" "text",
    "entry_text" "text" NOT NULL,
    "tags" "text"[],
    "linked_report_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."journal_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."landing_page_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "feature_images" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "features_images" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."landing_page_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."legal_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "version" "text" NOT NULL,
    "published_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_current" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."legal_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_block_summaries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chat_id" "uuid" NOT NULL,
    "block_index" integer NOT NULL,
    "summary" "text" NOT NULL,
    "message_count" integer DEFAULT 0 NOT NULL,
    "start_message_id" "uuid",
    "end_message_id" "uuid",
    "model" "text",
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "message_block_summaries_block_index_check" CHECK (("block_index" >= 0))
);


ALTER TABLE "public"."message_block_summaries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chat_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "text" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "client_msg_id" "uuid",
    "reply_to_id" "uuid",
    "status" "text" DEFAULT 'complete'::"text",
    "model" "text",
    "token_count" integer,
    "latency_ms" integer,
    "error" "jsonb" DEFAULT '{}'::"jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "context_injected" boolean DEFAULT false,
    "message_number" integer DEFAULT 1 NOT NULL,
    "mode" "text" DEFAULT 'chat'::"text",
    "user_id" "uuid",
    "user_name" "text",
    CONSTRAINT "messages_mode_check" CHECK (("mode" = ANY (ARRAY['chat'::"text", 'astro'::"text"]))),
    CONSTRAINT "messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text", 'system'::"text"]))),
    CONSTRAINT "messages_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'streaming'::"text", 'complete'::"text", 'failed'::"text"])))
);

ALTER TABLE ONLY "public"."messages" REPLICA IDENTITY FULL;


ALTER TABLE "public"."messages" OWNER TO "postgres";


COMMENT ON COLUMN "public"."messages"."mode" IS 'Chat mode when this message was sent (chat, astro, etc.)';



CREATE TABLE IF NOT EXISTS "public"."password_reset_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token_hash" "text" NOT NULL,
    "email" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."password_reset_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."price_list" (
    "id" "text" NOT NULL,
    "endpoint" "text",
    "report_type" "text",
    "name" "text" NOT NULL,
    "description" "text",
    "unit_price_usd" numeric(6,2) NOT NULL,
    "created_at" timestamp with time zone,
    "product_code" "text",
    "is_ai" "text"
);


ALTER TABLE "public"."price_list" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "email_verified" boolean DEFAULT false,
    "subscription_plan" "text" DEFAULT 'free'::"text",
    "subscription_status" "text" DEFAULT 'inactive'::"text",
    "stripe_customer_id" "text",
    "features" "jsonb" DEFAULT '{}'::"jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "last_seen_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "subscription_active" boolean DEFAULT false,
    "subscription_start_date" timestamp with time zone,
    "subscription_next_charge" timestamp with time zone,
    "stripe_subscription_id" "text",
    "last_payment_status" "text",
    "last_invoice_id" "text",
    "verification_token" "text",
    "has_profile_setup" boolean DEFAULT false NOT NULL,
    "display_name" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."verification_token" IS 'Custom email verification token generated during signup';



COMMENT ON COLUMN "public"."profiles"."display_name" IS 'User-friendly display name for the profile';



CREATE TABLE IF NOT EXISTS "public"."promo_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "discount_percent" integer NOT NULL,
    "is_active" boolean DEFAULT true,
    "max_uses" integer,
    "times_used" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "promo_codes_discount_percent_check" CHECK ((("discount_percent" >= 0) AND ("discount_percent" <= 100)))
);


ALTER TABLE "public"."promo_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."report_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "report_type" "text",
    "endpoint" "text",
    "report_text" "text",
    "status" "text" DEFAULT 'failed'::"text",
    "duration_ms" integer,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "engine_used" "text",
    "has_error" boolean DEFAULT false NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "is_guest" boolean DEFAULT false,
    "chat_id" "uuid"
);

ALTER TABLE ONLY "public"."report_logs" REPLICA IDENTITY FULL;


ALTER TABLE "public"."report_logs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."report_logs"."metadata" IS 'AI generation metrics including duration_ms and token_count';



COMMENT ON COLUMN "public"."report_logs"."chat_id" IS 'Context ID: can be conversation_id (astro mode), user_id (profile flow), report_id (insights), or guest_report_id (guest flow)';



CREATE TABLE IF NOT EXISTS "public"."report_prompts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "system_prompt" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."report_prompts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stripe_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "product_id" "text" NOT NULL,
    "price_id" "text" NOT NULL,
    "amount_usd" numeric(10,2) NOT NULL,
    "currency" "text" DEFAULT 'usd'::"text",
    "type" "text" DEFAULT 'one_time'::"text",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stripe_products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stripe_webhook_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stripe_event_id" "text" NOT NULL,
    "stripe_event_type" "text" NOT NULL,
    "stripe_kind" "text" NOT NULL,
    "stripe_customer_id" "text",
    "payload" "jsonb" NOT NULL,
    "processed" boolean DEFAULT false NOT NULL,
    "processing_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone
);


ALTER TABLE "public"."stripe_webhook_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."swissdebuglogs" (
    "id" integer NOT NULL,
    "api_key" "text",
    "user_id" "uuid",
    "balance_usd" numeric,
    "request_type" "text",
    "request_payload" "jsonb",
    "response_status" integer,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."swissdebuglogs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."swissdebuglogs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."swissdebuglogs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."swissdebuglogs_id_seq" OWNED BY "public"."swissdebuglogs"."id";



CREATE TABLE IF NOT EXISTS "public"."temp_audio" (
    "chat_id" "text" NOT NULL,
    "audio_data" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."temp_audio" REPLICA IDENTITY FULL;


ALTER TABLE "public"."temp_audio" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."temp_report_data" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "report_content" "text",
    "swiss_data" "jsonb",
    "metadata" "jsonb",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "expires_at" timestamp without time zone DEFAULT ("now"() + '72:00:00'::interval),
    "token_hash" "text",
    "chat_hash" "text",
    "guest_report_id" "uuid",
    "plain_token" "text",
    "swiss_data_saved" boolean DEFAULT false,
    "swiss_data_save_pending" boolean DEFAULT false,
    "swiss_data_save_attempts" integer DEFAULT 0,
    "last_save_attempt_at" timestamp without time zone
);


ALTER TABLE "public"."temp_report_data" OWNER TO "postgres";


COMMENT ON TABLE "public"."temp_report_data" IS 'Swiss data will now be enriched and saved directly from the frontend via save-swiss-data edge function';



COMMENT ON COLUMN "public"."temp_report_data"."swiss_data_saved" IS 'Tracks if enriched Swiss data has been successfully saved via edge function';



COMMENT ON COLUMN "public"."temp_report_data"."swiss_data_save_pending" IS 'Indicates if a save operation is currently in progress';



COMMENT ON COLUMN "public"."temp_report_data"."swiss_data_save_attempts" IS 'Number of times saving has been attempted';



COMMENT ON COLUMN "public"."temp_report_data"."last_save_attempt_at" IS 'Timestamp of the last save attempt';



CREATE TABLE IF NOT EXISTS "public"."token_emails" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_type" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "body_html" "text" NOT NULL,
    "body_text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."token_emails" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."topup_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "stripe_payment_intent_id" "text",
    "amount_cents" integer NOT NULL,
    "status" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "credited" boolean DEFAULT false,
    "receipt_url" "text",
    CONSTRAINT "topup_logs_status_check" CHECK (("status" = 'completed'::"text"))
);


ALTER TABLE "public"."topup_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."topup_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "amount_usd" numeric(10,2) NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"(),
    "processed_at" timestamp with time zone,
    "status" "text" DEFAULT 'pending'::"text",
    "message" "text",
    CONSTRAINT "topup_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'failed'::"text", 'succeeded'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."topup_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."translator_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_type" "text",
    "request_payload" "jsonb",
    "response_status" integer,
    "processing_time_ms" integer,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "google_geo" boolean DEFAULT false,
    "report_tier" "text",
    "chat_id" "uuid",
    "is_archived" boolean DEFAULT false NOT NULL,
    "translator_payload" "jsonb",
    "is_guest" boolean DEFAULT false NOT NULL,
    "swiss_data" "jsonb",
    "swiss_error" boolean DEFAULT false
);


ALTER TABLE "public"."translator_logs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."translator_logs"."google_geo" IS 'Flag indicating if Google Geocoding API was used';



COMMENT ON COLUMN "public"."translator_logs"."chat_id" IS 'Context ID: can be conversation_id (astro mode), user_id (profile flow), or report_id (insights)';



CREATE TABLE IF NOT EXISTS "public"."user_credits" (
    "user_id" "uuid" NOT NULL,
    "balance_usd" numeric(10,2) DEFAULT 0 NOT NULL,
    "last_updated" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_credits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_errors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "guest_report_id" "uuid",
    "email" "text" NOT NULL,
    "error_type" "text" DEFAULT 'report_not_found'::"text" NOT NULL,
    "price_paid" numeric,
    "error_message" "text",
    "case_number" "text" DEFAULT ('CASE_'::"text" || "upper"("substring"(("gen_random_uuid"())::"text", 1, 8))) NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved" boolean DEFAULT false NOT NULL,
    "resolved_at" timestamp with time zone
);


ALTER TABLE "public"."user_errors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email_notifications_enabled" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "client_view_mode" "text" DEFAULT 'grid'::"text",
    "tts_voice" "text" DEFAULT 'Puck'::"text",
    CONSTRAINT "user_preferences_client_view_mode_check" CHECK (("client_view_mode" = ANY (ARRAY['grid'::"text", 'list'::"text"])))
);

ALTER TABLE ONLY "public"."user_preferences" REPLICA IDENTITY FULL;


ALTER TABLE "public"."user_preferences" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_preferences"."client_view_mode" IS 'User preferred view mode for clients page (grid or list)';



COMMENT ON COLUMN "public"."user_preferences"."tts_voice" IS 'User selected TTS voice name (e.g., Puck, Achernar, etc.)';



CREATE TABLE IF NOT EXISTS "public"."user_profile_list" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "profile_name" "text" NOT NULL,
    "name" "text" NOT NULL,
    "birth_date" "text" NOT NULL,
    "birth_time" "text" NOT NULL,
    "birth_location" "text" NOT NULL,
    "birth_latitude" double precision,
    "birth_longitude" double precision,
    "birth_place_id" "text",
    "timezone" "text",
    "house_system" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_profile_list" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_profile_list" IS 'Stores saved birth data profiles for quick reuse in forms. Each person (primary or secondary) gets their own row.';



COMMENT ON COLUMN "public"."user_profile_list"."profile_name" IS 'User-friendly name for this saved profile';



COMMENT ON COLUMN "public"."user_profile_list"."name" IS 'Person''s actual name';



COMMENT ON COLUMN "public"."user_profile_list"."birth_date" IS 'Birth date in YYYY-MM-DD format';



COMMENT ON COLUMN "public"."user_profile_list"."birth_time" IS 'Birth time in HH:MM format';



COMMENT ON COLUMN "public"."user_profile_list"."birth_location" IS 'Full location name as entered by user';



COMMENT ON COLUMN "public"."user_profile_list"."birth_place_id" IS 'Google Places API place_id for precise location matching';



CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."user_role" DEFAULT 'user'::"public"."user_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."website_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "preview_image_url" "text",
    "template_data" "jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."website_templates" OWNER TO "postgres";


ALTER TABLE ONLY "public"."payment_method" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."credit_transactions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."swissdebuglogs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."swissdebuglogs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."admin_logs"
    ADD CONSTRAINT "admin_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."api_usage"
    ADD CONSTRAINT "api_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."calendar_sessions"
    ADD CONSTRAINT "calendar_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations_participants"
    ADD CONSTRAINT "conversations_participants_pkey" PRIMARY KEY ("conversation_id", "user_id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_share_token_key" UNIQUE ("share_token");



ALTER TABLE ONLY "public"."payment_method"
    ADD CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."debug_logs"
    ADD CONSTRAINT "debug_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."domain_slugs"
    ADD CONSTRAINT "domain_slugs_domain_key" UNIQUE ("domain");



ALTER TABLE ONLY "public"."domain_slugs"
    ADD CONSTRAINT "domain_slugs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_messages"
    ADD CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_notification_templates"
    ADD CONSTRAINT "email_notification_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_notification_templates"
    ADD CONSTRAINT "email_notification_templates_template_type_key" UNIQUE ("template_type");



ALTER TABLE ONLY "public"."geo_cache"
    ADD CONSTRAINT "geo_cache_pkey" PRIMARY KEY ("place_id");



ALTER TABLE ONLY "public"."insights"
    ADD CONSTRAINT "insights_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ip_allowlist"
    ADD CONSTRAINT "ip_allowlist_ip_address_key" UNIQUE ("ip_address");



ALTER TABLE ONLY "public"."ip_allowlist"
    ADD CONSTRAINT "ip_allowlist_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."landing_page_config"
    ADD CONSTRAINT "landing_page_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."legal_documents"
    ADD CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_block_summaries"
    ADD CONSTRAINT "message_block_summaries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."price_list"
    ADD CONSTRAINT "price_list_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_unique" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promo_codes"
    ADD CONSTRAINT "promo_codes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."promo_codes"
    ADD CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."report_logs"
    ADD CONSTRAINT "report_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."report_prompts"
    ADD CONSTRAINT "report_prompts_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."report_prompts"
    ADD CONSTRAINT "report_prompts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_products"
    ADD CONSTRAINT "stripe_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_webhook_events"
    ADD CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_webhook_events"
    ADD CONSTRAINT "stripe_webhook_events_stripe_event_id_key" UNIQUE ("stripe_event_id");



ALTER TABLE ONLY "public"."swissdebuglogs"
    ADD CONSTRAINT "swissdebuglogs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."temp_audio"
    ADD CONSTRAINT "temp_audio_pkey" PRIMARY KEY ("chat_id");



ALTER TABLE ONLY "public"."temp_report_data"
    ADD CONSTRAINT "temp_report_data_chat_hash_key" UNIQUE ("chat_hash");



ALTER TABLE ONLY "public"."temp_report_data"
    ADD CONSTRAINT "temp_report_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."token_emails"
    ADD CONSTRAINT "token_emails_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."token_emails"
    ADD CONSTRAINT "token_emails_template_type_key" UNIQUE ("template_type");



ALTER TABLE ONLY "public"."topup_logs"
    ADD CONSTRAINT "topup_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."topup_logs"
    ADD CONSTRAINT "topup_logs_stripe_payment_intent_id_unique" UNIQUE ("stripe_payment_intent_id");



ALTER TABLE ONLY "public"."topup_queue"
    ADD CONSTRAINT "topup_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."translator_logs"
    ADD CONSTRAINT "translator_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_block_summaries"
    ADD CONSTRAINT "unique_chat_block" UNIQUE ("chat_id", "block_index");



ALTER TABLE ONLY "public"."user_credits"
    ADD CONSTRAINT "user_credits_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_errors"
    ADD CONSTRAINT "user_errors_guest_report_id_key" UNIQUE ("guest_report_id");



ALTER TABLE ONLY "public"."user_errors"
    ADD CONSTRAINT "user_errors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_profile_list"
    ADD CONSTRAINT "user_profile_list_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");



ALTER TABLE ONLY "public"."website_templates"
    ADD CONSTRAINT "website_templates_pkey" PRIMARY KEY ("id");



CREATE INDEX "credit_transactions_email_idx" ON "public"."payment_method" USING "btree" ("email");



CREATE INDEX "credit_transactions_stripe_customer_id_idx" ON "public"."payment_method" USING "btree" ("stripe_customer_id");



CREATE INDEX "credit_transactions_user_ts_idx" ON "public"."payment_method" USING "btree" ("user_id", "ts" DESC);



CREATE INDEX "idx_conversations_created_at" ON "public"."conversations" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_conversations_id" ON "public"."conversations" USING "btree" ("id");



CREATE INDEX "idx_conversations_participants_conversation_id" ON "public"."conversations_participants" USING "btree" ("conversation_id");



CREATE INDEX "idx_conversations_participants_user_id" ON "public"."conversations_participants" USING "btree" ("user_id");



CREATE INDEX "idx_conversations_user_id" ON "public"."conversations" USING "btree" ("user_id");



CREATE INDEX "idx_insights_created_at" ON "public"."insights" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_insights_is_ready" ON "public"."insights" USING "btree" ("is_ready");



CREATE INDEX "idx_insights_status" ON "public"."insights" USING "btree" ("status");



CREATE INDEX "idx_insights_user_id" ON "public"."insights" USING "btree" ("user_id");



CREATE INDEX "idx_ip_allowlist_expires_at" ON "public"."ip_allowlist" USING "btree" ("expires_at");



CREATE INDEX "idx_journal_entries_client_id" ON "public"."journal_entries" USING "btree" ("client_id");



CREATE INDEX "idx_journal_entries_coach_id" ON "public"."journal_entries" USING "btree" ("coach_id");



CREATE INDEX "idx_message_block_summaries_chat_block" ON "public"."message_block_summaries" USING "btree" ("chat_id", "block_index");



CREATE INDEX "idx_messages_chat_id_created_at" ON "public"."messages" USING "btree" ("chat_id", "created_at");



CREATE INDEX "idx_messages_chat_id_message_number" ON "public"."messages" USING "btree" ("chat_id", "message_number");



CREATE INDEX "idx_messages_chat_id_mode" ON "public"."messages" USING "btree" ("chat_id", "mode");



CREATE INDEX "idx_messages_chat_id_role" ON "public"."messages" USING "btree" ("chat_id", "role");



CREATE INDEX "idx_messages_chat_recent_complete" ON "public"."messages" USING "btree" ("chat_id", "created_at" DESC) WHERE (("status" = 'complete'::"text") AND ("text" IS NOT NULL) AND ("length"("text") > 0));



CREATE INDEX "idx_messages_context_injected" ON "public"."messages" USING "btree" ("chat_id", "context_injected") WHERE ("context_injected" = true);



CREATE INDEX "idx_messages_mode" ON "public"."messages" USING "btree" ("mode");



CREATE INDEX "idx_messages_status" ON "public"."messages" USING "btree" ("status");



CREATE INDEX "idx_password_reset_tokens_expires_at" ON "public"."password_reset_tokens" USING "btree" ("expires_at");



CREATE INDEX "idx_password_reset_tokens_token_hash" ON "public"."password_reset_tokens" USING "btree" ("token_hash");



CREATE INDEX "idx_payment_method_user_active" ON "public"."payment_method" USING "btree" ("user_id", "active");



CREATE INDEX "idx_profiles_email" ON "public"."profiles" USING "btree" ("email");



CREATE INDEX "idx_profiles_has_profile_setup" ON "public"."profiles" USING "btree" ("has_profile_setup");



CREATE INDEX "idx_profiles_stripe_customer_id" ON "public"."profiles" USING "btree" ("stripe_customer_id");



CREATE INDEX "idx_profiles_stripe_subscription_id" ON "public"."profiles" USING "btree" ("stripe_subscription_id");



CREATE INDEX "idx_profiles_subscription_next_charge" ON "public"."profiles" USING "btree" ("subscription_next_charge");



CREATE INDEX "idx_profiles_verification_token" ON "public"."profiles" USING "btree" ("verification_token") WHERE ("verification_token" IS NOT NULL);



CREATE INDEX "idx_report_logs_chat_id" ON "public"."report_logs" USING "btree" ("chat_id");



CREATE INDEX "idx_report_logs_created_at" ON "public"."report_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_report_prompts_name" ON "public"."report_prompts" USING "btree" ("name");



CREATE INDEX "idx_stripe_webhook_events_created_at" ON "public"."stripe_webhook_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_stripe_webhook_events_processed" ON "public"."stripe_webhook_events" USING "btree" ("processed", "created_at" DESC);



CREATE INDEX "idx_swe_customer" ON "public"."stripe_webhook_events" USING "btree" ("stripe_customer_id");



CREATE INDEX "idx_swe_kind_date" ON "public"."stripe_webhook_events" USING "btree" ("stripe_kind", "created_at" DESC);



CREATE INDEX "idx_swe_processed" ON "public"."stripe_webhook_events" USING "btree" ("processed") WHERE ("processed" = false);



CREATE INDEX "idx_temp_audio_chat_id" ON "public"."temp_audio" USING "btree" ("chat_id");



CREATE INDEX "idx_temp_audio_chat_id_created_at" ON "public"."temp_audio" USING "btree" ("chat_id", "created_at" DESC);



CREATE INDEX "idx_temp_audio_created_at" ON "public"."temp_audio" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_translator_logs_chat_id" ON "public"."translator_logs" USING "btree" ("chat_id");



CREATE INDEX "idx_user_errors_case_number" ON "public"."user_errors" USING "btree" ("case_number");



CREATE INDEX "idx_user_errors_created_at" ON "public"."user_errors" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_user_errors_email" ON "public"."user_errors" USING "btree" ("email");



CREATE INDEX "idx_user_profile_list_user_id" ON "public"."user_profile_list" USING "btree" ("user_id");



CREATE UNIQUE INDEX "messages_client_msg_id_key" ON "public"."messages" USING "btree" ("client_msg_id");



CREATE UNIQUE INDEX "messages_one_streaming_assistant_per_chat" ON "public"."messages" USING "btree" ("chat_id") WHERE (("role" = 'assistant'::"text") AND ("status" = 'streaming'::"text"));



CREATE INDEX "translator_logs_created_at_idx" ON "public"."translator_logs" USING "btree" ("created_at");



CREATE INDEX "translator_logs_request_type_idx" ON "public"."translator_logs" USING "btree" ("request_type");



CREATE INDEX "translator_logs_user_id_idx" ON "public"."translator_logs" USING "btree" ("chat_id");



CREATE OR REPLACE TRIGGER "set_messages_updated_at" BEFORE UPDATE ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_deactivate_old_methods" AFTER INSERT ON "public"."payment_method" FOR EACH ROW EXECUTE FUNCTION "public"."deactivate_old_payment_methods"();



CREATE OR REPLACE TRIGGER "trg_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_update_api_usage_costs" AFTER INSERT OR UPDATE OF "report_tier", "used_geo_lookup" ON "public"."api_usage" FOR EACH ROW EXECUTE FUNCTION "public"."update_api_usage_costs"();



CREATE OR REPLACE TRIGGER "update_conversations_updated_at" BEFORE UPDATE ON "public"."conversations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_email_templates_updated_at" BEFORE UPDATE ON "public"."email_notification_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_email_templates_updated_at"();



CREATE OR REPLACE TRIGGER "update_geo_cache_updated_at" BEFORE UPDATE ON "public"."geo_cache" FOR EACH ROW EXECUTE FUNCTION "public"."update_geo_cache_updated_at"();



CREATE OR REPLACE TRIGGER "update_journal_entries_updated_at" BEFORE UPDATE ON "public"."journal_entries" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_landing_page_config_updated_at" BEFORE UPDATE ON "public"."landing_page_config" FOR EACH ROW EXECUTE FUNCTION "public"."update_landing_page_config_updated_at"();



CREATE OR REPLACE TRIGGER "update_message_block_summaries_updated_at" BEFORE UPDATE ON "public"."message_block_summaries" FOR EACH ROW EXECUTE FUNCTION "public"."update_message_block_summaries_updated_at"();



CREATE OR REPLACE TRIGGER "update_token_emails_updated_at" BEFORE UPDATE ON "public"."token_emails" FOR EACH ROW EXECUTE FUNCTION "public"."update_token_emails_updated_at"();



CREATE OR REPLACE TRIGGER "update_user_preferences_timestamp" BEFORE UPDATE ON "public"."user_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_timestamp"();



CREATE OR REPLACE TRIGGER "update_user_profile_list_updated_at_trigger" BEFORE UPDATE ON "public"."user_profile_list" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_profile_list_updated_at"();



ALTER TABLE ONLY "public"."api_usage"
    ADD CONSTRAINT "api_usage_translator_log_id_fkey" FOREIGN KEY ("translator_log_id") REFERENCES "public"."translator_logs"("id");



ALTER TABLE ONLY "public"."api_usage"
    ADD CONSTRAINT "api_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."conversations_participants"
    ADD CONSTRAINT "conversations_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations_participants"
    ADD CONSTRAINT "conversations_participants_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."conversations_participants"
    ADD CONSTRAINT "conversations_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_method"
    ADD CONSTRAINT "credit_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_sessions"
    ADD CONSTRAINT "fk_coach_id" FOREIGN KEY ("coach_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."insights"
    ADD CONSTRAINT "insights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fk_auth_users" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."topup_queue"
    ADD CONSTRAINT "topup_queue_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_credits"
    ADD CONSTRAINT "user_credits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profile_list"
    ADD CONSTRAINT "user_profile_list_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admin can manage ip_allowlist" ON "public"."ip_allowlist" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Admins can delete roles" ON "public"."user_roles" FOR DELETE USING ("public"."check_user_admin_role"("auth"."uid"()));



CREATE POLICY "Admins can insert roles" ON "public"."user_roles" FOR INSERT WITH CHECK ("public"."check_user_admin_role"("auth"."uid"()));



CREATE POLICY "Admins can manage all email messages" ON "public"."email_messages" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can read all roles" ON "public"."user_roles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "user_roles_1"
  WHERE (("user_roles_1"."user_id" = "auth"."uid"()) AND ("user_roles_1"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can update roles" ON "public"."user_roles" FOR UPDATE USING ("public"."check_user_admin_role"("auth"."uid"()));



CREATE POLICY "Admins can view all roles" ON "public"."user_roles" FOR SELECT USING ("public"."check_user_admin_role"("auth"."uid"()));



CREATE POLICY "Allow all users to view email templates" ON "public"."email_notification_templates" FOR SELECT USING (true);



CREATE POLICY "Allow anonymous users to insert error logs" ON "public"."user_errors" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public read access to geo_cache" ON "public"."geo_cache" FOR SELECT USING (true);



CREATE POLICY "Allow service role on blog_posts" ON "public"."blog_posts" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow service role only" ON "public"."report_prompts" TO "service_role" USING (true);



CREATE POLICY "Allow service role to insert/update geo_cache" ON "public"."geo_cache" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Allow service role to read email templates" ON "public"."token_emails" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "Allow service role to update geo_cache" ON "public"."geo_cache" FOR UPDATE TO "service_role" USING (true);



CREATE POLICY "Allow superusers to modify legal documents" ON "public"."legal_documents" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Anyone can view landing page config" ON "public"."landing_page_config" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can insert landing page config" ON "public"."landing_page_config" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can read domain_slugs" ON "public"."domain_slugs" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update landing page config" ON "public"."landing_page_config" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update their own profile" ON "public"."profiles" FOR UPDATE USING ((("auth"."uid"() = "id") AND ("auth"."role"() = 'authenticated'::"text"))) WITH CHECK ((("auth"."uid"() = "id") AND ("auth"."role"() = 'authenticated'::"text")));



CREATE POLICY "Authenticated users can view all roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view their own profile" ON "public"."profiles" FOR SELECT USING ((("auth"."uid"() = "id") AND ("auth"."role"() = 'authenticated'::"text")));



CREATE POLICY "Authenticated users can view user errors" ON "public"."user_errors" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Coach can access own clients' journal entries" ON "public"."journal_entries" FOR SELECT USING (("coach_id" = ("current_setting"('request.coach_id'::"text", true))::"uuid"));



CREATE POLICY "Coach can delete own sessions" ON "public"."calendar_sessions" FOR DELETE USING (("coach_id" = "auth"."uid"()));



CREATE POLICY "Coach can insert sessions" ON "public"."calendar_sessions" FOR INSERT WITH CHECK (("coach_id" = "auth"."uid"()));



CREATE POLICY "Coach can update sessions" ON "public"."calendar_sessions" FOR UPDATE USING (("coach_id" = "auth"."uid"()));



CREATE POLICY "Coach can view own sessions" ON "public"."calendar_sessions" FOR SELECT USING (("coach_id" = "auth"."uid"()));



CREATE POLICY "Coaches can create their own journal entries" ON "public"."journal_entries" FOR INSERT WITH CHECK (("auth"."uid"() = "coach_id"));



CREATE POLICY "Coaches can delete their own journal entries" ON "public"."journal_entries" FOR DELETE USING (("auth"."uid"() = "coach_id"));



CREATE POLICY "Coaches can update their own journal entries" ON "public"."journal_entries" FOR UPDATE USING (("auth"."uid"() = "coach_id"));



CREATE POLICY "Coaches can view their own journal entries" ON "public"."journal_entries" FOR SELECT USING (("auth"."uid"() = "coach_id"));



CREATE POLICY "Conversations owner create" ON "public"."conversations" FOR INSERT TO "authenticated" WITH CHECK (("owner_user_id" = "auth"."uid"()));



CREATE POLICY "Conversations owner delete" ON "public"."conversations" FOR DELETE TO "authenticated" USING (("owner_user_id" = "auth"."uid"()));



CREATE POLICY "Conversations owner write" ON "public"."conversations" FOR UPDATE TO "authenticated" USING (("owner_user_id" = "auth"."uid"())) WITH CHECK (("owner_user_id" = "auth"."uid"()));



CREATE POLICY "Conversations participant view" ON "public"."conversations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."conversations_participants" "p"
  WHERE (("p"."conversation_id" = "conversations"."id") AND ("p"."user_id" = "auth"."uid"())))));



CREATE POLICY "Conversations public view" ON "public"."conversations" FOR SELECT USING (("is_public" = true));



CREATE POLICY "Everyone can view active products" ON "public"."stripe_products" FOR SELECT USING (("active" = true));



CREATE POLICY "Only admins can manage roles" ON "public"."user_roles" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "user_roles_1"
  WHERE (("user_roles_1"."user_id" = "auth"."uid"()) AND ("user_roles_1"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Only service role can access admin_logs" ON "public"."admin_logs" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Participants can insert messages" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."conversations_participants" "p"
  WHERE (("p"."conversation_id" = "messages"."chat_id") AND ("p"."user_id" = "auth"."uid"())))));



CREATE POLICY "Participants can view messages" ON "public"."messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."conversations_participants" "p"
  WHERE (("p"."conversation_id" = "messages"."chat_id") AND ("p"."user_id" = "auth"."uid"())))));



CREATE POLICY "Public can read current legal documents" ON "public"."legal_documents" FOR SELECT USING (("is_current" = true));



CREATE POLICY "Public can read price list" ON "public"."price_list" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public can view active templates" ON "public"."website_templates" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Public can view messages in public conversations" ON "public"."messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."chat_id") AND ("c"."is_public" = true)))));



CREATE POLICY "Public can view published posts" ON "public"."blog_posts" FOR SELECT USING (("published" = true));



CREATE POLICY "Public can view shared conversations" ON "public"."conversations" FOR SELECT USING (("is_public" = true));



CREATE POLICY "Service role can manage all email messages" ON "public"."email_messages" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage domain_slugs" ON "public"."domain_slugs" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage password reset tokens" ON "public"."password_reset_tokens" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage roles" ON "public"."user_roles" TO "service_role" USING (true);



CREATE POLICY "Service role can manage translator logs" ON "public"."translator_logs" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage user errors" ON "public"."user_errors" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role manages conversations" ON "public"."conversations" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Users can access own report logs" ON "public"."report_logs" USING (("chat_id" = "auth"."uid"()));



CREATE POLICY "Users can create own conversations" ON "public"."conversations" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create own insights" ON "public"."insights" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own preferences" ON "public"."user_preferences" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own conversations" ON "public"."conversations" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own insights" ON "public"."insights" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own report logs" ON "public"."report_logs" FOR DELETE USING ("public"."user_owns_insight"("chat_id"));



CREATE POLICY "Users can delete own translator logs" ON "public"."translator_logs" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."insights"
  WHERE (("insights"."id" = "translator_logs"."chat_id") AND ("insights"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete their own payment methods" ON "public"."payment_method" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own profiles" ON "public"."user_profile_list" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own profiles" ON "public"."user_profile_list" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can join conversations" ON "public"."conversations_participants" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can leave conversations" ON "public"."conversations_participants" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read their own preferences" ON "public"."user_preferences" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read their own roles" ON "public"."user_roles" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read their own tokens" ON "public"."password_reset_tokens" FOR SELECT USING (("auth"."email"() = "email"));



CREATE POLICY "Users can update own conversations" ON "public"."conversations" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own insights" ON "public"."insights" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own payment methods" ON "public"."payment_method" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own preferences" ON "public"."user_preferences" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profiles" ON "public"."user_profile_list" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own conversations" ON "public"."conversations" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own insights" ON "public"."insights" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view participants" ON "public"."conversations_participants" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view their own credit balance" ON "public"."user_credits" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own profiles" ON "public"."user_profile_list" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own roles" ON "public"."user_roles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own transactions" ON "public"."payment_method" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view website templates" ON "public"."website_templates" FOR SELECT TO "authenticated" USING (("is_active" = true));



ALTER TABLE "public"."admin_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."api_usage" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "auth_read_own_conversation_summaries" ON "public"."message_block_summaries" FOR SELECT TO "authenticated" USING (("chat_id" IN ( SELECT "c"."id"
   FROM "public"."conversations" "c"
  WHERE ("c"."user_id" = "auth"."uid"()))));



CREATE POLICY "authenticated_users_insert_messages" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK (("chat_id" IN ( SELECT "conversations"."id"
   FROM "public"."conversations"
  WHERE ("conversations"."user_id" = "auth"."uid"()))));



CREATE POLICY "authenticated_users_read_messages" ON "public"."messages" FOR SELECT TO "authenticated" USING (("chat_id" IN ( SELECT "conversations"."id"
   FROM "public"."conversations"
  WHERE ("conversations"."user_id" = "auth"."uid"()))));



CREATE POLICY "authenticated_users_update_messages" ON "public"."messages" FOR UPDATE TO "authenticated" USING (("chat_id" IN ( SELECT "conversations"."id"
   FROM "public"."conversations"
  WHERE ("conversations"."user_id" = "auth"."uid"())))) WITH CHECK (("chat_id" IN ( SELECT "conversations"."id"
   FROM "public"."conversations"
  WHERE ("conversations"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."blog_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."calendar_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."debug_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."domain_slugs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_notification_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."geo_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."insights" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ip_allowlist" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."journal_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."landing_page_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."legal_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."message_block_summaries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."password_reset_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_method" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."price_list" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_service_role_all" ON "public"."profiles" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."promo_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."report_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."report_prompts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_all_credit_transactions" ON "public"."payment_method" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_all_stripe_products" ON "public"."stripe_products" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_all_topup_queue" ON "public"."topup_queue" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_all_user_credits" ON "public"."user_credits" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_all_webhook_events" ON "public"."stripe_webhook_events" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_role_can_insert_report_logs" ON "public"."report_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "service_role_can_update_report_logs" ON "public"."report_logs" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "service_role_insert" ON "public"."api_usage" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "service_role_insert" ON "public"."debug_logs" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "service_role_insert" ON "public"."promo_codes" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "service_role_insert" ON "public"."swissdebuglogs" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "service_role_insert" ON "public"."temp_report_data" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "service_role_insert" ON "public"."topup_logs" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "service_role_manage_message_block_summaries" ON "public"."message_block_summaries" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_role_manage_messages" ON "public"."messages" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_role_manage_stripe_webhook_events" ON "public"."stripe_webhook_events" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_role_manage_temp_audio" ON "public"."temp_audio" USING (true);



CREATE POLICY "service_role_select" ON "public"."api_usage" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "service_role_select" ON "public"."debug_logs" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "service_role_select" ON "public"."promo_codes" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "service_role_select" ON "public"."swissdebuglogs" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "service_role_select" ON "public"."temp_report_data" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "service_role_select" ON "public"."topup_logs" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "service_role_update" ON "public"."api_usage" FOR UPDATE TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_update" ON "public"."debug_logs" FOR UPDATE TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_update" ON "public"."promo_codes" FOR UPDATE TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_update" ON "public"."swissdebuglogs" FOR UPDATE TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_update" ON "public"."temp_report_data" FOR UPDATE TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_update" ON "public"."topup_logs" FOR UPDATE TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."stripe_products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stripe_webhook_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."swissdebuglogs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."temp_audio" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."temp_report_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."token_emails" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."topup_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."topup_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."translator_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_credits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_errors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profile_list" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."website_templates" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."insights";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."messages";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



































































































































































































GRANT ALL ON FUNCTION "public"."bytea_to_text"("data" "bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."bytea_to_text"("data" "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."bytea_to_text"("data" "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bytea_to_text"("data" "bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."call_process_guest_report_pdf"() TO "anon";
GRANT ALL ON FUNCTION "public"."call_process_guest_report_pdf"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."call_process_guest_report_pdf"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_report_logs_constraints"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_report_logs_constraints"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_report_logs_constraints"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_user_admin_role"("user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_user_admin_role"("user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_user_admin_role"("user_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."clean_completed_topups"() TO "anon";
GRANT ALL ON FUNCTION "public"."clean_completed_topups"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."clean_completed_topups"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_user_after_payment"("user_id" "uuid", "plan_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_user_after_payment"("user_id" "uuid", "plan_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_after_payment"("user_id" "uuid", "plan_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."deactivate_old_payment_methods"() TO "anon";
GRANT ALL ON FUNCTION "public"."deactivate_old_payment_methods"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."deactivate_old_payment_methods"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_user_account"("user_id_to_delete" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_user_account"("user_id_to_delete" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_user_account"("user_id_to_delete" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_profile_for_current_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_profile_for_current_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_profile_for_current_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."gen_random_bytes"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."gen_random_bytes"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."gen_random_bytes"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_api_key"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_api_key"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_api_key"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_all_users_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_all_users_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_all_users_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_flow_status"("user_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_flow_status"("user_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_flow_status"("user_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_next_engine_sequence"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_next_engine_sequence"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_next_engine_sequence"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_stripe_customer_id_for_user"("user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_stripe_customer_id_for_user"("user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_stripe_customer_id_for_user"("user_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_email_by_id"("user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_email_by_id"("user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_email_by_id"("user_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("_role" "public"."user_role", "_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_role" "public"."user_role", "_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_role" "public"."user_role", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."http"("request" "public"."http_request") TO "postgres";
GRANT ALL ON FUNCTION "public"."http"("request" "public"."http_request") TO "anon";
GRANT ALL ON FUNCTION "public"."http"("request" "public"."http_request") TO "authenticated";
GRANT ALL ON FUNCTION "public"."http"("request" "public"."http_request") TO "service_role";



GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying, "content" character varying, "content_type" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying, "content" character varying, "content_type" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying, "content" character varying, "content_type" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying, "content" character varying, "content_type" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying, "data" "jsonb") TO "postgres";
GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying, "data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying, "data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying, "data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."http_head"("uri" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_head"("uri" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_head"("uri" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_head"("uri" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_header"("field" character varying, "value" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_header"("field" character varying, "value" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_header"("field" character varying, "value" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_header"("field" character varying, "value" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_list_curlopt"() TO "postgres";
GRANT ALL ON FUNCTION "public"."http_list_curlopt"() TO "anon";
GRANT ALL ON FUNCTION "public"."http_list_curlopt"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_list_curlopt"() TO "service_role";



GRANT ALL ON FUNCTION "public"."http_patch"("uri" character varying, "content" character varying, "content_type" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_patch"("uri" character varying, "content" character varying, "content_type" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_patch"("uri" character varying, "content" character varying, "content_type" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_patch"("uri" character varying, "content" character varying, "content_type" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "data" "jsonb") TO "postgres";
GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "content" character varying, "content_type" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "content" character varying, "content_type" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "content" character varying, "content_type" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "content" character varying, "content_type" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_put"("uri" character varying, "content" character varying, "content_type" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_put"("uri" character varying, "content" character varying, "content_type" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_put"("uri" character varying, "content" character varying, "content_type" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_put"("uri" character varying, "content" character varying, "content_type" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_reset_curlopt"() TO "postgres";
GRANT ALL ON FUNCTION "public"."http_reset_curlopt"() TO "anon";
GRANT ALL ON FUNCTION "public"."http_reset_curlopt"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_reset_curlopt"() TO "service_role";



GRANT ALL ON FUNCTION "public"."http_set_curlopt"("curlopt" character varying, "value" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_set_curlopt"("curlopt" character varying, "value" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_set_curlopt"("curlopt" character varying, "value" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_set_curlopt"("curlopt" character varying, "value" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_promo_code_usage"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_promo_code_usage"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_promo_code_usage"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_user_verified"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_user_verified"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_user_verified"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_modal_ready_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_modal_ready_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_modal_ready_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_profile_verified"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_profile_verified"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_profile_verified"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_notify_orchestrator"("guest_report_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_notify_orchestrator"("guest_report_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_notify_orchestrator"("guest_report_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."send_notification_email"("template_type" "text", "recipient_email" "text", "variables" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."send_notification_email"("template_type" "text", "recipient_email" "text", "variables" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_notification_email"("template_type" "text", "recipient_email" "text", "variables" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_has_report_flag"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_has_report_flag"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_has_report_flag"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_report_error_flag"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_report_error_flag"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_report_error_flag"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_active_payment_method"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_active_payment_method"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_active_payment_method"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_user_verification_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_user_verification_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_user_verification_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."text_to_bytea"("data" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."text_to_bytea"("data" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."text_to_bytea"("data" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."text_to_bytea"("data" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_addon"("user_id_param" "uuid", "addon_name" "text", "enabled" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_addon"("user_id_param" "uuid", "addon_name" "text", "enabled" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_addon"("user_id_param" "uuid", "addon_name" "text", "enabled" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_api_keys_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_api_keys_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_api_keys_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_api_usage_costs"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_api_usage_costs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_api_usage_costs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_coach_websites_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_coach_websites_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_coach_websites_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_email_templates_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_email_templates_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_email_templates_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_geo_cache_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_geo_cache_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_geo_cache_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_landing_page_config_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_landing_page_config_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_landing_page_config_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_message_block_summaries_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_message_block_summaries_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_message_block_summaries_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_service_purchases_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_service_purchases_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_service_purchases_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_stripe_flow_tracking_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_stripe_flow_tracking_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_stripe_flow_tracking_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_token_emails_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_token_emails_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_token_emails_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_profile_list_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_profile_list_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_profile_list_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_voice_previews_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_voice_previews_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_voice_previews_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."upgrade_plan"("user_id_param" "uuid", "new_plan" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."upgrade_plan"("user_id_param" "uuid", "new_plan" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upgrade_plan"("user_id_param" "uuid", "new_plan" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."urlencode"("string" "bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."urlencode"("string" "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."urlencode"("string" "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."urlencode"("string" "bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."urlencode"("data" "jsonb") TO "postgres";
GRANT ALL ON FUNCTION "public"."urlencode"("data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."urlencode"("data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."urlencode"("data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."urlencode"("string" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."urlencode"("string" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."urlencode"("string" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."urlencode"("string" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."user_owns_insight"("report_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_owns_insight"("report_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_owns_insight"("report_id" "uuid") TO "service_role";
























GRANT ALL ON TABLE "public"."admin_logs" TO "anon";
GRANT ALL ON TABLE "public"."admin_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_logs" TO "service_role";



GRANT ALL ON TABLE "public"."api_usage" TO "anon";
GRANT ALL ON TABLE "public"."api_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."api_usage" TO "service_role";



GRANT ALL ON TABLE "public"."blog_posts" TO "anon";
GRANT ALL ON TABLE "public"."blog_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."blog_posts" TO "service_role";



GRANT ALL ON TABLE "public"."calendar_sessions" TO "anon";
GRANT ALL ON TABLE "public"."calendar_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."conversations_participants" TO "anon";
GRANT ALL ON TABLE "public"."conversations_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations_participants" TO "service_role";



GRANT ALL ON TABLE "public"."payment_method" TO "anon";
GRANT ALL ON TABLE "public"."payment_method" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_method" TO "service_role";



GRANT ALL ON SEQUENCE "public"."credit_transactions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."credit_transactions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."credit_transactions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."debug_logs" TO "anon";
GRANT ALL ON TABLE "public"."debug_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."debug_logs" TO "service_role";



GRANT ALL ON TABLE "public"."domain_slugs" TO "anon";
GRANT ALL ON TABLE "public"."domain_slugs" TO "authenticated";
GRANT ALL ON TABLE "public"."domain_slugs" TO "service_role";



GRANT ALL ON TABLE "public"."email_messages" TO "anon";
GRANT ALL ON TABLE "public"."email_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."email_messages" TO "service_role";



GRANT ALL ON TABLE "public"."email_notification_templates" TO "anon";
GRANT ALL ON TABLE "public"."email_notification_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."email_notification_templates" TO "service_role";



GRANT ALL ON SEQUENCE "public"."engine_selector_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."engine_selector_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."engine_selector_seq" TO "service_role";



GRANT ALL ON TABLE "public"."geo_cache" TO "anon";
GRANT ALL ON TABLE "public"."geo_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."geo_cache" TO "service_role";



GRANT ALL ON TABLE "public"."insights" TO "anon";
GRANT ALL ON TABLE "public"."insights" TO "authenticated";
GRANT ALL ON TABLE "public"."insights" TO "service_role";



GRANT ALL ON TABLE "public"."ip_allowlist" TO "anon";
GRANT ALL ON TABLE "public"."ip_allowlist" TO "authenticated";
GRANT ALL ON TABLE "public"."ip_allowlist" TO "service_role";



GRANT ALL ON TABLE "public"."journal_entries" TO "anon";
GRANT ALL ON TABLE "public"."journal_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."journal_entries" TO "service_role";



GRANT ALL ON TABLE "public"."landing_page_config" TO "anon";
GRANT ALL ON TABLE "public"."landing_page_config" TO "authenticated";
GRANT ALL ON TABLE "public"."landing_page_config" TO "service_role";



GRANT ALL ON TABLE "public"."legal_documents" TO "anon";
GRANT ALL ON TABLE "public"."legal_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."legal_documents" TO "service_role";



GRANT ALL ON TABLE "public"."message_block_summaries" TO "anon";
GRANT ALL ON TABLE "public"."message_block_summaries" TO "authenticated";
GRANT ALL ON TABLE "public"."message_block_summaries" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."messages" TO "anon";



GRANT ALL ON TABLE "public"."password_reset_tokens" TO "anon";
GRANT ALL ON TABLE "public"."password_reset_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."password_reset_tokens" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE ON TABLE "public"."price_list" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE ON TABLE "public"."price_list" TO "authenticated";
GRANT ALL ON TABLE "public"."price_list" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."promo_codes" TO "anon";
GRANT ALL ON TABLE "public"."promo_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."promo_codes" TO "service_role";



GRANT ALL ON TABLE "public"."report_logs" TO "anon";
GRANT ALL ON TABLE "public"."report_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."report_logs" TO "service_role";



GRANT ALL ON TABLE "public"."report_prompts" TO "anon";
GRANT ALL ON TABLE "public"."report_prompts" TO "authenticated";
GRANT ALL ON TABLE "public"."report_prompts" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_products" TO "anon";
GRANT ALL ON TABLE "public"."stripe_products" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_products" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_webhook_events" TO "anon";
GRANT ALL ON TABLE "public"."stripe_webhook_events" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_webhook_events" TO "service_role";



GRANT ALL ON TABLE "public"."swissdebuglogs" TO "anon";
GRANT ALL ON TABLE "public"."swissdebuglogs" TO "authenticated";
GRANT ALL ON TABLE "public"."swissdebuglogs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."swissdebuglogs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."swissdebuglogs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."swissdebuglogs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."temp_audio" TO "anon";
GRANT ALL ON TABLE "public"."temp_audio" TO "authenticated";
GRANT ALL ON TABLE "public"."temp_audio" TO "service_role";



GRANT ALL ON TABLE "public"."temp_report_data" TO "anon";
GRANT ALL ON TABLE "public"."temp_report_data" TO "authenticated";
GRANT ALL ON TABLE "public"."temp_report_data" TO "service_role";



GRANT ALL ON TABLE "public"."token_emails" TO "anon";
GRANT ALL ON TABLE "public"."token_emails" TO "authenticated";
GRANT ALL ON TABLE "public"."token_emails" TO "service_role";



GRANT ALL ON TABLE "public"."topup_logs" TO "anon";
GRANT ALL ON TABLE "public"."topup_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."topup_logs" TO "service_role";



GRANT ALL ON TABLE "public"."topup_queue" TO "anon";
GRANT ALL ON TABLE "public"."topup_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."topup_queue" TO "service_role";



GRANT ALL ON TABLE "public"."translator_logs" TO "anon";
GRANT ALL ON TABLE "public"."translator_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."translator_logs" TO "service_role";



GRANT ALL ON TABLE "public"."user_credits" TO "anon";
GRANT ALL ON TABLE "public"."user_credits" TO "authenticated";
GRANT ALL ON TABLE "public"."user_credits" TO "service_role";



GRANT ALL ON TABLE "public"."user_errors" TO "anon";
GRANT ALL ON TABLE "public"."user_errors" TO "authenticated";
GRANT ALL ON TABLE "public"."user_errors" TO "service_role";



GRANT ALL ON TABLE "public"."user_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."user_profile_list" TO "anon";
GRANT ALL ON TABLE "public"."user_profile_list" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profile_list" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."website_templates" TO "anon";
GRANT ALL ON TABLE "public"."website_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."website_templates" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
CREATE TRIGGER on_auth_user_created AFTER INSERT OR UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER on_auth_user_email_verified AFTER UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION sync_user_verification_status();


  create policy "Authenticated users can delete feature images"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'feature-images'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Authenticated users can update feature images"
  on "storage"."objects"
  as permissive
  for update
  to public
using (((bucket_id = 'feature-images'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Authenticated users can upload feature images"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'feature-images'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Public Access"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'feature-images'::text));


CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();

CREATE TRIGGER objects_delete_delete_prefix AFTER DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();

CREATE TRIGGER objects_insert_create_prefix BEFORE INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.objects_insert_prefix_trigger();

CREATE TRIGGER objects_update_create_prefix BEFORE UPDATE ON storage.objects FOR EACH ROW WHEN (((new.name <> old.name) OR (new.bucket_id <> old.bucket_id))) EXECUTE FUNCTION storage.objects_update_prefix_trigger();

CREATE TRIGGER prefixes_create_hierarchy BEFORE INSERT ON storage.prefixes FOR EACH ROW WHEN ((pg_trigger_depth() < 1)) EXECUTE FUNCTION storage.prefixes_insert_trigger();

CREATE TRIGGER prefixes_delete_hierarchy AFTER DELETE ON storage.prefixes FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


