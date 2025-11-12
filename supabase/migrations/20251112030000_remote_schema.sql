


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


CREATE SCHEMA IF NOT EXISTS "auth";


ALTER SCHEMA "auth" OWNER TO "supabase_admin";


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'Guest functionality removed - auth-only system. guest_reports table dropped.';



CREATE SCHEMA IF NOT EXISTS "storage";


ALTER SCHEMA "storage" OWNER TO "supabase_admin";


CREATE TYPE "auth"."aal_level" AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


ALTER TYPE "auth"."aal_level" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."code_challenge_method" AS ENUM (
    's256',
    'plain'
);


ALTER TYPE "auth"."code_challenge_method" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."factor_status" AS ENUM (
    'unverified',
    'verified'
);


ALTER TYPE "auth"."factor_status" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."factor_type" AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


ALTER TYPE "auth"."factor_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_authorization_status" AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


ALTER TYPE "auth"."oauth_authorization_status" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_client_type" AS ENUM (
    'public',
    'confidential'
);


ALTER TYPE "auth"."oauth_client_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_registration_type" AS ENUM (
    'dynamic',
    'manual'
);


ALTER TYPE "auth"."oauth_registration_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_response_type" AS ENUM (
    'code'
);


ALTER TYPE "auth"."oauth_response_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."one_time_token_type" AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


ALTER TYPE "auth"."one_time_token_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "public"."memory_type" AS ENUM (
    'fact',
    'emotion',
    'goal',
    'pattern',
    'relationship'
);


ALTER TYPE "public"."memory_type" OWNER TO "postgres";


COMMENT ON TYPE "public"."memory_type" IS 'Classification types for user memories extracted from conversations';



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


CREATE TYPE "storage"."buckettype" AS ENUM (
    'STANDARD',
    'ANALYTICS'
);


ALTER TYPE "storage"."buckettype" OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "auth"."email"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


ALTER FUNCTION "auth"."email"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."email"() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';



CREATE OR REPLACE FUNCTION "auth"."jwt"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


ALTER FUNCTION "auth"."jwt"() OWNER TO "supabase_auth_admin";


CREATE OR REPLACE FUNCTION "auth"."role"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


ALTER FUNCTION "auth"."role"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."role"() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';



CREATE OR REPLACE FUNCTION "auth"."uid"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


ALTER FUNCTION "auth"."uid"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."uid"() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';



CREATE OR REPLACE FUNCTION "public"."add_credits"("_user_id" "uuid", "_credits" integer, "_amount_usd" numeric, "_type" "text" DEFAULT 'purchase'::"text", "_reference_id" "text" DEFAULT NULL::"text", "_description" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  _current_credits integer;
  _new_credits integer;
BEGIN
  -- Lock row and get current balance
  SELECT credits INTO _current_credits
  FROM user_credits
  WHERE user_id = _user_id
  FOR UPDATE;
  
  -- Create record if doesn't exist
  IF _current_credits IS NULL THEN
    INSERT INTO user_credits (user_id, credits)
    VALUES (_user_id, _credits)
    RETURNING credits INTO _new_credits;
  ELSE
    -- Add credits
    _new_credits := _current_credits + _credits;
    UPDATE user_credits
    SET credits = _new_credits, last_updated = now()
    WHERE user_id = _user_id;
  END IF;
  
  -- Log transaction
  INSERT INTO credit_transactions (user_id, type, credits, amount_usd, reference_id, description)
  VALUES (_user_id, _type, _credits, _amount_usd, _reference_id, _description);
  
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."add_credits"("_user_id" "uuid", "_credits" integer, "_amount_usd" numeric, "_type" "text", "_reference_id" "text", "_description" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."archive_old_messages"() RETURNS TABLE("archived_count" integer, "conversation_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_archived_count INTEGER := 0;
  v_conversation_count INTEGER := 0;
  v_cutoff_date TIMESTAMPTZ;
BEGIN
  -- Archive messages older than 6 months in inactive conversations
  v_cutoff_date := NOW() - INTERVAL '6 months';
  
  -- Mark messages for archival (soft delete)
  WITH inactive_conversations AS (
    -- Find conversations with no recent activity
    SELECT DISTINCT c.id
    FROM conversations c
    LEFT JOIN messages m ON c.id = m.chat_id
    WHERE c.created_at < v_cutoff_date
      AND c.id NOT IN (
        SELECT chat_id
        FROM messages
        WHERE created_at > v_cutoff_date
      )
  ),
  messages_to_archive AS (
    -- For each inactive conversation, keep last 100 messages
    SELECT m.id
    FROM messages m
    INNER JOIN inactive_conversations ic ON m.chat_id = ic.id
    WHERE m.archived_at IS NULL
      AND m.id NOT IN (
        SELECT id
        FROM (
          SELECT id,
            ROW_NUMBER() OVER (PARTITION BY chat_id ORDER BY created_at DESC) as rn
          FROM messages
          WHERE chat_id IN (SELECT id FROM inactive_conversations)
        ) ranked
        WHERE rn <= 100
      )
  )
  UPDATE messages
  SET archived_at = NOW()
  WHERE id IN (SELECT id FROM messages_to_archive);
  
  GET DIAGNOSTICS v_archived_count = ROW_COUNT;
  
  -- Count affected conversations
  SELECT COUNT(DISTINCT chat_id)
  INTO v_conversation_count
  FROM messages
  WHERE archived_at >= NOW() - INTERVAL '1 hour';
  
  RAISE NOTICE 'Archived % messages from % conversations', v_archived_count, v_conversation_count;
  
  RETURN QUERY SELECT v_archived_count, v_conversation_count;
END;
$$;


ALTER FUNCTION "public"."archive_old_messages"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."archive_old_messages"() IS 'Archives messages older than 6 months from inactive conversations, keeping last 100 messages per conversation';



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


CREATE OR REPLACE FUNCTION "public"."check_and_increment_insights_count"("p_user_id" "uuid", "p_count" integer, "p_period" "text", "p_limit" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  current_usage INTEGER := 0;
  new_usage INTEGER;
BEGIN
  -- Input validation
  IF p_count <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'Invalid amount: must be positive',
      'error_code', 'INVALID_AMOUNT'
    );
  END IF;
  
  IF p_limit IS NULL OR p_limit < 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'Invalid limit',
      'error_code', 'INVALID_LIMIT'
    );
  END IF;

  -- Get current usage with row lock (prevents concurrent modifications)
  SELECT COALESCE(insights_count, 0) INTO current_usage
  FROM feature_usage
  WHERE user_id = p_user_id AND period = p_period
  FOR UPDATE;
  
  -- Calculate new usage
  new_usage := current_usage + p_count;
  
  -- Check limit BEFORE incrementing
  IF new_usage > p_limit THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'Monthly limit exceeded',
      'current_usage', current_usage,
      'requested', p_count,
      'new_usage', new_usage,
      'limit', p_limit,
      'remaining', GREATEST(0, p_limit - current_usage),
      'error_code', 'LIMIT_EXCEEDED'
    );
  END IF;
  
  -- Increment atomically (insert or update)
  INSERT INTO feature_usage (user_id, period, insights_count, updated_at)
  VALUES (p_user_id, p_period, p_count, NOW())
  ON CONFLICT (user_id, period)
  DO UPDATE SET 
    insights_count = feature_usage.insights_count + p_count,
    updated_at = NOW();
  
  -- Return success with usage info
  RETURN jsonb_build_object(
    'success', true,
    'previous_usage', current_usage,
    'incremented_by', p_count,
    'new_usage', new_usage,
    'remaining', p_limit - new_usage,
    'limit', p_limit
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Return error details
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'Database error: ' || SQLERRM,
      'error_code', 'DATABASE_ERROR'
    );
END;
$$;


ALTER FUNCTION "public"."check_and_increment_insights_count"("p_user_id" "uuid", "p_count" integer, "p_period" "text", "p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_and_increment_insights_count"("p_user_id" "uuid", "p_count" integer, "p_period" "text", "p_limit" integer) IS 'Atomically checks limit and increments insights count. Returns JSONB with success status and usage details.';



CREATE OR REPLACE FUNCTION "public"."check_and_increment_therai_calls"("p_user_id" "uuid", "p_calls" integer, "p_period" "text", "p_limit" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  current_usage INTEGER := 0;
  new_usage INTEGER;
BEGIN
  -- Input validation
  IF p_calls <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'Invalid amount: must be positive',
      'error_code', 'INVALID_AMOUNT'
    );
  END IF;
  
  IF p_limit IS NULL OR p_limit < 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'Invalid limit',
      'error_code', 'INVALID_LIMIT'
    );
  END IF;

  -- Get current usage with row lock
  SELECT COALESCE(therai_calls, 0) INTO current_usage
  FROM feature_usage
  WHERE user_id = p_user_id AND period = p_period
  FOR UPDATE;
  
  -- Calculate new usage
  new_usage := current_usage + p_calls;
  
  -- Check limit BEFORE incrementing
  IF new_usage > p_limit THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'Monthly limit exceeded',
      'current_usage', current_usage,
      'requested', p_calls,
      'new_usage', new_usage,
      'limit', p_limit,
      'remaining', GREATEST(0, p_limit - current_usage),
      'error_code', 'LIMIT_EXCEEDED'
    );
  END IF;
  
  -- Increment atomically
  INSERT INTO feature_usage (user_id, period, therai_calls, updated_at)
  VALUES (p_user_id, p_period, p_calls, NOW())
  ON CONFLICT (user_id, period)
  DO UPDATE SET 
    therai_calls = feature_usage.therai_calls + p_calls,
    updated_at = NOW();
  
  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'previous_usage', current_usage,
    'new_usage', new_usage,
    'limit', p_limit,
    'remaining', p_limit - new_usage
  );
END;
$$;


ALTER FUNCTION "public"."check_and_increment_therai_calls"("p_user_id" "uuid", "p_calls" integer, "p_period" "text", "p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_and_increment_therai_calls"("p_user_id" "uuid", "p_calls" integer, "p_period" "text", "p_limit" integer) IS 'Atomically check limit and increment @therai calls in single transaction';



CREATE OR REPLACE FUNCTION "public"."check_and_increment_voice_seconds"("p_user_id" "uuid", "p_seconds" integer, "p_period" "text", "p_limit" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  current_usage INTEGER := 0;
  new_usage INTEGER;
  result JSONB;
BEGIN
  -- Input validation
  IF p_seconds <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'Invalid amount: must be positive',
      'error_code', 'INVALID_AMOUNT'
    );
  END IF;
  
  IF p_limit IS NULL OR p_limit < 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'Invalid limit',
      'error_code', 'INVALID_LIMIT'
    );
  END IF;

  -- Get current usage with row lock (prevents concurrent modifications)
  SELECT COALESCE(voice_seconds, 0) INTO current_usage
  FROM feature_usage
  WHERE user_id = p_user_id AND period = p_period
  FOR UPDATE;
  
  -- Calculate new usage
  new_usage := current_usage + p_seconds;
  
  -- Check limit BEFORE incrementing
  IF new_usage > p_limit THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'Monthly limit exceeded',
      'current_usage', current_usage,
      'requested', p_seconds,
      'new_usage', new_usage,
      'limit', p_limit,
      'remaining', GREATEST(0, p_limit - current_usage),
      'error_code', 'LIMIT_EXCEEDED'
    );
  END IF;
  
  -- Increment atomically (insert or update)
  INSERT INTO feature_usage (user_id, period, voice_seconds, updated_at)
  VALUES (p_user_id, p_period, p_seconds, NOW())
  ON CONFLICT (user_id, period)
  DO UPDATE SET 
    voice_seconds = feature_usage.voice_seconds + p_seconds,
    updated_at = NOW();
  
  -- Return success with usage info
  RETURN jsonb_build_object(
    'success', true,
    'previous_usage', current_usage,
    'incremented_by', p_seconds,
    'new_usage', new_usage,
    'remaining', p_limit - new_usage,
    'limit', p_limit
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Return error details
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'Database error: ' || SQLERRM,
      'error_code', 'DATABASE_ERROR'
    );
END;
$$;


ALTER FUNCTION "public"."check_and_increment_voice_seconds"("p_user_id" "uuid", "p_seconds" integer, "p_period" "text", "p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_and_increment_voice_seconds"("p_user_id" "uuid", "p_seconds" integer, "p_period" "text", "p_limit" integer) IS 'Atomically checks limit and increments voice seconds. Returns JSONB with success status and usage details.';



CREATE OR REPLACE FUNCTION "public"."check_feature_limit"("p_user_id" "uuid", "p_feature_type" "text", "p_requested_amount" integer DEFAULT 1, "p_period" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
DECLARE
  v_plan_id TEXT;
  v_subscription_active BOOLEAN;
  v_subscription_status TEXT;
  v_trial_end_date TIMESTAMPTZ;
  v_limit INTEGER;
  v_current_usage INTEGER := 0;
  v_feature_column TEXT;
  v_limit_column TEXT;
  v_reset_date DATE;
BEGIN
  -- 1. Get user's subscription plan and trial status
  SELECT subscription_plan, subscription_active, subscription_status, trial_end_date
  INTO v_plan_id, v_subscription_active, v_subscription_status, v_trial_end_date
  FROM profiles
  WHERE id = p_user_id;
  
  IF v_plan_id IS NULL THEN
    v_plan_id := 'free';
  END IF;
  
  -- 2. FREE TRIAL CHECK: Block AI features after 1 week for free users
  IF v_plan_id = 'free' AND v_trial_end_date IS NOT NULL AND NOW() > v_trial_end_date THEN
    IF p_feature_type IN ('chat', 'voice_seconds', 'image_generation', 'therai_calls', 'insights') THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'Free trial expired. Upgrade to continue using AI features.',
        'error_code', 'TRIAL_EXPIRED',
        'trial_end_date', v_trial_end_date
      );
    END IF;
  END IF;
  
  -- 3. Check if user has active subscription (except for free tier checks)
  IF v_plan_id != 'free' AND (
    NOT v_subscription_active OR 
    v_subscription_status NOT IN ('active', 'trialing')
  ) THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'No active subscription',
      'error_code', 'NO_SUBSCRIPTION'
    );
  END IF;
  
  -- 4. Determine reset date and feature mapping
  CASE p_feature_type
    WHEN 'voice_seconds' THEN
      v_limit_column := 'voice_seconds_limit';
      v_feature_column := 'voice_seconds';
      -- Voice uses voice_usage table, not feature_usage
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'Use check_voice_limit for voice features',
        'error_code', 'WRONG_FUNCTION'
      );
    WHEN 'image_generation' THEN
      v_limit_column := 'image_generation_daily_limit';
      v_feature_column := 'images_generated';
      v_reset_date := CURRENT_DATE; -- Daily
    WHEN 'therai_calls' THEN
      v_limit_column := 'therai_calls_limit';
      v_feature_column := 'therai_calls';
      v_reset_date := CURRENT_DATE; -- Daily
    WHEN 'chat' THEN
      v_limit_column := 'chat_messages_daily_limit';
      v_feature_column := 'chat_messages';
      v_reset_date := CURRENT_DATE; -- Daily
    WHEN 'insights' THEN
      v_limit_column := 'insights_limit';
      v_feature_column := 'insights_count';
      v_reset_date := DATE_TRUNC('month', CURRENT_DATE)::DATE; -- Monthly
    ELSE
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'Unknown feature type',
        'error_code', 'INVALID_FEATURE'
      );
  END CASE;
  
  -- 5. Get limit from plan_limits table
  EXECUTE format('SELECT %I FROM plan_limits WHERE plan_id = $1 AND is_active = true', v_limit_column)
  INTO v_limit
  USING v_plan_id;
  
  IF v_limit IS NULL THEN
    -- NULL = unlimited
    RETURN jsonb_build_object(
      'allowed', true,
      'limit', NULL,
      'remaining', NULL,
      'is_unlimited', true
    );
  END IF;
  
  -- 6. AUTO-CREATE ROW: Ensure feature_usage row exists with today's reset date
  INSERT INTO feature_usage (user_id, last_reset_date)
  VALUES (p_user_id, v_reset_date)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- 7. Get current usage from feature_usage table (only count if reset date matches)
  EXECUTE format('
    SELECT COALESCE(%I, 0) 
    FROM feature_usage 
    WHERE user_id = $1 
      AND last_reset_date = $2', 
    v_feature_column
  )
  INTO v_current_usage
  USING p_user_id, v_reset_date;
  
  -- If no row with matching reset_date, usage is 0
  v_current_usage := COALESCE(v_current_usage, 0);
  
  -- 8. Check if limit exceeded
  IF v_current_usage + p_requested_amount > v_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'limit', v_limit,
      'current_usage', v_current_usage,
      'remaining', GREATEST(0, v_limit - v_current_usage),
      'reason', format('%s limit exceeded (%s/%s)', p_feature_type, v_current_usage, v_limit),
      'error_code', 'LIMIT_EXCEEDED'
    );
  END IF;
  
  -- 9. Allow access
  RETURN jsonb_build_object(
    'allowed', true,
    'limit', v_limit,
    'current_usage', v_current_usage,
    'remaining', v_limit - v_current_usage - p_requested_amount,
    'is_unlimited', false
  );
END;
$_$;


ALTER FUNCTION "public"."check_feature_limit"("p_user_id" "uuid", "p_feature_type" "text", "p_requested_amount" integer, "p_period" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_feature_limit"("p_user_id" "uuid", "p_feature_type" "text", "p_requested_amount" integer, "p_period" "text") IS 'Check feature limits with unified tracking. Images now use feature_usage instead of log table.';



CREATE OR REPLACE FUNCTION "public"."check_orphaned_data"() RETURNS TABLE("table_name" "text", "orphaned_count" bigint, "total_size_estimate" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'messages'::text,
    COUNT(*)::bigint,
    pg_size_pretty(COUNT(*) * 1024)::text -- Rough estimate: 1KB per message
  FROM public.messages m
  WHERE NOT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = m.chat_id)
  
  UNION ALL
  
  SELECT 
    'message_block_summaries'::text,
    COUNT(*)::bigint,
    pg_size_pretty(COUNT(*) * 512)::text -- Rough estimate: 512 bytes per summary
  FROM public.message_block_summaries mbs
  WHERE NOT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = mbs.chat_id);
END;
$$;


ALTER FUNCTION "public"."check_orphaned_data"() OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."check_voice_limit"("p_user_id" "uuid", "p_requested_seconds" integer DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_plan_id TEXT;
  v_limit INTEGER;
  v_current_usage INTEGER := 0;
  v_subscription_active BOOLEAN;
BEGIN
  -- Get user's plan info
  SELECT subscription_plan, subscription_active
  INTO v_plan_id, v_subscription_active
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_plan_id IS NULL THEN
    v_plan_id := 'free';
  END IF;

  -- Determine plan limit
  SELECT voice_seconds_limit INTO v_limit
  FROM public.plan_limits
  WHERE plan_id = v_plan_id
    AND is_active = TRUE;

  -- NULL limit means unlimited usage
  IF v_limit IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', TRUE,
      'is_unlimited', TRUE,
      'seconds_used', 0,
      'limit', NULL
    );
  END IF;

  -- ✅ FIX: Fetch current usage, treat no-row as 0
  SELECT COALESCE(
    (SELECT seconds_used FROM public.voice_usage WHERE user_id = p_user_id),
    0
  ) INTO v_current_usage;

  -- Evaluate allowance
  IF v_current_usage + p_requested_seconds <= v_limit THEN
    RETURN jsonb_build_object(
      'allowed', TRUE,
      'is_unlimited', FALSE,
      'seconds_used', v_current_usage,
      'remaining', v_limit - v_current_usage,
      'limit', v_limit
    );
  ELSE
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'is_unlimited', FALSE,
      'seconds_used', v_current_usage,
      'remaining', GREATEST(0, v_limit - v_current_usage),
      'limit', v_limit,
      'reason', 'Voice limit exceeded for current billing cycle'
    );
  END IF;
END;
$$;


ALTER FUNCTION "public"."check_voice_limit"("p_user_id" "uuid", "p_requested_seconds" integer) OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."clean_edge_function_logs"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Delete edge function logs older than 7 days
  DELETE FROM edge_function_logs
  WHERE created_at < NOW() - INTERVAL '7 days';
  
  RAISE NOTICE 'Cleaned edge_function_logs older than 7 days';
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'edge_function_logs table does not exist, skipping';
  WHEN OTHERS THEN
    RAISE WARNING 'Error cleaning edge_function_logs: %', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."clean_edge_function_logs"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."clean_edge_function_logs"() IS 'Deletes edge function logs older than 7 days to prevent table bloat';



CREATE OR REPLACE FUNCTION "public"."clean_old_webhook_events"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Delete webhook events older than 90 days (keep for reconciliation period)
  DELETE FROM stripe_webhook_events
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  RAISE NOTICE 'Cleaned stripe_webhook_events older than 90 days';
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'stripe_webhook_events table does not exist, skipping';
  WHEN OTHERS THEN
    RAISE WARNING 'Error cleaning stripe_webhook_events: %', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."clean_old_webhook_events"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."clean_old_webhook_events"() IS 'Deletes Stripe webhook events older than 90 days (reconciliation period)';



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


CREATE OR REPLACE FUNCTION "public"."deduct_credits"("_user_id" "uuid", "_credits" integer, "_endpoint" "text", "_reference_id" "uuid" DEFAULT NULL::"uuid", "_description" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  _current_credits integer;
  _new_credits integer;
  _auto_topup_enabled boolean;
  _auto_topup_threshold integer;
  _auto_topup_amount integer;
BEGIN
  -- Lock row and get current balance
  SELECT credits, auto_topup_enabled, auto_topup_threshold, auto_topup_amount 
  INTO _current_credits, _auto_topup_enabled, _auto_topup_threshold, _auto_topup_amount
  FROM user_credits
  WHERE user_id = _user_id
  FOR UPDATE;
  
  -- Create record if doesn't exist
  IF _current_credits IS NULL THEN
    INSERT INTO user_credits (user_id, credits)
    VALUES (_user_id, 0)
    RETURNING credits, auto_topup_enabled, auto_topup_threshold, auto_topup_amount 
    INTO _current_credits, _auto_topup_enabled, _auto_topup_threshold, _auto_topup_amount;
  END IF;
  
  -- Check sufficient balance
  IF _current_credits < _credits THEN
    RAISE EXCEPTION 'Insufficient credits: % < %', _current_credits, _credits;
  END IF;
  
  -- Deduct credits
  _new_credits := _current_credits - _credits;
  UPDATE user_credits
  SET credits = _new_credits, last_updated = now()
  WHERE user_id = _user_id;
  
  -- Log transaction
  INSERT INTO credit_transactions (user_id, type, credits, endpoint, reference_id, description)
  VALUES (_user_id, 'deduct', _credits, _endpoint, _reference_id, _description);
  
  -- Check if auto top-up should trigger
  IF _auto_topup_enabled AND _new_credits <= _auto_topup_threshold THEN
    -- Insert into topup_queue for processing
    INSERT INTO topup_queue (user_id, amount_usd, status, message)
    VALUES (
      _user_id, 
      (_auto_topup_amount * 0.15), 
      'pending', 
      'Auto top-up triggered: balance dropped to ' || _new_credits || ' credits'
    );
  END IF;
  
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."deduct_credits"("_user_id" "uuid", "_credits" integer, "_endpoint" "text", "_reference_id" "uuid", "_description" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_user_account"("user_id_to_delete" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
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


CREATE OR REPLACE FUNCTION "public"."get_config"("config_key" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  config_value TEXT;
BEGIN
  SELECT value INTO config_value
  FROM system_config
  WHERE key = config_key;
  
  RETURN config_value;
END;
$$;


ALTER FUNCTION "public"."get_config"("config_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_billing_cycle"("p_user_id" "uuid") RETURNS TABLE("cycle_start" "date", "cycle_end" "date")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_subscription_start DATE;
  v_day_of_month INTEGER;
  v_current_date DATE := CURRENT_DATE;
  v_cycle_start DATE;
  v_cycle_end DATE;
BEGIN
  -- Get subscription start date from profiles
  SELECT subscription_start_date::DATE INTO v_subscription_start
  FROM profiles
  WHERE id = p_user_id;
  
  -- If no subscription, default to account creation date
  IF v_subscription_start IS NULL THEN
    SELECT created_at::DATE INTO v_subscription_start
    FROM profiles
    WHERE id = p_user_id;
  END IF;
  
  -- Get day of month from subscription (e.g., 15 from 2025-01-15)
  v_day_of_month := EXTRACT(DAY FROM v_subscription_start);
  
  -- Calculate current billing cycle
  -- If today is Jan 20 and subscription day is 15:
  -- cycle_start = Jan 15, cycle_end = Feb 15
  -- If today is Jan 10 and subscription day is 15:
  -- cycle_start = Dec 15, cycle_end = Jan 15
  
  v_cycle_start := MAKE_DATE(
    EXTRACT(YEAR FROM v_current_date)::INTEGER,
    EXTRACT(MONTH FROM v_current_date)::INTEGER,
    LEAST(v_day_of_month, EXTRACT(DAY FROM DATE_TRUNC('month', v_current_date) + INTERVAL '1 month - 1 day')::INTEGER)
  );
  
  -- If current date is before cycle start day this month, go back one month
  IF v_current_date < v_cycle_start THEN
    v_cycle_start := v_cycle_start - INTERVAL '1 month';
  END IF;
  
  -- Cycle ends one month later
  v_cycle_end := v_cycle_start + INTERVAL '1 month';
  
  RETURN QUERY SELECT v_cycle_start, v_cycle_end;
END;
$$;


ALTER FUNCTION "public"."get_current_billing_cycle"("p_user_id" "uuid") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."get_user_limits"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_plan_id TEXT;
  v_limits JSONB;
  v_usage JSONB;
  v_daily_period TEXT;
  v_voice_seconds_used INTEGER := 0;
  v_insights_used INTEGER := 0;
BEGIN
  -- Get user's plan
  SELECT subscription_plan INTO v_plan_id
  FROM profiles
  WHERE id = p_user_id;
  
  IF v_plan_id IS NULL THEN
    v_plan_id := 'free';
  END IF;
  
  -- Set daily period for daily-tracked features
  v_daily_period := TO_CHAR(NOW(), 'YYYY-MM-DD');
  
  -- Get plan limits
  SELECT jsonb_build_object(
    'plan_id', plan_id,
    'plan_name', plan_name,
    'voice_seconds', voice_seconds_limit,
    'image_generation_daily', image_generation_daily_limit,
    'therai_calls', therai_calls_limit,
    'insights', insights_limit,
    'features', jsonb_build_object(
      'together_mode', has_together_mode,
      'voice_mode', has_voice_mode,
      'image_generation', has_image_generation,
      'priority_support', has_priority_support,
      'early_access', has_early_access
    )
  )
  INTO v_limits
  FROM plan_limits
  WHERE plan_id = v_plan_id AND is_active = true;
  
  -- Get voice usage from voice_usage table (monthly billing cycle)
  SELECT COALESCE(seconds_used, 0)
  INTO v_voice_seconds_used
  FROM voice_usage
  WHERE user_id = p_user_id
    AND billing_cycle_start <= CURRENT_DATE
    AND billing_cycle_end >= CURRENT_DATE;
  
  -- Get insights count from feature_usage (monthly tracked)
  SELECT COALESCE(insights_count, 0)
  INTO v_insights_used
  FROM feature_usage
  WHERE user_id = p_user_id
    AND last_reset_date = DATE_TRUNC('month', CURRENT_DATE)::DATE;
  
  -- Get daily usage (images_generated, chat_messages, therai_calls)
  SELECT jsonb_build_object(
    'images_generated', COALESCE(images_generated, 0),
    'chat_messages', COALESCE(chat_messages, 0),
    'therai_calls', COALESCE(therai_calls, 0)
  )
  INTO v_usage
  FROM feature_usage
  WHERE user_id = p_user_id 
    AND last_reset_date = CURRENT_DATE;
  
  -- Build complete usage object with voice and insights
  v_usage := COALESCE(v_usage, '{}'::jsonb) || jsonb_build_object(
    'voice_seconds', v_voice_seconds_used,
    'insights_count', v_insights_used
  );
  
  -- Ensure all expected fields exist with defaults
  v_usage := jsonb_build_object(
    'voice_seconds', COALESCE((v_usage->>'voice_seconds')::INTEGER, 0),
    'insights_count', COALESCE((v_usage->>'insights_count')::INTEGER, 0),
    'images_generated', COALESCE((v_usage->>'images_generated')::INTEGER, 0),
    'chat_messages', COALESCE((v_usage->>'chat_messages')::INTEGER, 0),
    'therai_calls', COALESCE((v_usage->>'therai_calls')::INTEGER, 0)
  );
  
  -- Combine and return
  RETURN jsonb_build_object(
    'limits', v_limits,
    'usage', v_usage
  );
END;
$$;


ALTER FUNCTION "public"."get_user_limits"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_limits"("p_user_id" "uuid") IS 'Get all limits and current usage for a user. Queries both daily (YYYY-MM-DD) and monthly (YYYY-MM) periods correctly to prevent duplicate rows.';



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


CREATE OR REPLACE FUNCTION "public"."handle_public_conversation_participant"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- When conversation becomes public, ensure owner is a participant
  IF NEW.is_public = true AND (OLD.is_public IS NULL OR OLD.is_public = false) THEN
    -- Insert owner as participant if not already there
    INSERT INTO conversations_participants (conversation_id, user_id, role, invited_by)
    VALUES (NEW.id, NEW.owner_user_id, 'owner', NEW.owner_user_id)
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_public_conversation_participant"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hard_delete_archived_messages"("months_old" integer DEFAULT 12) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_deleted_count INTEGER := 0;
BEGIN
  -- Permanently delete messages archived more than X months ago
  DELETE FROM messages
  WHERE archived_at < NOW() - (months_old || ' months')::INTERVAL;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RAISE NOTICE 'Permanently deleted % archived messages older than % months', v_deleted_count, months_old;
  
  RETURN v_deleted_count;
END;
$$;


ALTER FUNCTION "public"."hard_delete_archived_messages"("months_old" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."hard_delete_archived_messages"("months_old" integer) IS 'Permanently deletes archived messages older than specified months (default 12). Run manually only when needed.';



CREATE OR REPLACE FUNCTION "public"."increment_chat_messages"("p_user_id" "uuid", "p_count" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO feature_usage (user_id, chat_messages, last_reset_date, updated_at)
  VALUES (p_user_id, p_count, CURRENT_DATE, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    chat_messages = CASE
      WHEN feature_usage.last_reset_date < CURRENT_DATE
        THEN p_count  -- Reset (new day)
      ELSE feature_usage.chat_messages + p_count  -- Increment
    END,
    last_reset_date = CURRENT_DATE,
    updated_at = NOW();
END;
$$;


ALTER FUNCTION "public"."increment_chat_messages"("p_user_id" "uuid", "p_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_chat_messages"("p_user_id" "uuid", "p_count" integer, "p_period" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO feature_usage (user_id, period, chat_messages, updated_at)
  VALUES (p_user_id, p_period, p_count, NOW())
  ON CONFLICT (user_id, period)
  DO UPDATE SET 
    chat_messages = feature_usage.chat_messages + p_count,
    updated_at = NOW();
END;
$$;


ALTER FUNCTION "public"."increment_chat_messages"("p_user_id" "uuid", "p_count" integer, "p_period" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."increment_chat_messages"("p_user_id" "uuid", "p_count" integer, "p_period" "text") IS 'Increment daily chat messages count. Uses YYYY-MM-DD period format.';



CREATE OR REPLACE FUNCTION "public"."increment_feature_usage"("p_user_id" "uuid", "p_feature_type" "text", "p_amount" integer, "p_period" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO feature_usage (user_id, feature_type, usage_amount, period, updated_at)
  VALUES (p_user_id, p_feature_type, p_amount, p_period, NOW())
  ON CONFLICT (user_id, feature_type, period)
  DO UPDATE SET 
    usage_amount = feature_usage.usage_amount + p_amount,
    updated_at = NOW();
END;
$$;


ALTER FUNCTION "public"."increment_feature_usage"("p_user_id" "uuid", "p_feature_type" "text", "p_amount" integer, "p_period" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_images_generated"("p_user_id" "uuid", "p_count" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO feature_usage (user_id, images_generated, last_reset_date, updated_at)
  VALUES (p_user_id, p_count, CURRENT_DATE, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    images_generated = CASE
      WHEN feature_usage.last_reset_date < CURRENT_DATE
        THEN p_count  -- Reset (new day)
      ELSE feature_usage.images_generated + p_count  -- Increment
    END,
    last_reset_date = CURRENT_DATE,
    updated_at = NOW();
END;
$$;


ALTER FUNCTION "public"."increment_images_generated"("p_user_id" "uuid", "p_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_images_generated"("p_user_id" "uuid", "p_count" integer, "p_period" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO feature_usage (user_id, period, images_generated, updated_at)
  VALUES (p_user_id, p_period, p_count, NOW())
  ON CONFLICT (user_id, period)
  DO UPDATE SET 
    images_generated = feature_usage.images_generated + p_count,
    updated_at = NOW();
END;
$$;


ALTER FUNCTION "public"."increment_images_generated"("p_user_id" "uuid", "p_count" integer, "p_period" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."increment_images_generated"("p_user_id" "uuid", "p_count" integer, "p_period" "text") IS 'Increment daily image generation count in feature_usage table';



CREATE OR REPLACE FUNCTION "public"."increment_insights_count"("p_user_id" "uuid", "p_count" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_month_start DATE := DATE_TRUNC('month', CURRENT_DATE)::DATE;
BEGIN
  INSERT INTO feature_usage (user_id, insights_count, last_reset_date, updated_at)
  VALUES (p_user_id, p_count, v_month_start, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    insights_count = CASE
      WHEN feature_usage.last_reset_date < v_month_start
        THEN p_count  -- Reset (new month)
      ELSE feature_usage.insights_count + p_count  -- Increment
    END,
    last_reset_date = v_month_start,
    updated_at = NOW();
END;
$$;


ALTER FUNCTION "public"."increment_insights_count"("p_user_id" "uuid", "p_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_insights_count"("p_user_id" "uuid", "p_count" integer, "p_period" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO feature_usage (user_id, period, insights_count, updated_at)
  VALUES (p_user_id, p_period, p_count, NOW())
  ON CONFLICT (user_id, period)
  DO UPDATE SET 
    insights_count = feature_usage.insights_count + p_count,
    updated_at = NOW();
END;
$$;


ALTER FUNCTION "public"."increment_insights_count"("p_user_id" "uuid", "p_count" integer, "p_period" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_therai_calls"("p_user_id" "uuid", "p_calls" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO feature_usage (user_id, therai_calls, last_reset_date, updated_at)
  VALUES (p_user_id, p_calls, CURRENT_DATE, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    therai_calls = CASE
      WHEN feature_usage.last_reset_date < CURRENT_DATE
        THEN p_calls  -- Reset (new day)
      ELSE feature_usage.therai_calls + p_calls  -- Increment
    END,
    last_reset_date = CURRENT_DATE,
    updated_at = NOW();
END;
$$;


ALTER FUNCTION "public"."increment_therai_calls"("p_user_id" "uuid", "p_calls" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_therai_calls"("p_user_id" "uuid", "p_calls" integer, "p_period" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO feature_usage (user_id, period, therai_calls, updated_at)
  VALUES (p_user_id, p_period, p_calls, NOW())
  ON CONFLICT (user_id, period)
  DO UPDATE SET 
    therai_calls = feature_usage.therai_calls + p_calls,
    updated_at = NOW();
END;
$$;


ALTER FUNCTION "public"."increment_therai_calls"("p_user_id" "uuid", "p_calls" integer, "p_period" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."increment_therai_calls"("p_user_id" "uuid", "p_calls" integer, "p_period" "text") IS 'Increment daily @therai calls count. Uses YYYY-MM-DD period format.';



CREATE OR REPLACE FUNCTION "public"."increment_voice_seconds"("p_user_id" "uuid", "p_seconds" integer, "p_period" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO feature_usage (user_id, period, voice_seconds, updated_at)
  VALUES (p_user_id, p_period, p_seconds, NOW())
  ON CONFLICT (user_id, period)
  DO UPDATE SET 
    voice_seconds = feature_usage.voice_seconds + p_seconds,
    updated_at = NOW();
END;
$$;


ALTER FUNCTION "public"."increment_voice_seconds"("p_user_id" "uuid", "p_seconds" integer, "p_period" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_voice_usage"("p_user_id" "uuid", "p_seconds" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_cycle_start DATE;
  v_cycle_end DATE;
BEGIN
  -- Get current billing cycle
  SELECT cycle_start, cycle_end INTO v_cycle_start, v_cycle_end
  FROM get_current_billing_cycle(p_user_id);
  
  -- Upsert: create row if doesn't exist, or update if cycle is current
  INSERT INTO voice_usage (user_id, seconds_used, billing_cycle_start, billing_cycle_end, updated_at)
  VALUES (p_user_id, p_seconds, v_cycle_start, v_cycle_end, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    -- If existing cycle matches, just increment
    seconds_used = CASE 
      WHEN voice_usage.billing_cycle_end >= v_cycle_end THEN voice_usage.seconds_used + p_seconds
      ELSE p_seconds  -- New cycle, reset counter
    END,
    billing_cycle_start = v_cycle_start,
    billing_cycle_end = v_cycle_end,
    updated_at = NOW();
END;
$$;


ALTER FUNCTION "public"."increment_voice_usage"("p_user_id" "uuid", "p_seconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_user_in_trial"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_plan_id TEXT;
  v_trial_end_date TIMESTAMPTZ;
BEGIN
  SELECT subscription_plan, trial_end_date
  INTO v_plan_id, v_trial_end_date
  FROM profiles
  WHERE id = p_user_id;
  
  RETURN v_plan_id = 'free' 
    AND v_trial_end_date IS NOT NULL 
    AND NOW() <= v_trial_end_date;
END;
$$;


ALTER FUNCTION "public"."is_user_in_trial"("p_user_id" "uuid") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."log_message_cascade_deletion"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.cascade_deletion_log (table_name, record_id, parent_table, parent_id)
  VALUES ('messages', OLD.id, 'conversations', OLD.chat_id);
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."log_message_cascade_deletion"() OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."log_summary_cascade_deletion"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.cascade_deletion_log (table_name, record_id, parent_table, parent_id)
  VALUES ('message_block_summaries', OLD.id, 'conversations', OLD.chat_id);
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."log_summary_cascade_deletion"() OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."set_trial_end_date"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.trial_end_date IS NULL THEN
    NEW.trial_end_date := NEW.created_at + INTERVAL '7 days';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_trial_end_date"() OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."update_auto_topup_settings"("_user_id" "uuid", "_enabled" boolean, "_threshold" integer, "_amount" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Ensure user_credits record exists
  INSERT INTO user_credits (user_id, auto_topup_enabled, auto_topup_threshold, auto_topup_amount)
  VALUES (_user_id, _enabled, _threshold, _amount)
  ON CONFLICT (user_id) DO UPDATE
  SET 
    auto_topup_enabled = _enabled,
    auto_topup_threshold = _threshold,
    auto_topup_amount = _amount,
    last_updated = now();
  
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."update_auto_topup_settings"("_user_id" "uuid", "_enabled" boolean, "_threshold" integer, "_amount" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_chat_folders_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_chat_folders_updated_at"() OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."update_system_prompts_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_system_prompts_updated_at"() OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "storage"."add_prefixes"("_bucket_id" "text", "_name" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    prefixes text[];
BEGIN
    prefixes := "storage"."get_prefixes"("_name");

    IF array_length(prefixes, 1) > 0 THEN
        INSERT INTO storage.prefixes (name, bucket_id)
        SELECT UNNEST(prefixes) as name, "_bucket_id" ON CONFLICT DO NOTHING;
    END IF;
END;
$$;


ALTER FUNCTION "storage"."add_prefixes"("_bucket_id" "text", "_name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."can_insert_object"("bucketid" "text", "name" "text", "owner" "uuid", "metadata" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


ALTER FUNCTION "storage"."can_insert_object"("bucketid" "text", "name" "text", "owner" "uuid", "metadata" "jsonb") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."delete_leaf_prefixes"("bucket_ids" "text"[], "names" "text"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_rows_deleted integer;
BEGIN
    LOOP
        WITH candidates AS (
            SELECT DISTINCT
                t.bucket_id,
                unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        ),
        uniq AS (
             SELECT
                 bucket_id,
                 name,
                 storage.get_level(name) AS level
             FROM candidates
             WHERE name <> ''
             GROUP BY bucket_id, name
        ),
        leaf AS (
             SELECT
                 p.bucket_id,
                 p.name,
                 p.level
             FROM storage.prefixes AS p
                  JOIN uniq AS u
                       ON u.bucket_id = p.bucket_id
                           AND u.name = p.name
                           AND u.level = p.level
             WHERE NOT EXISTS (
                 SELECT 1
                 FROM storage.objects AS o
                 WHERE o.bucket_id = p.bucket_id
                   AND o.level = p.level + 1
                   AND o.name COLLATE "C" LIKE p.name || '/%'
             )
             AND NOT EXISTS (
                 SELECT 1
                 FROM storage.prefixes AS c
                 WHERE c.bucket_id = p.bucket_id
                   AND c.level = p.level + 1
                   AND c.name COLLATE "C" LIKE p.name || '/%'
             )
        )
        DELETE
        FROM storage.prefixes AS p
            USING leaf AS l
        WHERE p.bucket_id = l.bucket_id
          AND p.name = l.name
          AND p.level = l.level;

        GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
        EXIT WHEN v_rows_deleted = 0;
    END LOOP;
END;
$$;


ALTER FUNCTION "storage"."delete_leaf_prefixes"("bucket_ids" "text"[], "names" "text"[]) OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."delete_prefix"("_bucket_id" "text", "_name" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Check if we can delete the prefix
    IF EXISTS(
        SELECT FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name") + 1
          AND "prefixes"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    )
    OR EXISTS(
        SELECT FROM "storage"."objects"
        WHERE "objects"."bucket_id" = "_bucket_id"
          AND "storage"."get_level"("objects"."name") = "storage"."get_level"("_name") + 1
          AND "objects"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    ) THEN
    -- There are sub-objects, skip deletion
    RETURN false;
    ELSE
        DELETE FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name")
          AND "prefixes"."name" = "_name";
        RETURN true;
    END IF;
END;
$$;


ALTER FUNCTION "storage"."delete_prefix"("_bucket_id" "text", "_name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."delete_prefix_hierarchy_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    prefix text;
BEGIN
    prefix := "storage"."get_prefix"(OLD."name");

    IF coalesce(prefix, '') != '' THEN
        PERFORM "storage"."delete_prefix"(OLD."bucket_id", prefix);
    END IF;

    RETURN OLD;
END;
$$;


ALTER FUNCTION "storage"."delete_prefix_hierarchy_trigger"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."enforce_bucket_name_length"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


ALTER FUNCTION "storage"."enforce_bucket_name_length"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."extension"("name" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    SELECT _parts[array_length(_parts,1)] INTO _filename;
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


ALTER FUNCTION "storage"."extension"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."filename"("name" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


ALTER FUNCTION "storage"."filename"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."foldername"("name" "text") RETURNS "text"[]
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


ALTER FUNCTION "storage"."foldername"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_level"("name" "text") RETURNS integer
    LANGUAGE "sql" IMMUTABLE STRICT
    AS $$
SELECT array_length(string_to_array("name", '/'), 1);
$$;


ALTER FUNCTION "storage"."get_level"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_prefix"("name" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE STRICT
    AS $_$
SELECT
    CASE WHEN strpos("name", '/') > 0 THEN
             regexp_replace("name", '[\/]{1}[^\/]+\/?$', '')
         ELSE
             ''
        END;
$_$;


ALTER FUNCTION "storage"."get_prefix"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_prefixes"("name" "text") RETURNS "text"[]
    LANGUAGE "plpgsql" IMMUTABLE STRICT
    AS $$
DECLARE
    parts text[];
    prefixes text[];
    prefix text;
BEGIN
    -- Split the name into parts by '/'
    parts := string_to_array("name", '/');
    prefixes := '{}';

    -- Construct the prefixes, stopping one level below the last part
    FOR i IN 1..array_length(parts, 1) - 1 LOOP
            prefix := array_to_string(parts[1:i], '/');
            prefixes := array_append(prefixes, prefix);
    END LOOP;

    RETURN prefixes;
END;
$$;


ALTER FUNCTION "storage"."get_prefixes"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_size_by_bucket"() RETURNS TABLE("size" bigint, "bucket_id" "text")
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint) as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


ALTER FUNCTION "storage"."get_size_by_bucket"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."list_multipart_uploads_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer DEFAULT 100, "next_key_token" "text" DEFAULT ''::"text", "next_upload_token" "text" DEFAULT ''::"text") RETURNS TABLE("key" "text", "id" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


ALTER FUNCTION "storage"."list_multipart_uploads_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer, "next_key_token" "text", "next_upload_token" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."list_objects_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer DEFAULT 100, "start_after" "text" DEFAULT ''::"text", "next_token" "text" DEFAULT ''::"text") RETURNS TABLE("name" "text", "id" "uuid", "metadata" "jsonb", "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(name COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                        substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1)))
                    ELSE
                        name
                END AS name, id, metadata, updated_at
            FROM
                storage.objects
            WHERE
                bucket_id = $5 AND
                name ILIKE $1 || ''%'' AND
                CASE
                    WHEN $6 != '''' THEN
                    name COLLATE "C" > $6
                ELSE true END
                AND CASE
                    WHEN $4 != '''' THEN
                        CASE
                            WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                                substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                name COLLATE "C" > $4
                            END
                    ELSE
                        true
                END
            ORDER BY
                name COLLATE "C" ASC) as e order by name COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_token, bucket_id, start_after;
END;
$_$;


ALTER FUNCTION "storage"."list_objects_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer, "start_after" "text", "next_token" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."lock_top_prefixes"("bucket_ids" "text"[], "names" "text"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_bucket text;
    v_top text;
BEGIN
    FOR v_bucket, v_top IN
        SELECT DISTINCT t.bucket_id,
            split_part(t.name, '/', 1) AS top
        FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        WHERE t.name <> ''
        ORDER BY 1, 2
        LOOP
            PERFORM pg_advisory_xact_lock(hashtextextended(v_bucket || '/' || v_top, 0));
        END LOOP;
END;
$$;


ALTER FUNCTION "storage"."lock_top_prefixes"("bucket_ids" "text"[], "names" "text"[]) OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."objects_delete_cleanup"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_bucket_ids text[];
    v_names      text[];
BEGIN
    IF current_setting('storage.gc.prefixes', true) = '1' THEN
        RETURN NULL;
    END IF;

    PERFORM set_config('storage.gc.prefixes', '1', true);

    SELECT COALESCE(array_agg(d.bucket_id), '{}'),
           COALESCE(array_agg(d.name), '{}')
    INTO v_bucket_ids, v_names
    FROM deleted AS d
    WHERE d.name <> '';

    PERFORM storage.lock_top_prefixes(v_bucket_ids, v_names);
    PERFORM storage.delete_leaf_prefixes(v_bucket_ids, v_names);

    RETURN NULL;
END;
$$;


ALTER FUNCTION "storage"."objects_delete_cleanup"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."objects_insert_prefix_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    NEW.level := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


ALTER FUNCTION "storage"."objects_insert_prefix_trigger"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."objects_update_cleanup"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    -- NEW - OLD (destinations to create prefixes for)
    v_add_bucket_ids text[];
    v_add_names      text[];

    -- OLD - NEW (sources to prune)
    v_src_bucket_ids text[];
    v_src_names      text[];
BEGIN
    IF TG_OP <> 'UPDATE' THEN
        RETURN NULL;
    END IF;

    -- 1) Compute NEW−OLD (added paths) and OLD−NEW (moved-away paths)
    WITH added AS (
        SELECT n.bucket_id, n.name
        FROM new_rows n
        WHERE n.name <> '' AND position('/' in n.name) > 0
        EXCEPT
        SELECT o.bucket_id, o.name FROM old_rows o WHERE o.name <> ''
    ),
    moved AS (
         SELECT o.bucket_id, o.name
         FROM old_rows o
         WHERE o.name <> ''
         EXCEPT
         SELECT n.bucket_id, n.name FROM new_rows n WHERE n.name <> ''
    )
    SELECT
        -- arrays for ADDED (dest) in stable order
        COALESCE( (SELECT array_agg(a.bucket_id ORDER BY a.bucket_id, a.name) FROM added a), '{}' ),
        COALESCE( (SELECT array_agg(a.name      ORDER BY a.bucket_id, a.name) FROM added a), '{}' ),
        -- arrays for MOVED (src) in stable order
        COALESCE( (SELECT array_agg(m.bucket_id ORDER BY m.bucket_id, m.name) FROM moved m), '{}' ),
        COALESCE( (SELECT array_agg(m.name      ORDER BY m.bucket_id, m.name) FROM moved m), '{}' )
    INTO v_add_bucket_ids, v_add_names, v_src_bucket_ids, v_src_names;

    -- Nothing to do?
    IF (array_length(v_add_bucket_ids, 1) IS NULL) AND (array_length(v_src_bucket_ids, 1) IS NULL) THEN
        RETURN NULL;
    END IF;

    -- 2) Take per-(bucket, top) locks: ALL prefixes in consistent global order to prevent deadlocks
    DECLARE
        v_all_bucket_ids text[];
        v_all_names text[];
    BEGIN
        -- Combine source and destination arrays for consistent lock ordering
        v_all_bucket_ids := COALESCE(v_src_bucket_ids, '{}') || COALESCE(v_add_bucket_ids, '{}');
        v_all_names := COALESCE(v_src_names, '{}') || COALESCE(v_add_names, '{}');

        -- Single lock call ensures consistent global ordering across all transactions
        IF array_length(v_all_bucket_ids, 1) IS NOT NULL THEN
            PERFORM storage.lock_top_prefixes(v_all_bucket_ids, v_all_names);
        END IF;
    END;

    -- 3) Create destination prefixes (NEW−OLD) BEFORE pruning sources
    IF array_length(v_add_bucket_ids, 1) IS NOT NULL THEN
        WITH candidates AS (
            SELECT DISTINCT t.bucket_id, unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(v_add_bucket_ids, v_add_names) AS t(bucket_id, name)
            WHERE name <> ''
        )
        INSERT INTO storage.prefixes (bucket_id, name)
        SELECT c.bucket_id, c.name
        FROM candidates c
        ON CONFLICT DO NOTHING;
    END IF;

    -- 4) Prune source prefixes bottom-up for OLD−NEW
    IF array_length(v_src_bucket_ids, 1) IS NOT NULL THEN
        -- re-entrancy guard so DELETE on prefixes won't recurse
        IF current_setting('storage.gc.prefixes', true) <> '1' THEN
            PERFORM set_config('storage.gc.prefixes', '1', true);
        END IF;

        PERFORM storage.delete_leaf_prefixes(v_src_bucket_ids, v_src_names);
    END IF;

    RETURN NULL;
END;
$$;


ALTER FUNCTION "storage"."objects_update_cleanup"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."objects_update_level_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Ensure this is an update operation and the name has changed
    IF TG_OP = 'UPDATE' AND (NEW."name" <> OLD."name" OR NEW."bucket_id" <> OLD."bucket_id") THEN
        -- Set the new level
        NEW."level" := "storage"."get_level"(NEW."name");
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "storage"."objects_update_level_trigger"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."objects_update_prefix_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    old_prefixes TEXT[];
BEGIN
    -- Ensure this is an update operation and the name has changed
    IF TG_OP = 'UPDATE' AND (NEW."name" <> OLD."name" OR NEW."bucket_id" <> OLD."bucket_id") THEN
        -- Retrieve old prefixes
        old_prefixes := "storage"."get_prefixes"(OLD."name");

        -- Remove old prefixes that are only used by this object
        WITH all_prefixes as (
            SELECT unnest(old_prefixes) as prefix
        ),
        can_delete_prefixes as (
             SELECT prefix
             FROM all_prefixes
             WHERE NOT EXISTS (
                 SELECT 1 FROM "storage"."objects"
                 WHERE "bucket_id" = OLD."bucket_id"
                   AND "name" <> OLD."name"
                   AND "name" LIKE (prefix || '%')
             )
         )
        DELETE FROM "storage"."prefixes" WHERE name IN (SELECT prefix FROM can_delete_prefixes);

        -- Add new prefixes
        PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    END IF;
    -- Set the new level
    NEW."level" := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


ALTER FUNCTION "storage"."objects_update_prefix_trigger"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."operation"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


ALTER FUNCTION "storage"."operation"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."prefixes_delete_cleanup"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_bucket_ids text[];
    v_names      text[];
BEGIN
    IF current_setting('storage.gc.prefixes', true) = '1' THEN
        RETURN NULL;
    END IF;

    PERFORM set_config('storage.gc.prefixes', '1', true);

    SELECT COALESCE(array_agg(d.bucket_id), '{}'),
           COALESCE(array_agg(d.name), '{}')
    INTO v_bucket_ids, v_names
    FROM deleted AS d
    WHERE d.name <> '';

    PERFORM storage.lock_top_prefixes(v_bucket_ids, v_names);
    PERFORM storage.delete_leaf_prefixes(v_bucket_ids, v_names);

    RETURN NULL;
END;
$$;


ALTER FUNCTION "storage"."prefixes_delete_cleanup"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."prefixes_insert_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    RETURN NEW;
END;
$$;


ALTER FUNCTION "storage"."prefixes_insert_trigger"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search"("prefix" "text", "bucketname" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "offsets" integer DEFAULT 0, "search" "text" DEFAULT ''::"text", "sortcolumn" "text" DEFAULT 'name'::"text", "sortorder" "text" DEFAULT 'asc'::"text") RETURNS TABLE("name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
declare
    can_bypass_rls BOOLEAN;
begin
    SELECT rolbypassrls
    INTO can_bypass_rls
    FROM pg_roles
    WHERE rolname = coalesce(nullif(current_setting('role', true), 'none'), current_user);

    IF can_bypass_rls THEN
        RETURN QUERY SELECT * FROM storage.search_v1_optimised(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    ELSE
        RETURN QUERY SELECT * FROM storage.search_legacy_v1(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    END IF;
end;
$$;


ALTER FUNCTION "storage"."search"("prefix" "text", "bucketname" "text", "limits" integer, "levels" integer, "offsets" integer, "search" "text", "sortcolumn" "text", "sortorder" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search_legacy_v1"("prefix" "text", "bucketname" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "offsets" integer DEFAULT 0, "search" "text" DEFAULT ''::"text", "sortcolumn" "text" DEFAULT 'name'::"text", "sortorder" "text" DEFAULT 'asc'::"text") RETURNS TABLE("name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select path_tokens[$1] as folder
           from storage.objects
             where objects.name ilike $2 || $3 || ''%''
               and bucket_id = $4
               and array_length(objects.path_tokens, 1) <> $1
           group by folder
           order by folder ' || v_sort_order || '
     )
     (select folder as "name",
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[$1] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where objects.name ilike $2 || $3 || ''%''
       and bucket_id = $4
       and array_length(objects.path_tokens, 1) = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


ALTER FUNCTION "storage"."search_legacy_v1"("prefix" "text", "bucketname" "text", "limits" integer, "levels" integer, "offsets" integer, "search" "text", "sortcolumn" "text", "sortorder" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search_v1_optimised"("prefix" "text", "bucketname" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "offsets" integer DEFAULT 0, "search" "text" DEFAULT ''::"text", "sortcolumn" "text" DEFAULT 'name'::"text", "sortorder" "text" DEFAULT 'asc'::"text") RETURNS TABLE("name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select (string_to_array(name, ''/''))[level] as name
           from storage.prefixes
             where lower(prefixes.name) like lower($2 || $3) || ''%''
               and bucket_id = $4
               and level = $1
           order by name ' || v_sort_order || '
     )
     (select name,
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[level] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where lower(objects.name) like lower($2 || $3) || ''%''
       and bucket_id = $4
       and level = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


ALTER FUNCTION "storage"."search_v1_optimised"("prefix" "text", "bucketname" "text", "limits" integer, "levels" integer, "offsets" integer, "search" "text", "sortcolumn" "text", "sortorder" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search_v2"("prefix" "text", "bucket_name" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "start_after" "text" DEFAULT ''::"text", "sort_order" "text" DEFAULT 'asc'::"text", "sort_column" "text" DEFAULT 'name'::"text", "sort_column_after" "text" DEFAULT ''::"text") RETURNS TABLE("key" "text", "name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
    sort_col text;
    sort_ord text;
    cursor_op text;
    cursor_expr text;
    sort_expr text;
BEGIN
    -- Validate sort_order
    sort_ord := lower(sort_order);
    IF sort_ord NOT IN ('asc', 'desc') THEN
        sort_ord := 'asc';
    END IF;

    -- Determine cursor comparison operator
    IF sort_ord = 'asc' THEN
        cursor_op := '>';
    ELSE
        cursor_op := '<';
    END IF;
    
    sort_col := lower(sort_column);
    -- Validate sort column  
    IF sort_col IN ('updated_at', 'created_at') THEN
        cursor_expr := format(
            '($5 = '''' OR ROW(date_trunc(''milliseconds'', %I), name COLLATE "C") %s ROW(COALESCE(NULLIF($6, '''')::timestamptz, ''epoch''::timestamptz), $5))',
            sort_col, cursor_op
        );
        sort_expr := format(
            'COALESCE(date_trunc(''milliseconds'', %I), ''epoch''::timestamptz) %s, name COLLATE "C" %s',
            sort_col, sort_ord, sort_ord
        );
    ELSE
        cursor_expr := format('($5 = '''' OR name COLLATE "C" %s $5)', cursor_op);
        sort_expr := format('name COLLATE "C" %s', sort_ord);
    END IF;

    RETURN QUERY EXECUTE format(
        $sql$
        SELECT * FROM (
            (
                SELECT
                    split_part(name, '/', $4) AS key,
                    name,
                    NULL::uuid AS id,
                    updated_at,
                    created_at,
                    NULL::timestamptz AS last_accessed_at,
                    NULL::jsonb AS metadata
                FROM storage.prefixes
                WHERE name COLLATE "C" LIKE $1 || '%%'
                    AND bucket_id = $2
                    AND level = $4
                    AND %s
                ORDER BY %s
                LIMIT $3
            )
            UNION ALL
            (
                SELECT
                    split_part(name, '/', $4) AS key,
                    name,
                    id,
                    updated_at,
                    created_at,
                    last_accessed_at,
                    metadata
                FROM storage.objects
                WHERE name COLLATE "C" LIKE $1 || '%%'
                    AND bucket_id = $2
                    AND level = $4
                    AND %s
                ORDER BY %s
                LIMIT $3
            )
        ) obj
        ORDER BY %s
        LIMIT $3
        $sql$,
        cursor_expr,    -- prefixes WHERE
        sort_expr,      -- prefixes ORDER BY
        cursor_expr,    -- objects WHERE
        sort_expr,      -- objects ORDER BY
        sort_expr       -- final ORDER BY
    )
    USING prefix, bucket_name, limits, levels, start_after, sort_column_after;
END;
$_$;


ALTER FUNCTION "storage"."search_v2"("prefix" "text", "bucket_name" "text", "limits" integer, "levels" integer, "start_after" "text", "sort_order" "text", "sort_column" "text", "sort_column_after" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


ALTER FUNCTION "storage"."update_updated_at_column"() OWNER TO "supabase_storage_admin";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "auth"."audit_log_entries" (
    "instance_id" "uuid",
    "id" "uuid" NOT NULL,
    "payload" json,
    "created_at" timestamp with time zone,
    "ip_address" character varying(64) DEFAULT ''::character varying NOT NULL
);


ALTER TABLE "auth"."audit_log_entries" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."audit_log_entries" IS 'Auth: Audit trail for user actions.';



CREATE TABLE IF NOT EXISTS "auth"."flow_state" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid",
    "auth_code" "text" NOT NULL,
    "code_challenge_method" "auth"."code_challenge_method" NOT NULL,
    "code_challenge" "text" NOT NULL,
    "provider_type" "text" NOT NULL,
    "provider_access_token" "text",
    "provider_refresh_token" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "authentication_method" "text" NOT NULL,
    "auth_code_issued_at" timestamp with time zone
);


ALTER TABLE "auth"."flow_state" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."flow_state" IS 'stores metadata for pkce logins';



CREATE TABLE IF NOT EXISTS "auth"."identities" (
    "provider_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "identity_data" "jsonb" NOT NULL,
    "provider" "text" NOT NULL,
    "last_sign_in_at" timestamp with time zone,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "email" "text" GENERATED ALWAYS AS ("lower"(("identity_data" ->> 'email'::"text"))) STORED,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "auth"."identities" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."identities" IS 'Auth: Stores identities associated to a user.';



COMMENT ON COLUMN "auth"."identities"."email" IS 'Auth: Email is a generated column that references the optional email property in the identity_data';



CREATE TABLE IF NOT EXISTS "auth"."instances" (
    "id" "uuid" NOT NULL,
    "uuid" "uuid",
    "raw_base_config" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "auth"."instances" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."instances" IS 'Auth: Manages users across multiple sites.';



CREATE TABLE IF NOT EXISTS "auth"."mfa_amr_claims" (
    "session_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "authentication_method" "text" NOT NULL,
    "id" "uuid" NOT NULL
);


ALTER TABLE "auth"."mfa_amr_claims" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_amr_claims" IS 'auth: stores authenticator method reference claims for multi factor authentication';



CREATE TABLE IF NOT EXISTS "auth"."mfa_challenges" (
    "id" "uuid" NOT NULL,
    "factor_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "verified_at" timestamp with time zone,
    "ip_address" "inet" NOT NULL,
    "otp_code" "text",
    "web_authn_session_data" "jsonb"
);


ALTER TABLE "auth"."mfa_challenges" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_challenges" IS 'auth: stores metadata about challenge requests made';



CREATE TABLE IF NOT EXISTS "auth"."mfa_factors" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "friendly_name" "text",
    "factor_type" "auth"."factor_type" NOT NULL,
    "status" "auth"."factor_status" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "secret" "text",
    "phone" "text",
    "last_challenged_at" timestamp with time zone,
    "web_authn_credential" "jsonb",
    "web_authn_aaguid" "uuid",
    "last_webauthn_challenge_data" "jsonb"
);


ALTER TABLE "auth"."mfa_factors" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_factors" IS 'auth: stores metadata about factors';



COMMENT ON COLUMN "auth"."mfa_factors"."last_webauthn_challenge_data" IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';



CREATE TABLE IF NOT EXISTS "auth"."oauth_authorizations" (
    "id" "uuid" NOT NULL,
    "authorization_id" "text" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "redirect_uri" "text" NOT NULL,
    "scope" "text" NOT NULL,
    "state" "text",
    "resource" "text",
    "code_challenge" "text",
    "code_challenge_method" "auth"."code_challenge_method",
    "response_type" "auth"."oauth_response_type" DEFAULT 'code'::"auth"."oauth_response_type" NOT NULL,
    "status" "auth"."oauth_authorization_status" DEFAULT 'pending'::"auth"."oauth_authorization_status" NOT NULL,
    "authorization_code" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '00:03:00'::interval) NOT NULL,
    "approved_at" timestamp with time zone,
    CONSTRAINT "oauth_authorizations_authorization_code_length" CHECK (("char_length"("authorization_code") <= 255)),
    CONSTRAINT "oauth_authorizations_code_challenge_length" CHECK (("char_length"("code_challenge") <= 128)),
    CONSTRAINT "oauth_authorizations_expires_at_future" CHECK (("expires_at" > "created_at")),
    CONSTRAINT "oauth_authorizations_redirect_uri_length" CHECK (("char_length"("redirect_uri") <= 2048)),
    CONSTRAINT "oauth_authorizations_resource_length" CHECK (("char_length"("resource") <= 2048)),
    CONSTRAINT "oauth_authorizations_scope_length" CHECK (("char_length"("scope") <= 4096)),
    CONSTRAINT "oauth_authorizations_state_length" CHECK (("char_length"("state") <= 4096))
);


ALTER TABLE "auth"."oauth_authorizations" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."oauth_clients" (
    "id" "uuid" NOT NULL,
    "client_secret_hash" "text",
    "registration_type" "auth"."oauth_registration_type" NOT NULL,
    "redirect_uris" "text" NOT NULL,
    "grant_types" "text" NOT NULL,
    "client_name" "text",
    "client_uri" "text",
    "logo_uri" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "client_type" "auth"."oauth_client_type" DEFAULT 'confidential'::"auth"."oauth_client_type" NOT NULL,
    CONSTRAINT "oauth_clients_client_name_length" CHECK (("char_length"("client_name") <= 1024)),
    CONSTRAINT "oauth_clients_client_uri_length" CHECK (("char_length"("client_uri") <= 2048)),
    CONSTRAINT "oauth_clients_logo_uri_length" CHECK (("char_length"("logo_uri") <= 2048))
);


ALTER TABLE "auth"."oauth_clients" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."oauth_consents" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "scopes" "text" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    CONSTRAINT "oauth_consents_revoked_after_granted" CHECK ((("revoked_at" IS NULL) OR ("revoked_at" >= "granted_at"))),
    CONSTRAINT "oauth_consents_scopes_length" CHECK (("char_length"("scopes") <= 2048)),
    CONSTRAINT "oauth_consents_scopes_not_empty" CHECK (("char_length"(TRIM(BOTH FROM "scopes")) > 0))
);


ALTER TABLE "auth"."oauth_consents" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."one_time_tokens" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token_type" "auth"."one_time_token_type" NOT NULL,
    "token_hash" "text" NOT NULL,
    "relates_to" "text" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "one_time_tokens_token_hash_check" CHECK (("char_length"("token_hash") > 0))
);


ALTER TABLE "auth"."one_time_tokens" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."refresh_tokens" (
    "instance_id" "uuid",
    "id" bigint NOT NULL,
    "token" character varying(255),
    "user_id" character varying(255),
    "revoked" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "parent" character varying(255),
    "session_id" "uuid"
);


ALTER TABLE "auth"."refresh_tokens" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."refresh_tokens" IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';



CREATE SEQUENCE IF NOT EXISTS "auth"."refresh_tokens_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "auth"."refresh_tokens_id_seq" OWNER TO "supabase_auth_admin";


ALTER SEQUENCE "auth"."refresh_tokens_id_seq" OWNED BY "auth"."refresh_tokens"."id";



CREATE TABLE IF NOT EXISTS "auth"."saml_providers" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "entity_id" "text" NOT NULL,
    "metadata_xml" "text" NOT NULL,
    "metadata_url" "text",
    "attribute_mapping" "jsonb",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "name_id_format" "text",
    CONSTRAINT "entity_id not empty" CHECK (("char_length"("entity_id") > 0)),
    CONSTRAINT "metadata_url not empty" CHECK ((("metadata_url" = NULL::"text") OR ("char_length"("metadata_url") > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK (("char_length"("metadata_xml") > 0))
);


ALTER TABLE "auth"."saml_providers" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."saml_providers" IS 'Auth: Manages SAML Identity Provider connections.';



CREATE TABLE IF NOT EXISTS "auth"."saml_relay_states" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "request_id" "text" NOT NULL,
    "for_email" "text",
    "redirect_to" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "flow_state_id" "uuid",
    CONSTRAINT "request_id not empty" CHECK (("char_length"("request_id") > 0))
);


ALTER TABLE "auth"."saml_relay_states" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."saml_relay_states" IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';



CREATE TABLE IF NOT EXISTS "auth"."schema_migrations" (
    "version" character varying(255) NOT NULL
);


ALTER TABLE "auth"."schema_migrations" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."schema_migrations" IS 'Auth: Manages updates to the auth system.';



CREATE TABLE IF NOT EXISTS "auth"."sessions" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "factor_id" "uuid",
    "aal" "auth"."aal_level",
    "not_after" timestamp with time zone,
    "refreshed_at" timestamp without time zone,
    "user_agent" "text",
    "ip" "inet",
    "tag" "text",
    "oauth_client_id" "uuid",
    "refresh_token_hmac_key" "text",
    "refresh_token_counter" bigint
);


ALTER TABLE "auth"."sessions" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sessions" IS 'Auth: Stores session data associated to a user.';



COMMENT ON COLUMN "auth"."sessions"."not_after" IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';



COMMENT ON COLUMN "auth"."sessions"."refresh_token_hmac_key" IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';



COMMENT ON COLUMN "auth"."sessions"."refresh_token_counter" IS 'Holds the ID (counter) of the last issued refresh token.';



CREATE TABLE IF NOT EXISTS "auth"."sso_domains" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "domain" "text" NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK (("char_length"("domain") > 0))
);


ALTER TABLE "auth"."sso_domains" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sso_domains" IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';



CREATE TABLE IF NOT EXISTS "auth"."sso_providers" (
    "id" "uuid" NOT NULL,
    "resource_id" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "disabled" boolean,
    CONSTRAINT "resource_id not empty" CHECK ((("resource_id" = NULL::"text") OR ("char_length"("resource_id") > 0)))
);


ALTER TABLE "auth"."sso_providers" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sso_providers" IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';



COMMENT ON COLUMN "auth"."sso_providers"."resource_id" IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';



CREATE TABLE IF NOT EXISTS "auth"."users" (
    "instance_id" "uuid",
    "id" "uuid" NOT NULL,
    "aud" character varying(255),
    "role" character varying(255),
    "email" character varying(255),
    "encrypted_password" character varying(255),
    "email_confirmed_at" timestamp with time zone,
    "invited_at" timestamp with time zone,
    "confirmation_token" character varying(255),
    "confirmation_sent_at" timestamp with time zone,
    "recovery_token" character varying(255),
    "recovery_sent_at" timestamp with time zone,
    "email_change_token_new" character varying(255),
    "email_change" character varying(255),
    "email_change_sent_at" timestamp with time zone,
    "last_sign_in_at" timestamp with time zone,
    "raw_app_meta_data" "jsonb",
    "raw_user_meta_data" "jsonb",
    "is_super_admin" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "phone" "text" DEFAULT NULL::character varying,
    "phone_confirmed_at" timestamp with time zone,
    "phone_change" "text" DEFAULT ''::character varying,
    "phone_change_token" character varying(255) DEFAULT ''::character varying,
    "phone_change_sent_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone GENERATED ALWAYS AS (LEAST("email_confirmed_at", "phone_confirmed_at")) STORED,
    "email_change_token_current" character varying(255) DEFAULT ''::character varying,
    "email_change_confirm_status" smallint DEFAULT 0,
    "banned_until" timestamp with time zone,
    "reauthentication_token" character varying(255) DEFAULT ''::character varying,
    "reauthentication_sent_at" timestamp with time zone,
    "is_sso_user" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "is_anonymous" boolean DEFAULT false NOT NULL,
    CONSTRAINT "users_email_change_confirm_status_check" CHECK ((("email_change_confirm_status" >= 0) AND ("email_change_confirm_status" <= 2)))
);


ALTER TABLE "auth"."users" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."users" IS 'Auth: Stores user login data within a secure schema.';



COMMENT ON COLUMN "auth"."users"."is_sso_user" IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';



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
    "share_count" integer DEFAULT 0,
    "content_type" "text" DEFAULT 'blog'::"text",
    "meta_description" "text",
    "meta_keywords" "text"[],
    "featured" boolean DEFAULT false,
    "related_posts" "uuid"[],
    "cta_type" "text" DEFAULT 'signup'::"text",
    "cta_text" "text",
    "cta_link" "text",
    "view_count" integer DEFAULT 0,
    "avg_read_time_minutes" integer DEFAULT 5,
    "conversion_count" integer DEFAULT 0,
    CONSTRAINT "blog_posts_content_type_check" CHECK (("content_type" = ANY (ARRAY['blog'::"text", 'tutorial'::"text", 'guide'::"text", 'case-study'::"text", 'news'::"text"]))),
    CONSTRAINT "blog_posts_cta_type_check" CHECK (("cta_type" = ANY (ARRAY['signup'::"text", 'feature'::"text", 'pricing'::"text", 'none'::"text"])))
);


ALTER TABLE "public"."blog_posts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."blog_posts"."content_type" IS 'Categorizes content: blog (SEO), tutorial (app feature how-tos), guide (comprehensive), case-study (use cases), news (timely)';



COMMENT ON COLUMN "public"."blog_posts"."cta_type" IS 'Type of call-to-action: signup (main conversion), feature (try specific feature), pricing (subscribe), none';



COMMENT ON COLUMN "public"."blog_posts"."view_count" IS 'Track page views for engagement metrics';



COMMENT ON COLUMN "public"."blog_posts"."conversion_count" IS 'Track how many users signed up from this post';



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


CREATE TABLE IF NOT EXISTS "public"."cascade_deletion_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" "text" NOT NULL,
    "record_id" "uuid" NOT NULL,
    "parent_table" "text" NOT NULL,
    "parent_id" "uuid" NOT NULL,
    "deleted_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cascade_deletion_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_folder_participants" (
    "folder_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "invited_by" "uuid",
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chat_folder_participants_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."chat_folder_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_folders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_public" boolean DEFAULT false,
    CONSTRAINT "chat_folders_name_length" CHECK ((("char_length"("name") > 0) AND ("char_length"("name") <= 100)))
);


ALTER TABLE "public"."chat_folders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversation_caches" (
    "chat_id" "uuid" NOT NULL,
    "cache_name" "text" NOT NULL,
    "system_data_hash" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "expires_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."conversation_caches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversation_summaries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chat_id" "uuid" NOT NULL,
    "summary_text" "text" NOT NULL,
    "turn_range" "text" NOT NULL,
    "message_count" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."conversation_summaries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "meta" "jsonb" DEFAULT '{}'::"jsonb",
    "is_public" boolean DEFAULT false,
    "owner_user_id" "uuid",
    "mode" "text",
    "folder_id" "uuid",
    "turn_count" integer DEFAULT 0,
    "last_summary_at_turn" integer DEFAULT 0,
    "profile_id" "uuid"
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


COMMENT ON TABLE "public"."conversations" IS 'RLS optimized from 11 to 6 policies for faster message broadcasts';



COMMENT ON COLUMN "public"."conversations"."mode" IS 'Chat mode: chat, astro, insight, swiss, profile, or together - single source of truth for conversation type';



COMMENT ON COLUMN "public"."conversations"."profile_id" IS 'Links conversation to user profile for memory tracking - only set when user selects their primary profile';



CREATE TABLE IF NOT EXISTS "public"."conversations_participants" (
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "invited_by" "uuid",
    CONSTRAINT "conversations_participants_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."conversations_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "credits" integer NOT NULL,
    "amount_usd" numeric(10,2),
    "description" "text",
    "reference_id" "text",
    "endpoint" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "credit_transactions_type_check" CHECK (("type" = ANY (ARRAY['purchase'::"text", 'deduct'::"text", 'refund'::"text", 'auto_topup'::"text"])))
);


ALTER TABLE "public"."credit_transactions" OWNER TO "postgres";


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


ALTER SEQUENCE "public"."credit_transactions_id_seq" OWNER TO "postgres";


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


ALTER SEQUENCE "public"."engine_selector_seq" OWNER TO "postgres";


COMMENT ON SEQUENCE "public"."engine_selector_seq" IS 'Used for atomic round-robin selection of AI report engines';



CREATE TABLE IF NOT EXISTS "public"."feature_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "insights_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "therai_calls" integer DEFAULT 0,
    "chat_messages" integer DEFAULT 0,
    "images_generated" integer DEFAULT 0,
    "last_reset_date" "date" DEFAULT CURRENT_DATE NOT NULL
);


ALTER TABLE "public"."feature_usage" OWNER TO "postgres";


COMMENT ON TABLE "public"."feature_usage" IS 'Modular feature usage tracking - one row per user per period with columns for each feature';



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


COMMENT ON TABLE "public"."legal_documents" IS 'Stores comprehensive legal documents including Terms of Service and Privacy Policy, specifically tailored for Therai''s AI astrology platform';



CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chat_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "text" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "client_msg_id" "uuid",
    "status" "text" DEFAULT 'complete'::"text",
    "context_injected" boolean DEFAULT false,
    "message_number" integer DEFAULT 1 NOT NULL,
    "mode" "text" DEFAULT 'chat'::"text",
    "user_id" "uuid",
    "user_name" "text",
    "archived_at" timestamp with time zone,
    CONSTRAINT "messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text", 'system'::"text"]))),
    CONSTRAINT "messages_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'streaming'::"text", 'complete'::"text", 'failed'::"text"])))
);

ALTER TABLE ONLY "public"."messages" REPLICA IDENTITY FULL;


ALTER TABLE "public"."messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."messages" IS 'Messages table - realtime disabled, using broadcast events via unified channel for WebSocket optimization';



COMMENT ON COLUMN "public"."messages"."mode" IS 'Chat mode when this message was sent (chat, astro, etc.)';



CREATE OR REPLACE VIEW "public"."message_archival_stats" AS
 SELECT "count"(*) FILTER (WHERE ("archived_at" IS NOT NULL)) AS "archived_messages",
    "count"(*) FILTER (WHERE ("archived_at" IS NULL)) AS "active_messages",
    "count"(DISTINCT "chat_id") FILTER (WHERE ("archived_at" IS NOT NULL)) AS "conversations_with_archived",
    "min"("archived_at") AS "oldest_archive_date",
    "max"("archived_at") AS "latest_archive_date"
   FROM "public"."messages";


ALTER VIEW "public"."message_archival_stats" OWNER TO "postgres";


COMMENT ON VIEW "public"."message_archival_stats" IS 'Statistics on message archival for monitoring database growth';



CREATE TABLE IF NOT EXISTS "public"."password_reset_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token_hash" "text" NOT NULL,
    "email" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."password_reset_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plan_limits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_id" "text" NOT NULL,
    "plan_name" "text" NOT NULL,
    "voice_seconds_limit" integer,
    "image_generation_daily_limit" integer,
    "therai_calls_limit" integer,
    "insights_limit" integer,
    "has_together_mode" boolean DEFAULT true,
    "has_voice_mode" boolean DEFAULT true,
    "has_image_generation" boolean DEFAULT true,
    "has_priority_support" boolean DEFAULT false,
    "has_early_access" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "chat_messages_daily_limit" integer
);


ALTER TABLE "public"."plan_limits" OWNER TO "postgres";


COMMENT ON TABLE "public"."plan_limits" IS 'Single source of truth for subscription plan limits. Change limits here without redeploying code.';



COMMENT ON COLUMN "public"."plan_limits"."chat_messages_daily_limit" IS 'Daily limit for chat messages. NULL = unlimited. Free users: 3/day.';



CREATE TABLE IF NOT EXISTS "public"."price_list" (
    "id" "text" NOT NULL,
    "endpoint" "text",
    "report_type" "text",
    "name" "text" NOT NULL,
    "description" "text",
    "unit_price_usd" numeric(6,2) NOT NULL,
    "created_at" timestamp with time zone,
    "product_code" "text",
    "is_ai" "text",
    "stripe_price_id" "text"
);


ALTER TABLE "public"."price_list" OWNER TO "postgres";


COMMENT ON TABLE "public"."price_list" IS 'Product pricing catalog - Test ($0.50), Growth ($10/month), Premium ($18/month with voice)';



COMMENT ON COLUMN "public"."price_list"."stripe_price_id" IS 'Stripe Price ID for subscription/payment processing';



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
    "display_name" "text",
    "trial_end_date" timestamp with time zone,
    "has_seen_subscription_page" boolean DEFAULT false NOT NULL,
    "last_share_reward_date" "date",
    "subscription_end_date" timestamp with time zone
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."verification_token" IS 'Custom email verification token generated during signup';



COMMENT ON COLUMN "public"."profiles"."display_name" IS 'User-friendly display name for the profile';



COMMENT ON COLUMN "public"."profiles"."trial_end_date" IS '1-week free trial end date. After this, free users can only access Together Mode (no AI features).';



COMMENT ON COLUMN "public"."profiles"."has_seen_subscription_page" IS 'Flag set to true after user has seen the subscription page during onboarding. Used to control when starter questions are shown.';



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


ALTER SEQUENCE "public"."swissdebuglogs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."swissdebuglogs_id_seq" OWNED BY "public"."swissdebuglogs"."id";



CREATE TABLE IF NOT EXISTS "public"."system_config" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "description" "text",
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."system_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."system_config" IS 'System-wide configuration flags and settings';



COMMENT ON COLUMN "public"."system_config"."value" IS 'JSONB value allows flexible configuration schemas';



CREATE TABLE IF NOT EXISTS "public"."system_prompts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category" "text" NOT NULL,
    "subcategory" "text" NOT NULL,
    "prompt_text" "text" NOT NULL,
    "display_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "system_prompts_category_check" CHECK (("category" = ANY (ARRAY['mindset'::"text", 'health'::"text", 'wealth'::"text", 'soul'::"text", 'career'::"text", 'compatibility'::"text", 'chart_type'::"text"])))
);


ALTER TABLE "public"."system_prompts" OWNER TO "postgres";


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
    "credits" integer,
    "is_auto_topup" boolean DEFAULT false,
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


COMMENT ON TABLE "public"."translator_logs" IS 'Logs from translator-edge function. Users can read their own logs via chat_id ownership.';



COMMENT ON COLUMN "public"."translator_logs"."google_geo" IS 'Flag indicating if Google Geocoding API was used';



COMMENT ON COLUMN "public"."translator_logs"."chat_id" IS 'Context ID: can be conversation_id (astro mode), user_id (profile flow), or report_id (insights)';



CREATE TABLE IF NOT EXISTS "public"."user_credits" (
    "user_id" "uuid" NOT NULL,
    "credits" integer DEFAULT 0 NOT NULL,
    "auto_topup_enabled" boolean DEFAULT false,
    "auto_topup_threshold" integer DEFAULT 7,
    "auto_topup_amount" integer DEFAULT 34,
    "last_updated" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
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


CREATE TABLE IF NOT EXISTS "public"."user_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "chat_id" "uuid",
    "message_id" "uuid",
    "image_url" "text" NOT NULL,
    "image_path" "text",
    "prompt" "text",
    "model" "text",
    "size" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_images" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_images" IS 'Backfilled from messages and image_generation_log - all user images now persist even after chat deletion';



COMMENT ON COLUMN "public"."user_images"."chat_id" IS 'Nullable - chat may be deleted but image persists';



COMMENT ON COLUMN "public"."user_images"."message_id" IS 'Nullable - message may be deleted but image persists';



CREATE TABLE IF NOT EXISTS "public"."user_memory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "conversation_id" "uuid",
    "source_message_id" "uuid",
    "turn_index" integer,
    "memory_text" "text" NOT NULL,
    "memory_type" "public"."memory_type" NOT NULL,
    "confidence_score" numeric(4,3) DEFAULT 0.800,
    "astrological_context" "jsonb",
    "origin_mode" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_referenced_at" timestamp with time zone,
    "reference_count" smallint DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "deleted_at" timestamp with time zone,
    "canonical_hash" "text",
    "memory_metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "user_memory_confidence_score_check" CHECK ((("confidence_score" >= (0)::numeric) AND ("confidence_score" <= (1)::numeric)))
);


ALTER TABLE "public"."user_memory" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_memory" IS 'Stores individual memories extracted from profile-based conversations';



COMMENT ON COLUMN "public"."user_memory"."source_message_id" IS 'Links to the message that created this memory for traceability';



COMMENT ON COLUMN "public"."user_memory"."turn_index" IS 'Conversation turn number when memory was created';



COMMENT ON COLUMN "public"."user_memory"."origin_mode" IS 'Conversation mode: chat|astro|profile|together|swiss';



COMMENT ON COLUMN "public"."user_memory"."deleted_at" IS 'Soft delete timestamp for GDPR compliance';



COMMENT ON COLUMN "public"."user_memory"."canonical_hash" IS 'SHA-256 hash of canonicalized memory text for fast duplicate detection';



COMMENT ON COLUMN "public"."user_memory"."memory_metadata" IS 'JSONB metadata: time_horizon, value_score, rationale, extractor info';



CREATE TABLE IF NOT EXISTS "public"."user_memory_monthly_summaries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "year" smallint NOT NULL,
    "month" smallint NOT NULL,
    "emotional_summary" "text" NOT NULL,
    "cognitive_summary" "text",
    "key_themes" "text"[],
    "dominant_transits" "jsonb",
    "planetary_influences" "jsonb",
    "conversation_count" integer DEFAULT 0,
    "weekly_summaries_used" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_memory_monthly_summaries_month_check" CHECK ((("month" >= 1) AND ("month" <= 12)))
);


ALTER TABLE "public"."user_memory_monthly_summaries" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_memory_monthly_summaries" IS 'Monthly summaries synthesized from weekly summaries for long-term pattern tracking';



COMMENT ON COLUMN "public"."user_memory_monthly_summaries"."weekly_summaries_used" IS 'Number of weekly summaries used to generate this monthly summary';



CREATE TABLE IF NOT EXISTS "public"."user_memory_weekly_summaries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "year" smallint NOT NULL,
    "week_number" smallint NOT NULL,
    "week_start_date" "date" NOT NULL,
    "week_end_date" "date" NOT NULL,
    "emotional_summary" "text" NOT NULL,
    "key_themes" "text"[],
    "dominant_patterns" "text"[],
    "conversation_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_memory_weekly_summaries_week_number_check" CHECK ((("week_number" >= 1) AND ("week_number" <= 53)))
);


ALTER TABLE "public"."user_memory_weekly_summaries" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_memory_weekly_summaries" IS 'Weekly energy summaries synthesized from 4-turn conversation summaries';



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
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."user_profile_list" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_profile_list" IS 'Stores saved birth data profiles for quick reuse in forms. Each person (primary or secondary) gets their own row.';



COMMENT ON COLUMN "public"."user_profile_list"."profile_name" IS 'User-friendly name for this saved profile';



COMMENT ON COLUMN "public"."user_profile_list"."name" IS 'Person''s actual name';



COMMENT ON COLUMN "public"."user_profile_list"."birth_date" IS 'Birth date in YYYY-MM-DD format';



COMMENT ON COLUMN "public"."user_profile_list"."birth_time" IS 'Birth time in HH:MM format';



COMMENT ON COLUMN "public"."user_profile_list"."birth_location" IS 'Full location name as entered by user';



COMMENT ON COLUMN "public"."user_profile_list"."birth_place_id" IS 'Google Places API place_id for precise location matching';



COMMENT ON COLUMN "public"."user_profile_list"."is_primary" IS 'Identifies the user''s main profile used for Together Mode and automated features like daily nudges';



CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."user_role" DEFAULT 'user'::"public"."user_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."voice_usage" (
    "user_id" "uuid" NOT NULL,
    "seconds_used" integer DEFAULT 0 NOT NULL,
    "billing_cycle_start" "date" NOT NULL,
    "billing_cycle_end" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."voice_usage" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "storage"."buckets" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "owner" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "public" boolean DEFAULT false,
    "avif_autodetection" boolean DEFAULT false,
    "file_size_limit" bigint,
    "allowed_mime_types" "text"[],
    "owner_id" "text",
    "type" "storage"."buckettype" DEFAULT 'STANDARD'::"storage"."buckettype" NOT NULL
);


ALTER TABLE "storage"."buckets" OWNER TO "supabase_storage_admin";


COMMENT ON COLUMN "storage"."buckets"."owner" IS 'Field is deprecated, use owner_id instead';



CREATE TABLE IF NOT EXISTS "storage"."buckets_analytics" (
    "id" "text" NOT NULL,
    "type" "storage"."buckettype" DEFAULT 'ANALYTICS'::"storage"."buckettype" NOT NULL,
    "format" "text" DEFAULT 'ICEBERG'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "storage"."buckets_analytics" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."migrations" (
    "id" integer NOT NULL,
    "name" character varying(100) NOT NULL,
    "hash" character varying(40) NOT NULL,
    "executed_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "storage"."migrations" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."objects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bucket_id" "text",
    "name" "text",
    "owner" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_accessed_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb",
    "path_tokens" "text"[] GENERATED ALWAYS AS ("string_to_array"("name", '/'::"text")) STORED,
    "version" "text",
    "owner_id" "text",
    "user_metadata" "jsonb",
    "level" integer
);


ALTER TABLE "storage"."objects" OWNER TO "supabase_storage_admin";


COMMENT ON COLUMN "storage"."objects"."owner" IS 'Field is deprecated, use owner_id instead';



CREATE TABLE IF NOT EXISTS "storage"."prefixes" (
    "bucket_id" "text" NOT NULL,
    "name" "text" NOT NULL COLLATE "pg_catalog"."C",
    "level" integer GENERATED ALWAYS AS ("storage"."get_level"("name")) STORED NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "storage"."prefixes" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."s3_multipart_uploads" (
    "id" "text" NOT NULL,
    "in_progress_size" bigint DEFAULT 0 NOT NULL,
    "upload_signature" "text" NOT NULL,
    "bucket_id" "text" NOT NULL,
    "key" "text" NOT NULL COLLATE "pg_catalog"."C",
    "version" "text" NOT NULL,
    "owner_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_metadata" "jsonb"
);


ALTER TABLE "storage"."s3_multipart_uploads" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."s3_multipart_uploads_parts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "upload_id" "text" NOT NULL,
    "size" bigint DEFAULT 0 NOT NULL,
    "part_number" integer NOT NULL,
    "bucket_id" "text" NOT NULL,
    "key" "text" NOT NULL COLLATE "pg_catalog"."C",
    "etag" "text" NOT NULL,
    "owner_id" "text",
    "version" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "storage"."s3_multipart_uploads_parts" OWNER TO "supabase_storage_admin";


ALTER TABLE ONLY "auth"."refresh_tokens" ALTER COLUMN "id" SET DEFAULT "nextval"('"auth"."refresh_tokens_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."payment_method" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."credit_transactions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."swissdebuglogs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."swissdebuglogs_id_seq"'::"regclass");



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "amr_id_pk" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."audit_log_entries"
    ADD CONSTRAINT "audit_log_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."flow_state"
    ADD CONSTRAINT "flow_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_provider_id_provider_unique" UNIQUE ("provider_id", "provider");



ALTER TABLE ONLY "auth"."instances"
    ADD CONSTRAINT "instances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "mfa_amr_claims_session_id_authentication_method_pkey" UNIQUE ("session_id", "authentication_method");



ALTER TABLE ONLY "auth"."mfa_challenges"
    ADD CONSTRAINT "mfa_challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_last_challenged_at_key" UNIQUE ("last_challenged_at");



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_authorization_code_key" UNIQUE ("authorization_code");



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_authorization_id_key" UNIQUE ("authorization_id");



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_clients"
    ADD CONSTRAINT "oauth_clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_user_client_unique" UNIQUE ("user_id", "client_id");



ALTER TABLE ONLY "auth"."one_time_tokens"
    ADD CONSTRAINT "one_time_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_token_unique" UNIQUE ("token");



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_entity_id_key" UNIQUE ("entity_id");



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."schema_migrations"
    ADD CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("version");



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."sso_domains"
    ADD CONSTRAINT "sso_domains_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."sso_providers"
    ADD CONSTRAINT "sso_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."users"
    ADD CONSTRAINT "users_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "auth"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."cascade_deletion_log"
    ADD CONSTRAINT "cascade_deletion_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_folder_participants"
    ADD CONSTRAINT "chat_folder_participants_pkey" PRIMARY KEY ("folder_id", "user_id");



ALTER TABLE ONLY "public"."chat_folders"
    ADD CONSTRAINT "chat_folders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_caches"
    ADD CONSTRAINT "conversation_caches_pkey" PRIMARY KEY ("chat_id");



ALTER TABLE ONLY "public"."conversation_summaries"
    ADD CONSTRAINT "conversation_summaries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations_participants"
    ADD CONSTRAINT "conversations_participants_pkey" PRIMARY KEY ("conversation_id", "user_id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_method"
    ADD CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_pkey1" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."feature_usage"
    ADD CONSTRAINT "feature_usage_pkey" PRIMARY KEY ("user_id");



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



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."plan_limits"
    ADD CONSTRAINT "plan_limits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_limits"
    ADD CONSTRAINT "plan_limits_plan_id_key" UNIQUE ("plan_id");



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



ALTER TABLE ONLY "public"."system_config"
    ADD CONSTRAINT "system_config_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."system_prompts"
    ADD CONSTRAINT "system_prompts_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."user_credits"
    ADD CONSTRAINT "user_credits_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_errors"
    ADD CONSTRAINT "user_errors_guest_report_id_key" UNIQUE ("guest_report_id");



ALTER TABLE ONLY "public"."user_errors"
    ADD CONSTRAINT "user_errors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_images"
    ADD CONSTRAINT "user_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_memory_monthly_summaries"
    ADD CONSTRAINT "user_memory_monthly_summaries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_memory_monthly_summaries"
    ADD CONSTRAINT "user_memory_monthly_summaries_user_id_profile_id_year_month_key" UNIQUE ("user_id", "profile_id", "year", "month");



ALTER TABLE ONLY "public"."user_memory"
    ADD CONSTRAINT "user_memory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_memory_weekly_summaries"
    ADD CONSTRAINT "user_memory_weekly_summaries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_memory_weekly_summaries"
    ADD CONSTRAINT "user_memory_weekly_summaries_user_id_profile_id_year_week_n_key" UNIQUE ("user_id", "profile_id", "year", "week_number");



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



ALTER TABLE ONLY "public"."voice_usage"
    ADD CONSTRAINT "voice_usage_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."website_templates"
    ADD CONSTRAINT "website_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."buckets_analytics"
    ADD CONSTRAINT "buckets_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."buckets"
    ADD CONSTRAINT "buckets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."migrations"
    ADD CONSTRAINT "migrations_name_key" UNIQUE ("name");



ALTER TABLE ONLY "storage"."migrations"
    ADD CONSTRAINT "migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."objects"
    ADD CONSTRAINT "objects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."prefixes"
    ADD CONSTRAINT "prefixes_pkey" PRIMARY KEY ("bucket_id", "level", "name");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads"
    ADD CONSTRAINT "s3_multipart_uploads_pkey" PRIMARY KEY ("id");



CREATE INDEX "audit_logs_instance_id_idx" ON "auth"."audit_log_entries" USING "btree" ("instance_id");



CREATE UNIQUE INDEX "confirmation_token_idx" ON "auth"."users" USING "btree" ("confirmation_token") WHERE (("confirmation_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE UNIQUE INDEX "email_change_token_current_idx" ON "auth"."users" USING "btree" ("email_change_token_current") WHERE (("email_change_token_current")::"text" !~ '^[0-9 ]*$'::"text");



CREATE UNIQUE INDEX "email_change_token_new_idx" ON "auth"."users" USING "btree" ("email_change_token_new") WHERE (("email_change_token_new")::"text" !~ '^[0-9 ]*$'::"text");



CREATE INDEX "factor_id_created_at_idx" ON "auth"."mfa_factors" USING "btree" ("user_id", "created_at");



CREATE INDEX "flow_state_created_at_idx" ON "auth"."flow_state" USING "btree" ("created_at" DESC);



CREATE INDEX "identities_email_idx" ON "auth"."identities" USING "btree" ("email" "text_pattern_ops");



COMMENT ON INDEX "auth"."identities_email_idx" IS 'Auth: Ensures indexed queries on the email column';



CREATE INDEX "identities_user_id_idx" ON "auth"."identities" USING "btree" ("user_id");



CREATE INDEX "idx_auth_code" ON "auth"."flow_state" USING "btree" ("auth_code");



CREATE INDEX "idx_user_id_auth_method" ON "auth"."flow_state" USING "btree" ("user_id", "authentication_method");



CREATE INDEX "mfa_challenge_created_at_idx" ON "auth"."mfa_challenges" USING "btree" ("created_at" DESC);



CREATE UNIQUE INDEX "mfa_factors_user_friendly_name_unique" ON "auth"."mfa_factors" USING "btree" ("friendly_name", "user_id") WHERE (TRIM(BOTH FROM "friendly_name") <> ''::"text");



CREATE INDEX "mfa_factors_user_id_idx" ON "auth"."mfa_factors" USING "btree" ("user_id");



CREATE INDEX "oauth_auth_pending_exp_idx" ON "auth"."oauth_authorizations" USING "btree" ("expires_at") WHERE ("status" = 'pending'::"auth"."oauth_authorization_status");



CREATE INDEX "oauth_clients_deleted_at_idx" ON "auth"."oauth_clients" USING "btree" ("deleted_at");



CREATE INDEX "oauth_consents_active_client_idx" ON "auth"."oauth_consents" USING "btree" ("client_id") WHERE ("revoked_at" IS NULL);



CREATE INDEX "oauth_consents_active_user_client_idx" ON "auth"."oauth_consents" USING "btree" ("user_id", "client_id") WHERE ("revoked_at" IS NULL);



CREATE INDEX "oauth_consents_user_order_idx" ON "auth"."oauth_consents" USING "btree" ("user_id", "granted_at" DESC);



CREATE INDEX "one_time_tokens_relates_to_hash_idx" ON "auth"."one_time_tokens" USING "hash" ("relates_to");



CREATE INDEX "one_time_tokens_token_hash_hash_idx" ON "auth"."one_time_tokens" USING "hash" ("token_hash");



CREATE UNIQUE INDEX "one_time_tokens_user_id_token_type_key" ON "auth"."one_time_tokens" USING "btree" ("user_id", "token_type");



CREATE UNIQUE INDEX "reauthentication_token_idx" ON "auth"."users" USING "btree" ("reauthentication_token") WHERE (("reauthentication_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE UNIQUE INDEX "recovery_token_idx" ON "auth"."users" USING "btree" ("recovery_token") WHERE (("recovery_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE INDEX "refresh_tokens_instance_id_idx" ON "auth"."refresh_tokens" USING "btree" ("instance_id");



CREATE INDEX "refresh_tokens_instance_id_user_id_idx" ON "auth"."refresh_tokens" USING "btree" ("instance_id", "user_id");



CREATE INDEX "refresh_tokens_parent_idx" ON "auth"."refresh_tokens" USING "btree" ("parent");



CREATE INDEX "refresh_tokens_session_id_revoked_idx" ON "auth"."refresh_tokens" USING "btree" ("session_id", "revoked");



CREATE INDEX "refresh_tokens_updated_at_idx" ON "auth"."refresh_tokens" USING "btree" ("updated_at" DESC);



CREATE INDEX "saml_providers_sso_provider_id_idx" ON "auth"."saml_providers" USING "btree" ("sso_provider_id");



CREATE INDEX "saml_relay_states_created_at_idx" ON "auth"."saml_relay_states" USING "btree" ("created_at" DESC);



CREATE INDEX "saml_relay_states_for_email_idx" ON "auth"."saml_relay_states" USING "btree" ("for_email");



CREATE INDEX "saml_relay_states_sso_provider_id_idx" ON "auth"."saml_relay_states" USING "btree" ("sso_provider_id");



CREATE INDEX "sessions_not_after_idx" ON "auth"."sessions" USING "btree" ("not_after" DESC);



CREATE INDEX "sessions_oauth_client_id_idx" ON "auth"."sessions" USING "btree" ("oauth_client_id");



CREATE INDEX "sessions_user_id_idx" ON "auth"."sessions" USING "btree" ("user_id");



CREATE UNIQUE INDEX "sso_domains_domain_idx" ON "auth"."sso_domains" USING "btree" ("lower"("domain"));



CREATE INDEX "sso_domains_sso_provider_id_idx" ON "auth"."sso_domains" USING "btree" ("sso_provider_id");



CREATE UNIQUE INDEX "sso_providers_resource_id_idx" ON "auth"."sso_providers" USING "btree" ("lower"("resource_id"));



CREATE INDEX "sso_providers_resource_id_pattern_idx" ON "auth"."sso_providers" USING "btree" ("resource_id" "text_pattern_ops");



CREATE UNIQUE INDEX "unique_phone_factor_per_user" ON "auth"."mfa_factors" USING "btree" ("user_id", "phone");



CREATE INDEX "user_id_created_at_idx" ON "auth"."sessions" USING "btree" ("user_id", "created_at");



CREATE UNIQUE INDEX "users_email_partial_key" ON "auth"."users" USING "btree" ("email") WHERE ("is_sso_user" = false);



COMMENT ON INDEX "auth"."users_email_partial_key" IS 'Auth: A partial unique index that applies only when is_sso_user is false';



CREATE INDEX "users_instance_id_email_idx" ON "auth"."users" USING "btree" ("instance_id", "lower"(("email")::"text"));



CREATE INDEX "users_instance_id_idx" ON "auth"."users" USING "btree" ("instance_id");



CREATE INDEX "users_is_anonymous_idx" ON "auth"."users" USING "btree" ("is_anonymous");



CREATE INDEX "credit_transactions_email_idx" ON "public"."payment_method" USING "btree" ("email");



CREATE INDEX "credit_transactions_stripe_customer_id_idx" ON "public"."payment_method" USING "btree" ("stripe_customer_id");



CREATE INDEX "credit_transactions_user_ts_idx" ON "public"."payment_method" USING "btree" ("user_id", "ts" DESC);



CREATE INDEX "idx_blog_posts_content_type" ON "public"."blog_posts" USING "btree" ("content_type") WHERE ("published" = true);



CREATE INDEX "idx_blog_posts_featured" ON "public"."blog_posts" USING "btree" ("featured") WHERE (("published" = true) AND ("featured" = true));



CREATE INDEX "idx_blog_posts_tags" ON "public"."blog_posts" USING "gin" ("tags") WHERE ("published" = true);



CREATE INDEX "idx_caches_expires" ON "public"."conversation_caches" USING "btree" ("expires_at");



CREATE INDEX "idx_chat_folder_participants_folder_id" ON "public"."chat_folder_participants" USING "btree" ("folder_id");



CREATE INDEX "idx_chat_folder_participants_user_id" ON "public"."chat_folder_participants" USING "btree" ("user_id");



CREATE INDEX "idx_chat_folders_is_public" ON "public"."chat_folders" USING "btree" ("is_public") WHERE ("is_public" = true);



CREATE INDEX "idx_chat_folders_user_id" ON "public"."chat_folders" USING "btree" ("user_id");



CREATE INDEX "idx_conversation_caches_chat_id" ON "public"."conversation_caches" USING "btree" ("chat_id", "expires_at");



CREATE INDEX "idx_conversation_summaries_latest" ON "public"."conversation_summaries" USING "btree" ("chat_id", "created_at" DESC);



CREATE INDEX "idx_conversations_created_at" ON "public"."conversations" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_conversations_folder_id" ON "public"."conversations" USING "btree" ("folder_id");



CREATE INDEX "idx_conversations_participants_conversation_id" ON "public"."conversations_participants" USING "btree" ("conversation_id");



CREATE INDEX "idx_conversations_participants_user_id" ON "public"."conversations_participants" USING "btree" ("user_id");



CREATE INDEX "idx_conversations_profile_id" ON "public"."conversations" USING "btree" ("profile_id");



CREATE INDEX "idx_conversations_user_id" ON "public"."conversations" USING "btree" ("user_id");



CREATE INDEX "idx_conversations_user_mode_created" ON "public"."conversations" USING "btree" ("user_id", "mode", "created_at" DESC);



CREATE INDEX "idx_conversations_user_profile" ON "public"."conversations" USING "btree" ("user_id", "profile_id") WHERE ("profile_id" IS NOT NULL);



CREATE INDEX "idx_credit_transactions_user" ON "public"."credit_transactions" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_insights_created_at" ON "public"."insights" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_insights_is_ready" ON "public"."insights" USING "btree" ("is_ready");



CREATE INDEX "idx_insights_status" ON "public"."insights" USING "btree" ("status");



CREATE INDEX "idx_insights_user_id" ON "public"."insights" USING "btree" ("user_id");



CREATE INDEX "idx_ip_allowlist_expires_at" ON "public"."ip_allowlist" USING "btree" ("expires_at");



CREATE INDEX "idx_journal_entries_client_id" ON "public"."journal_entries" USING "btree" ("client_id");



CREATE INDEX "idx_journal_entries_coach_id" ON "public"."journal_entries" USING "btree" ("coach_id");



CREATE INDEX "idx_messages_archived" ON "public"."messages" USING "btree" ("archived_at") WHERE ("archived_at" IS NOT NULL);



CREATE INDEX "idx_messages_chat_role_created_desc" ON "public"."messages" USING "btree" ("chat_id", "role", "created_at" DESC);



CREATE INDEX "idx_messages_context_injected" ON "public"."messages" USING "btree" ("chat_id", "context_injected") WHERE ("context_injected" = true);



CREATE INDEX "idx_messages_history_optimized" ON "public"."messages" USING "btree" ("chat_id", "created_at" DESC) WHERE (("role" <> 'system'::"text") AND ("status" = 'complete'::"text") AND ("text" IS NOT NULL) AND ("text" <> ''::"text"));



CREATE INDEX "idx_messages_system_optimized" ON "public"."messages" USING "btree" ("chat_id", "created_at") WHERE (("role" = 'system'::"text") AND ("status" = 'complete'::"text") AND ("text" IS NOT NULL) AND ("text" <> ''::"text"));



CREATE INDEX "idx_monthly_summaries_user" ON "public"."user_memory_monthly_summaries" USING "btree" ("user_id", "year" DESC, "month" DESC);



CREATE INDEX "idx_part_conv_user" ON "public"."conversations_participants" USING "btree" ("conversation_id", "user_id");



CREATE INDEX "idx_password_reset_tokens_expires_at" ON "public"."password_reset_tokens" USING "btree" ("expires_at");



CREATE INDEX "idx_password_reset_tokens_token_hash" ON "public"."password_reset_tokens" USING "btree" ("token_hash");



CREATE INDEX "idx_payment_method_user_active" ON "public"."payment_method" USING "btree" ("user_id", "active");



CREATE INDEX "idx_plan_limits_plan_id" ON "public"."plan_limits" USING "btree" ("plan_id") WHERE ("is_active" = true);



CREATE INDEX "idx_profiles_has_profile_setup" ON "public"."profiles" USING "btree" ("has_profile_setup");



CREATE INDEX "idx_profiles_has_seen_subscription_page" ON "public"."profiles" USING "btree" ("has_seen_subscription_page");



CREATE INDEX "idx_profiles_stripe_customer_id" ON "public"."profiles" USING "btree" ("stripe_customer_id");



CREATE INDEX "idx_profiles_stripe_subscription_id" ON "public"."profiles" USING "btree" ("stripe_subscription_id");



CREATE INDEX "idx_profiles_subscription_next_charge" ON "public"."profiles" USING "btree" ("subscription_next_charge");



CREATE INDEX "idx_profiles_verification_token" ON "public"."profiles" USING "btree" ("verification_token") WHERE ("verification_token" IS NOT NULL);



CREATE INDEX "idx_report_logs_chat_id" ON "public"."report_logs" USING "btree" ("chat_id");



CREATE INDEX "idx_report_logs_created_at" ON "public"."report_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_report_prompts_name" ON "public"."report_prompts" USING "btree" ("name");



CREATE INDEX "idx_stripe_webhook_events_created_at" ON "public"."stripe_webhook_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_stripe_webhook_events_processed" ON "public"."stripe_webhook_events" USING "btree" ("processed", "created_at" DESC);



CREATE INDEX "idx_summaries_chat_created" ON "public"."conversation_summaries" USING "btree" ("chat_id", "created_at" DESC);



CREATE INDEX "idx_swe_customer" ON "public"."stripe_webhook_events" USING "btree" ("stripe_customer_id");



CREATE INDEX "idx_swe_kind_date" ON "public"."stripe_webhook_events" USING "btree" ("stripe_kind", "created_at" DESC);



CREATE INDEX "idx_swe_processed" ON "public"."stripe_webhook_events" USING "btree" ("processed") WHERE ("processed" = false);



CREATE INDEX "idx_system_config_key" ON "public"."system_config" USING "btree" ("key");



CREATE INDEX "idx_system_prompts_category" ON "public"."system_prompts" USING "btree" ("category", "display_order");



CREATE INDEX "idx_temp_audio_chat_id" ON "public"."temp_audio" USING "btree" ("chat_id");



CREATE INDEX "idx_temp_audio_chat_id_created_at" ON "public"."temp_audio" USING "btree" ("chat_id", "created_at" DESC);



CREATE INDEX "idx_temp_audio_created_at" ON "public"."temp_audio" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_translator_logs_chat_id" ON "public"."translator_logs" USING "btree" ("chat_id");



CREATE INDEX "idx_user_errors_case_number" ON "public"."user_errors" USING "btree" ("case_number");



CREATE INDEX "idx_user_errors_created_at" ON "public"."user_errors" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_user_errors_email" ON "public"."user_errors" USING "btree" ("email");



CREATE INDEX "idx_user_images_chat_id" ON "public"."user_images" USING "btree" ("chat_id") WHERE ("chat_id" IS NOT NULL);



CREATE INDEX "idx_user_images_message_id" ON "public"."user_images" USING "btree" ("message_id") WHERE ("message_id" IS NOT NULL);



CREATE INDEX "idx_user_images_user_id" ON "public"."user_images" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_user_memory_created" ON "public"."user_memory" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_user_memory_profile_active" ON "public"."user_memory" USING "btree" ("user_id", "profile_id", "reference_count" DESC, "created_at" DESC) WHERE ("is_active" = true);



CREATE INDEX "idx_user_memory_reference" ON "public"."user_memory" USING "btree" ("reference_count" DESC, "last_referenced_at" DESC);



CREATE INDEX "idx_user_memory_user_profile_active" ON "public"."user_memory" USING "btree" ("user_id", "profile_id", "is_active", "last_referenced_at" DESC) WHERE ("is_active" = true);



CREATE UNIQUE INDEX "idx_user_profile_list_primary_per_user" ON "public"."user_profile_list" USING "btree" ("user_id") WHERE ("is_primary" = true);



CREATE INDEX "idx_user_profile_list_user_id" ON "public"."user_profile_list" USING "btree" ("user_id");



CREATE INDEX "idx_voice_usage_cycle_end" ON "public"."voice_usage" USING "btree" ("billing_cycle_end");



CREATE INDEX "idx_weekly_summaries_user" ON "public"."user_memory_weekly_summaries" USING "btree" ("user_id", "year" DESC, "week_number" DESC);



CREATE INDEX "ix_user_memory_canonical_hash" ON "public"."user_memory" USING "btree" ("canonical_hash") WHERE ("canonical_hash" IS NOT NULL);



CREATE INDEX "ix_user_memory_user_profile_hash" ON "public"."user_memory" USING "btree" ("user_id", "profile_id", "canonical_hash", "is_active") WHERE (("is_active" = true) AND ("canonical_hash" IS NOT NULL));



CREATE UNIQUE INDEX "messages_client_msg_id_key" ON "public"."messages" USING "btree" ("client_msg_id");



CREATE INDEX "translator_logs_created_at_idx" ON "public"."translator_logs" USING "btree" ("created_at");



CREATE INDEX "translator_logs_request_type_idx" ON "public"."translator_logs" USING "btree" ("request_type");



CREATE INDEX "translator_logs_user_id_idx" ON "public"."translator_logs" USING "btree" ("chat_id");



CREATE INDEX "user_memory_fts" ON "public"."user_memory" USING "gin" ("to_tsvector"('"english"'::"regconfig", COALESCE("memory_text", ''::"text")));



CREATE UNIQUE INDEX "ux_user_memory_source_message" ON "public"."user_memory" USING "btree" ("source_message_id") WHERE ("source_message_id" IS NOT NULL);



CREATE UNIQUE INDEX "bname" ON "storage"."buckets" USING "btree" ("name");



CREATE UNIQUE INDEX "bucketid_objname" ON "storage"."objects" USING "btree" ("bucket_id", "name");



CREATE INDEX "idx_multipart_uploads_list" ON "storage"."s3_multipart_uploads" USING "btree" ("bucket_id", "key", "created_at");



CREATE UNIQUE INDEX "idx_name_bucket_level_unique" ON "storage"."objects" USING "btree" ("name" COLLATE "C", "bucket_id", "level");



CREATE INDEX "idx_objects_bucket_id_name" ON "storage"."objects" USING "btree" ("bucket_id", "name" COLLATE "C");



CREATE INDEX "idx_objects_lower_name" ON "storage"."objects" USING "btree" (("path_tokens"["level"]), "lower"("name") "text_pattern_ops", "bucket_id", "level");



CREATE INDEX "idx_prefixes_lower_name" ON "storage"."prefixes" USING "btree" ("bucket_id", "level", (("string_to_array"("name", '/'::"text"))["level"]), "lower"("name") "text_pattern_ops");



CREATE INDEX "name_prefix_search" ON "storage"."objects" USING "btree" ("name" "text_pattern_ops");



CREATE UNIQUE INDEX "objects_bucket_id_level_idx" ON "storage"."objects" USING "btree" ("bucket_id", "level", "name" COLLATE "C");



CREATE OR REPLACE TRIGGER "on_auth_user_created" AFTER INSERT OR UPDATE ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();



CREATE OR REPLACE TRIGGER "on_auth_user_email_verified" AFTER UPDATE ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION "public"."sync_user_verification_status"();



CREATE OR REPLACE TRIGGER "chat_folders_updated_at" BEFORE UPDATE ON "public"."chat_folders" FOR EACH ROW EXECUTE FUNCTION "public"."update_chat_folders_updated_at"();



CREATE OR REPLACE TRIGGER "log_message_deletions" BEFORE DELETE ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."log_message_cascade_deletion"();



CREATE OR REPLACE TRIGGER "set_trial_end_date_trigger" BEFORE INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_trial_end_date"();



CREATE OR REPLACE TRIGGER "trg_deactivate_old_methods" AFTER INSERT ON "public"."payment_method" FOR EACH ROW EXECUTE FUNCTION "public"."deactivate_old_payment_methods"();



CREATE OR REPLACE TRIGGER "trg_handle_public_conversation" AFTER INSERT OR UPDATE OF "is_public" ON "public"."conversations" FOR EACH ROW EXECUTE FUNCTION "public"."handle_public_conversation_participant"();



CREATE OR REPLACE TRIGGER "trg_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_update_api_usage_costs" AFTER INSERT OR UPDATE OF "report_tier", "used_geo_lookup" ON "public"."api_usage" FOR EACH ROW EXECUTE FUNCTION "public"."update_api_usage_costs"();



CREATE OR REPLACE TRIGGER "update_conversations_updated_at" BEFORE UPDATE ON "public"."conversations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_email_templates_updated_at" BEFORE UPDATE ON "public"."email_notification_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_email_templates_updated_at"();



CREATE OR REPLACE TRIGGER "update_geo_cache_updated_at" BEFORE UPDATE ON "public"."geo_cache" FOR EACH ROW EXECUTE FUNCTION "public"."update_geo_cache_updated_at"();



CREATE OR REPLACE TRIGGER "update_journal_entries_updated_at" BEFORE UPDATE ON "public"."journal_entries" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_landing_page_config_updated_at" BEFORE UPDATE ON "public"."landing_page_config" FOR EACH ROW EXECUTE FUNCTION "public"."update_landing_page_config_updated_at"();



CREATE OR REPLACE TRIGGER "update_system_prompts_updated_at" BEFORE UPDATE ON "public"."system_prompts" FOR EACH ROW EXECUTE FUNCTION "public"."update_system_prompts_updated_at"();



CREATE OR REPLACE TRIGGER "update_token_emails_updated_at" BEFORE UPDATE ON "public"."token_emails" FOR EACH ROW EXECUTE FUNCTION "public"."update_token_emails_updated_at"();



CREATE OR REPLACE TRIGGER "update_user_preferences_timestamp" BEFORE UPDATE ON "public"."user_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_timestamp"();



CREATE OR REPLACE TRIGGER "update_user_profile_list_updated_at_trigger" BEFORE UPDATE ON "public"."user_profile_list" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_profile_list_updated_at"();



CREATE OR REPLACE TRIGGER "enforce_bucket_name_length_trigger" BEFORE INSERT OR UPDATE OF "name" ON "storage"."buckets" FOR EACH ROW EXECUTE FUNCTION "storage"."enforce_bucket_name_length"();



CREATE OR REPLACE TRIGGER "objects_delete_delete_prefix" AFTER DELETE ON "storage"."objects" FOR EACH ROW EXECUTE FUNCTION "storage"."delete_prefix_hierarchy_trigger"();



CREATE OR REPLACE TRIGGER "objects_insert_create_prefix" BEFORE INSERT ON "storage"."objects" FOR EACH ROW EXECUTE FUNCTION "storage"."objects_insert_prefix_trigger"();



CREATE OR REPLACE TRIGGER "objects_update_create_prefix" BEFORE UPDATE ON "storage"."objects" FOR EACH ROW WHEN ((("new"."name" <> "old"."name") OR ("new"."bucket_id" <> "old"."bucket_id"))) EXECUTE FUNCTION "storage"."objects_update_prefix_trigger"();



CREATE OR REPLACE TRIGGER "prefixes_create_hierarchy" BEFORE INSERT ON "storage"."prefixes" FOR EACH ROW WHEN (("pg_trigger_depth"() < 1)) EXECUTE FUNCTION "storage"."prefixes_insert_trigger"();



CREATE OR REPLACE TRIGGER "prefixes_delete_hierarchy" AFTER DELETE ON "storage"."prefixes" FOR EACH ROW EXECUTE FUNCTION "storage"."delete_prefix_hierarchy_trigger"();



CREATE OR REPLACE TRIGGER "update_objects_updated_at" BEFORE UPDATE ON "storage"."objects" FOR EACH ROW EXECUTE FUNCTION "storage"."update_updated_at_column"();



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "mfa_amr_claims_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_challenges"
    ADD CONSTRAINT "mfa_challenges_auth_factor_id_fkey" FOREIGN KEY ("factor_id") REFERENCES "auth"."mfa_factors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."one_time_tokens"
    ADD CONSTRAINT "one_time_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_flow_state_id_fkey" FOREIGN KEY ("flow_state_id") REFERENCES "auth"."flow_state"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_oauth_client_id_fkey" FOREIGN KEY ("oauth_client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."sso_domains"
    ADD CONSTRAINT "sso_domains_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."api_usage"
    ADD CONSTRAINT "api_usage_translator_log_id_fkey" FOREIGN KEY ("translator_log_id") REFERENCES "public"."translator_logs"("id");



ALTER TABLE ONLY "public"."api_usage"
    ADD CONSTRAINT "api_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."chat_folder_participants"
    ADD CONSTRAINT "chat_folder_participants_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "public"."chat_folders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_folder_participants"
    ADD CONSTRAINT "chat_folder_participants_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chat_folder_participants"
    ADD CONSTRAINT "chat_folder_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_folders"
    ADD CONSTRAINT "chat_folders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_caches"
    ADD CONSTRAINT "conversation_caches_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_summaries"
    ADD CONSTRAINT "conversation_summaries_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "public"."chat_folders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversations_participants"
    ADD CONSTRAINT "conversations_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations_participants"
    ADD CONSTRAINT "conversations_participants_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversations_participants"
    ADD CONSTRAINT "conversations_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."user_profile_list"("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_method"
    ADD CONSTRAINT "credit_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_user_id_fkey1" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feature_usage"
    ADD CONSTRAINT "feature_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_sessions"
    ADD CONSTRAINT "fk_coach_id" FOREIGN KEY ("coach_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."insights"
    ADD CONSTRAINT "insights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fk_auth_users" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."topup_queue"
    ADD CONSTRAINT "topup_queue_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_credits"
    ADD CONSTRAINT "user_credits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_images"
    ADD CONSTRAINT "user_images_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."conversations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_images"
    ADD CONSTRAINT "user_images_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_images"
    ADD CONSTRAINT "user_images_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_memory"
    ADD CONSTRAINT "user_memory_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_memory_monthly_summaries"
    ADD CONSTRAINT "user_memory_monthly_summaries_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."user_profile_list"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_memory_monthly_summaries"
    ADD CONSTRAINT "user_memory_monthly_summaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_memory"
    ADD CONSTRAINT "user_memory_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."user_profile_list"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_memory"
    ADD CONSTRAINT "user_memory_source_message_id_fkey" FOREIGN KEY ("source_message_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_memory"
    ADD CONSTRAINT "user_memory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_memory_weekly_summaries"
    ADD CONSTRAINT "user_memory_weekly_summaries_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."user_profile_list"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_memory_weekly_summaries"
    ADD CONSTRAINT "user_memory_weekly_summaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profile_list"
    ADD CONSTRAINT "user_profile_list_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."voice_usage"
    ADD CONSTRAINT "voice_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "storage"."objects"
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."prefixes"
    ADD CONSTRAINT "prefixes_bucketId_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads"
    ADD CONSTRAINT "s3_multipart_uploads_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "storage"."s3_multipart_uploads"("id") ON DELETE CASCADE;



ALTER TABLE "auth"."audit_log_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."flow_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."identities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."instances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_amr_claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_challenges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_factors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."one_time_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."refresh_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."saml_providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."saml_relay_states" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."schema_migrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sso_domains" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sso_providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."users" ENABLE ROW LEVEL SECURITY;


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



CREATE POLICY "Authenticated users can view active system prompts" ON "public"."system_prompts" FOR SELECT TO "authenticated" USING (("is_active" = true));



CREATE POLICY "Authenticated users can view all roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view email templates" ON "public"."email_notification_templates" FOR SELECT TO "authenticated" USING (true);



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



CREATE POLICY "Everyone can view active products" ON "public"."stripe_products" FOR SELECT USING (("active" = true));



CREATE POLICY "Only admins can manage roles" ON "public"."user_roles" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "user_roles_1"
  WHERE (("user_roles_1"."user_id" = "auth"."uid"()) AND ("user_roles_1"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Only admins can modify plan limits" ON "public"."plan_limits" USING ((("auth"."jwt"() ->> 'email'::"text") IN ( SELECT "profiles"."email"
   FROM "public"."profiles"
  WHERE ("profiles"."subscription_plan" = 'admin'::"text"))));



CREATE POLICY "Only service role can access admin_logs" ON "public"."admin_logs" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Participants can view their folders" ON "public"."chat_folders" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."chat_folder_participants"
  WHERE (("chat_folder_participants"."folder_id" = "chat_folders"."id") AND ("chat_folder_participants"."user_id" = "auth"."uid"())))));



CREATE POLICY "Plan limits are publicly readable" ON "public"."plan_limits" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Public can read current legal documents" ON "public"."legal_documents" FOR SELECT USING (("is_current" = true));



CREATE POLICY "Public can read price list" ON "public"."price_list" FOR SELECT TO "anon", "authenticated" USING (true);



CREATE POLICY "Public can view active templates" ON "public"."website_templates" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Public can view public folders" ON "public"."chat_folders" FOR SELECT USING (("is_public" = true));



CREATE POLICY "Public can view published posts" ON "public"."blog_posts" FOR SELECT USING (("published" = true));



CREATE POLICY "Public read access to system_config" ON "public"."system_config" FOR SELECT USING (true);



CREATE POLICY "Service role can delete memories" ON "public"."user_memory" FOR DELETE USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can insert memories" ON "public"."user_memory" FOR INSERT WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can insert translator logs" ON "public"."translator_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "Service role can manage all email messages" ON "public"."email_messages" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage domain_slugs" ON "public"."domain_slugs" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage monthly summaries" ON "public"."user_memory_monthly_summaries" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage password reset tokens" ON "public"."password_reset_tokens" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage roles" ON "public"."user_roles" TO "service_role" USING (true);



CREATE POLICY "Service role can manage translator logs" ON "public"."translator_logs" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage user errors" ON "public"."user_errors" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage weekly summaries" ON "public"."user_memory_weekly_summaries" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can update memory usage" ON "public"."user_memory" FOR UPDATE USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can update system_config" ON "public"."system_config" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "public"."user_credits" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access on conversation_caches" ON "public"."conversation_caches" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access on conversation_summaries" ON "public"."conversation_summaries" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access on transactions" ON "public"."credit_transactions" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access to user images" ON "public"."user_images" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role manages voice usage" ON "public"."voice_usage" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Users can access own report logs" ON "public"."report_logs" USING (("chat_id" = "auth"."uid"()));



CREATE POLICY "Users can create own insights" ON "public"."insights" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own preferences" ON "public"."user_preferences" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own images" ON "public"."user_images" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own insights" ON "public"."insights" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own report logs" ON "public"."report_logs" FOR DELETE USING ("public"."user_owns_insight"("chat_id"));



CREATE POLICY "Users can delete own translator logs" ON "public"."translator_logs" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."insights"
  WHERE (("insights"."id" = "translator_logs"."chat_id") AND ("insights"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete their own payment methods" ON "public"."payment_method" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own profiles" ON "public"."user_profile_list" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own profiles" ON "public"."user_profile_list" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can join conversations" ON "public"."conversations_participants" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can join folders" ON "public"."chat_folder_participants" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can leave conversations" ON "public"."conversations_participants" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can leave folders" ON "public"."chat_folder_participants" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage own folders" ON "public"."chat_folders" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read their own preferences" ON "public"."user_preferences" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read their own roles" ON "public"."user_roles" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read their own tokens" ON "public"."password_reset_tokens" FOR SELECT USING (("auth"."email"() = "email"));



CREATE POLICY "Users can read their own translator logs" ON "public"."translator_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."conversations"
  WHERE (("conversations"."id" = "translator_logs"."chat_id") AND ("conversations"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can soft-delete their own memories" ON "public"."user_memory" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK ((("auth"."uid"() = "user_id") AND ("is_active" = false) AND ("deleted_at" IS NOT NULL)));



CREATE POLICY "Users can update own insights" ON "public"."insights" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own participant" ON "public"."chat_folder_participants" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own payment methods" ON "public"."payment_method" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own preferences" ON "public"."user_preferences" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profiles" ON "public"."user_profile_list" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view folder participants" ON "public"."chat_folder_participants" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view folders" ON "public"."chat_folders" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR ("is_public" = true)));



CREATE POLICY "Users can view own credits" ON "public"."user_credits" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own feature usage" ON "public"."feature_usage" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own images" ON "public"."user_images" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own insights" ON "public"."insights" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own transactions" ON "public"."credit_transactions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own voice usage" ON "public"."voice_usage" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view participants" ON "public"."conversations_participants" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view their own memories" ON "public"."user_memory" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own monthly summaries" ON "public"."user_memory_monthly_summaries" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own profiles" ON "public"."user_profile_list" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own roles" ON "public"."user_roles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own transactions" ON "public"."payment_method" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own weekly summaries" ON "public"."user_memory_weekly_summaries" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view website templates" ON "public"."website_templates" FOR SELECT TO "authenticated" USING (("is_active" = true));



ALTER TABLE "public"."admin_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."api_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."blog_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."calendar_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cascade_deletion_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_folder_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_folders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversation_caches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversation_summaries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."debug_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."domain_slugs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_notification_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feature_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."geo_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."insights" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ip_allowlist" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."journal_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."landing_page_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."legal_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."password_reset_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_method" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plan_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."price_list" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_service_role_all" ON "public"."profiles" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."promo_codes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public_sel" ON "public"."conversations" FOR SELECT USING ((("is_public" = true) OR (EXISTS ( SELECT 1
   FROM "public"."chat_folders"
  WHERE (("chat_folders"."id" = "conversations"."folder_id") AND ("chat_folders"."is_public" = true))))));



CREATE POLICY "public_sel" ON "public"."messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."chat_id") AND (("c"."is_public" = true) OR (EXISTS ( SELECT 1
           FROM "public"."chat_folders"
          WHERE (("chat_folders"."id" = "c"."folder_id") AND ("chat_folders"."is_public" = true)))))))));



ALTER TABLE "public"."report_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."report_prompts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_all_credit_transactions" ON "public"."payment_method" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_all_stripe_products" ON "public"."stripe_products" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_all_topup_queue" ON "public"."topup_queue" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_all_webhook_events" ON "public"."stripe_webhook_events" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_role_can_insert_report_logs" ON "public"."report_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "service_role_can_update_report_logs" ON "public"."report_logs" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "service_role_insert" ON "public"."api_usage" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "service_role_insert" ON "public"."debug_logs" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "service_role_insert" ON "public"."promo_codes" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "service_role_insert" ON "public"."swissdebuglogs" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "service_role_insert" ON "public"."temp_report_data" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "service_role_insert" ON "public"."topup_logs" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "service_role_manage_cascade_log" ON "public"."cascade_deletion_log" USING (("auth"."role"() = 'service_role'::"text"));



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


CREATE POLICY "svc_all" ON "public"."conversations" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "svc_all" ON "public"."messages" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."swissdebuglogs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_prompts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "system_prompts_admin_policy" ON "public"."system_prompts" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."temp_audio" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."temp_report_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."token_emails" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."topup_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."topup_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."translator_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_credits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_errors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_memory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_memory_monthly_summaries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_memory_weekly_summaries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profile_list" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_can_view_own_messages_after_chat_deletion" ON "public"."messages" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "usr_del" ON "public"."conversations" FOR DELETE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR ("owner_user_id" = "auth"."uid"())));



CREATE POLICY "usr_ins" ON "public"."conversations" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "usr_ins" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."conversations"
  WHERE (("conversations"."id" = "messages"."chat_id") AND ("conversations"."user_id" = "auth"."uid"()))
 LIMIT 1)) OR (EXISTS ( SELECT 1
   FROM "public"."conversations_participants"
  WHERE (("conversations_participants"."conversation_id" = "messages"."chat_id") AND ("conversations_participants"."user_id" = "auth"."uid"()))
 LIMIT 1))));



CREATE POLICY "usr_sel" ON "public"."conversations" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR ("owner_user_id" = "auth"."uid"()) OR ("is_public" = true) OR (EXISTS ( SELECT 1
   FROM "public"."conversations_participants"
  WHERE (("conversations_participants"."conversation_id" = "conversations"."id") AND ("conversations_participants"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM ("public"."chat_folder_participants" "cfp"
     JOIN "public"."chat_folders" "cf" ON (("cf"."id" = "cfp"."folder_id")))
  WHERE (("cfp"."user_id" = "auth"."uid"()) AND ("conversations"."folder_id" = "cf"."id")))) OR (EXISTS ( SELECT 1
   FROM "public"."chat_folders"
  WHERE (("chat_folders"."id" = "conversations"."folder_id") AND ("chat_folders"."is_public" = true))))));



CREATE POLICY "usr_sel" ON "public"."messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."chat_id") AND (("c"."user_id" = "auth"."uid"()) OR ("c"."owner_user_id" = "auth"."uid"()) OR ("c"."is_public" = true) OR (EXISTS ( SELECT 1
           FROM "public"."conversations_participants"
          WHERE (("conversations_participants"."conversation_id" = "c"."id") AND ("conversations_participants"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
           FROM ("public"."chat_folder_participants" "cfp"
             JOIN "public"."chat_folders" "cf" ON (("cf"."id" = "cfp"."folder_id")))
          WHERE (("cfp"."user_id" = "auth"."uid"()) AND ("c"."folder_id" = "cf"."id")))) OR (EXISTS ( SELECT 1
           FROM "public"."chat_folders"
          WHERE (("chat_folders"."id" = "c"."folder_id") AND ("chat_folders"."is_public" = true)))))))));



CREATE POLICY "usr_upd" ON "public"."conversations" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR ("owner_user_id" = "auth"."uid"()))) WITH CHECK ((("user_id" = "auth"."uid"()) OR ("owner_user_id" = "auth"."uid"())));



ALTER TABLE "public"."voice_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."website_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Authenticated users can delete feature images" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'feature-images'::"text") AND ("auth"."role"() = 'authenticated'::"text")));



CREATE POLICY "Authenticated users can update feature images" ON "storage"."objects" FOR UPDATE USING ((("bucket_id" = 'feature-images'::"text") AND ("auth"."role"() = 'authenticated'::"text")));



CREATE POLICY "Authenticated users can upload feature images" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'feature-images'::"text") AND ("auth"."role"() = 'authenticated'::"text")));



CREATE POLICY "Public Access" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'feature-images'::"text"));



CREATE POLICY "Service role full access on generated images" ON "storage"."objects" TO "service_role" USING (("bucket_id" = 'generated-images'::"text")) WITH CHECK (("bucket_id" = 'generated-images'::"text"));



CREATE POLICY "Users can delete their own images" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'generated-images'::"text") AND (("string_to_array"("name", '/'::"text"))[1] = ("auth"."uid"())::"text")));



CREATE POLICY "Users can upload their own images" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'generated-images'::"text") AND (("string_to_array"("name", '/'::"text"))[1] = ("auth"."uid"())::"text")));



CREATE POLICY "Users can view their own images" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'generated-images'::"text") AND (("string_to_array"("name", '/'::"text"))[1] = ("auth"."uid"())::"text")));



ALTER TABLE "storage"."buckets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."buckets_analytics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."migrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."objects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."prefixes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."s3_multipart_uploads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."s3_multipart_uploads_parts" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "auth" TO "anon";
GRANT USAGE ON SCHEMA "auth" TO "authenticated";
GRANT USAGE ON SCHEMA "auth" TO "service_role";
GRANT ALL ON SCHEMA "auth" TO "supabase_auth_admin";
GRANT ALL ON SCHEMA "auth" TO "dashboard_user";
GRANT USAGE ON SCHEMA "auth" TO "postgres";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT USAGE ON SCHEMA "storage" TO "postgres" WITH GRANT OPTION;
GRANT USAGE ON SCHEMA "storage" TO "anon";
GRANT USAGE ON SCHEMA "storage" TO "authenticated";
GRANT USAGE ON SCHEMA "storage" TO "service_role";
GRANT ALL ON SCHEMA "storage" TO "supabase_storage_admin";
GRANT ALL ON SCHEMA "storage" TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."email"() TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."jwt"() TO "postgres";
GRANT ALL ON FUNCTION "auth"."jwt"() TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."role"() TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."uid"() TO "dashboard_user";



GRANT ALL ON FUNCTION "public"."add_credits"("_user_id" "uuid", "_credits" integer, "_amount_usd" numeric, "_type" "text", "_reference_id" "text", "_description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_credits"("_user_id" "uuid", "_credits" integer, "_amount_usd" numeric, "_type" "text", "_reference_id" "text", "_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_credits"("_user_id" "uuid", "_credits" integer, "_amount_usd" numeric, "_type" "text", "_reference_id" "text", "_description" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."archive_old_messages"() TO "anon";
GRANT ALL ON FUNCTION "public"."archive_old_messages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_old_messages"() TO "service_role";



GRANT ALL ON FUNCTION "public"."call_process_guest_report_pdf"() TO "anon";
GRANT ALL ON FUNCTION "public"."call_process_guest_report_pdf"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."call_process_guest_report_pdf"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_and_increment_insights_count"("p_user_id" "uuid", "p_count" integer, "p_period" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_and_increment_insights_count"("p_user_id" "uuid", "p_count" integer, "p_period" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_and_increment_insights_count"("p_user_id" "uuid", "p_count" integer, "p_period" "text", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_and_increment_therai_calls"("p_user_id" "uuid", "p_calls" integer, "p_period" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_and_increment_therai_calls"("p_user_id" "uuid", "p_calls" integer, "p_period" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_and_increment_therai_calls"("p_user_id" "uuid", "p_calls" integer, "p_period" "text", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_and_increment_voice_seconds"("p_user_id" "uuid", "p_seconds" integer, "p_period" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_and_increment_voice_seconds"("p_user_id" "uuid", "p_seconds" integer, "p_period" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_and_increment_voice_seconds"("p_user_id" "uuid", "p_seconds" integer, "p_period" "text", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_feature_limit"("p_user_id" "uuid", "p_feature_type" "text", "p_requested_amount" integer, "p_period" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_feature_limit"("p_user_id" "uuid", "p_feature_type" "text", "p_requested_amount" integer, "p_period" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_feature_limit"("p_user_id" "uuid", "p_feature_type" "text", "p_requested_amount" integer, "p_period" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_orphaned_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_orphaned_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_orphaned_data"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_user_admin_role"("user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_user_admin_role"("user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_user_admin_role"("user_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_voice_limit"("p_user_id" "uuid", "p_requested_seconds" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_voice_limit"("p_user_id" "uuid", "p_requested_seconds" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_voice_limit"("p_user_id" "uuid", "p_requested_seconds" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."clean_completed_topups"() TO "anon";
GRANT ALL ON FUNCTION "public"."clean_completed_topups"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."clean_completed_topups"() TO "service_role";



GRANT ALL ON FUNCTION "public"."clean_edge_function_logs"() TO "anon";
GRANT ALL ON FUNCTION "public"."clean_edge_function_logs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."clean_edge_function_logs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."clean_old_webhook_events"() TO "anon";
GRANT ALL ON FUNCTION "public"."clean_old_webhook_events"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."clean_old_webhook_events"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_user_after_payment"("user_id" "uuid", "plan_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_user_after_payment"("user_id" "uuid", "plan_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_after_payment"("user_id" "uuid", "plan_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."deactivate_old_payment_methods"() TO "anon";
GRANT ALL ON FUNCTION "public"."deactivate_old_payment_methods"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."deactivate_old_payment_methods"() TO "service_role";



GRANT ALL ON FUNCTION "public"."deduct_credits"("_user_id" "uuid", "_credits" integer, "_endpoint" "text", "_reference_id" "uuid", "_description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."deduct_credits"("_user_id" "uuid", "_credits" integer, "_endpoint" "text", "_reference_id" "uuid", "_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."deduct_credits"("_user_id" "uuid", "_credits" integer, "_endpoint" "text", "_reference_id" "uuid", "_description" "text") TO "service_role";



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



GRANT ALL ON FUNCTION "public"."get_config"("config_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_config"("config_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_config"("config_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_billing_cycle"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_billing_cycle"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_billing_cycle"("p_user_id" "uuid") TO "service_role";



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



GRANT ALL ON FUNCTION "public"."get_user_limits"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_limits"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_limits"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_public_conversation_participant"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_public_conversation_participant"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_public_conversation_participant"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."hard_delete_archived_messages"("months_old" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."hard_delete_archived_messages"("months_old" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hard_delete_archived_messages"("months_old" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_chat_messages"("p_user_id" "uuid", "p_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_chat_messages"("p_user_id" "uuid", "p_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_chat_messages"("p_user_id" "uuid", "p_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_chat_messages"("p_user_id" "uuid", "p_count" integer, "p_period" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_chat_messages"("p_user_id" "uuid", "p_count" integer, "p_period" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_chat_messages"("p_user_id" "uuid", "p_count" integer, "p_period" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_feature_usage"("p_user_id" "uuid", "p_feature_type" "text", "p_amount" integer, "p_period" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_feature_usage"("p_user_id" "uuid", "p_feature_type" "text", "p_amount" integer, "p_period" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_feature_usage"("p_user_id" "uuid", "p_feature_type" "text", "p_amount" integer, "p_period" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_images_generated"("p_user_id" "uuid", "p_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_images_generated"("p_user_id" "uuid", "p_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_images_generated"("p_user_id" "uuid", "p_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_images_generated"("p_user_id" "uuid", "p_count" integer, "p_period" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_images_generated"("p_user_id" "uuid", "p_count" integer, "p_period" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_images_generated"("p_user_id" "uuid", "p_count" integer, "p_period" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_insights_count"("p_user_id" "uuid", "p_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_insights_count"("p_user_id" "uuid", "p_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_insights_count"("p_user_id" "uuid", "p_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_insights_count"("p_user_id" "uuid", "p_count" integer, "p_period" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_insights_count"("p_user_id" "uuid", "p_count" integer, "p_period" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_insights_count"("p_user_id" "uuid", "p_count" integer, "p_period" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_therai_calls"("p_user_id" "uuid", "p_calls" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_therai_calls"("p_user_id" "uuid", "p_calls" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_therai_calls"("p_user_id" "uuid", "p_calls" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_therai_calls"("p_user_id" "uuid", "p_calls" integer, "p_period" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_therai_calls"("p_user_id" "uuid", "p_calls" integer, "p_period" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_therai_calls"("p_user_id" "uuid", "p_calls" integer, "p_period" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_voice_seconds"("p_user_id" "uuid", "p_seconds" integer, "p_period" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_voice_seconds"("p_user_id" "uuid", "p_seconds" integer, "p_period" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_voice_seconds"("p_user_id" "uuid", "p_seconds" integer, "p_period" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_voice_usage"("p_user_id" "uuid", "p_seconds" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_voice_usage"("p_user_id" "uuid", "p_seconds" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_voice_usage"("p_user_id" "uuid", "p_seconds" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_user_in_trial"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_user_in_trial"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_user_in_trial"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_user_verified"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_user_verified"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_user_verified"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_message_cascade_deletion"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_message_cascade_deletion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_message_cascade_deletion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_modal_ready_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_modal_ready_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_modal_ready_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_summary_cascade_deletion"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_summary_cascade_deletion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_summary_cascade_deletion"() TO "service_role";



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



GRANT ALL ON FUNCTION "public"."set_trial_end_date"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_trial_end_date"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_trial_end_date"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_active_payment_method"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_active_payment_method"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_active_payment_method"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_user_verification_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_user_verification_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_user_verification_status"() TO "service_role";



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



GRANT ALL ON FUNCTION "public"."update_auto_topup_settings"("_user_id" "uuid", "_enabled" boolean, "_threshold" integer, "_amount" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."update_auto_topup_settings"("_user_id" "uuid", "_enabled" boolean, "_threshold" integer, "_amount" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_auto_topup_settings"("_user_id" "uuid", "_enabled" boolean, "_threshold" integer, "_amount" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_chat_folders_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_chat_folders_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_chat_folders_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_email_templates_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_email_templates_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_email_templates_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_geo_cache_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_geo_cache_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_geo_cache_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_landing_page_config_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_landing_page_config_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_landing_page_config_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_service_purchases_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_service_purchases_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_service_purchases_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_stripe_flow_tracking_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_stripe_flow_tracking_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_stripe_flow_tracking_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_system_prompts_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_system_prompts_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_system_prompts_updated_at"() TO "service_role";



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



GRANT ALL ON FUNCTION "public"."user_owns_insight"("report_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_owns_insight"("report_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_owns_insight"("report_id" "uuid") TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."audit_log_entries" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."audit_log_entries" TO "postgres";
GRANT SELECT ON TABLE "auth"."audit_log_entries" TO "postgres" WITH GRANT OPTION;



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."flow_state" TO "postgres";
GRANT SELECT ON TABLE "auth"."flow_state" TO "postgres" WITH GRANT OPTION;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."flow_state" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."identities" TO "postgres";
GRANT SELECT ON TABLE "auth"."identities" TO "postgres" WITH GRANT OPTION;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."identities" TO "dashboard_user";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."instances" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."instances" TO "postgres";
GRANT SELECT ON TABLE "auth"."instances" TO "postgres" WITH GRANT OPTION;



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."mfa_amr_claims" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_amr_claims" TO "postgres" WITH GRANT OPTION;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."mfa_amr_claims" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."mfa_challenges" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_challenges" TO "postgres" WITH GRANT OPTION;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."mfa_challenges" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."mfa_factors" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_factors" TO "postgres" WITH GRANT OPTION;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."mfa_factors" TO "dashboard_user";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."oauth_authorizations" TO "postgres";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."oauth_authorizations" TO "dashboard_user";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."oauth_clients" TO "postgres";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."oauth_clients" TO "dashboard_user";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."oauth_consents" TO "postgres";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."oauth_consents" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."one_time_tokens" TO "postgres";
GRANT SELECT ON TABLE "auth"."one_time_tokens" TO "postgres" WITH GRANT OPTION;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."one_time_tokens" TO "dashboard_user";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."refresh_tokens" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."refresh_tokens" TO "postgres";
GRANT SELECT ON TABLE "auth"."refresh_tokens" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON SEQUENCE "auth"."refresh_tokens_id_seq" TO "dashboard_user";
GRANT ALL ON SEQUENCE "auth"."refresh_tokens_id_seq" TO "postgres";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."saml_providers" TO "postgres";
GRANT SELECT ON TABLE "auth"."saml_providers" TO "postgres" WITH GRANT OPTION;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."saml_providers" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."saml_relay_states" TO "postgres";
GRANT SELECT ON TABLE "auth"."saml_relay_states" TO "postgres" WITH GRANT OPTION;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."saml_relay_states" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."sessions" TO "postgres";
GRANT SELECT ON TABLE "auth"."sessions" TO "postgres" WITH GRANT OPTION;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."sessions" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."sso_domains" TO "postgres";
GRANT SELECT ON TABLE "auth"."sso_domains" TO "postgres" WITH GRANT OPTION;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."sso_domains" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."sso_providers" TO "postgres";
GRANT SELECT ON TABLE "auth"."sso_providers" TO "postgres" WITH GRANT OPTION;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."sso_providers" TO "dashboard_user";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."users" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "auth"."users" TO "postgres";
GRANT SELECT ON TABLE "auth"."users" TO "postgres" WITH GRANT OPTION;



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."admin_logs" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."admin_logs" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."admin_logs" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."api_usage" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."api_usage" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."api_usage" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."blog_posts" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."blog_posts" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."blog_posts" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."calendar_sessions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."calendar_sessions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."calendar_sessions" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."cascade_deletion_log" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."cascade_deletion_log" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."cascade_deletion_log" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."chat_folder_participants" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."chat_folder_participants" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."chat_folder_participants" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."chat_folders" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."chat_folders" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."chat_folders" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."conversation_caches" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."conversation_caches" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."conversation_caches" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."conversation_summaries" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."conversation_summaries" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."conversation_summaries" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."conversations" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."conversations" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."conversations" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."conversations_participants" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."conversations_participants" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."conversations_participants" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."credit_transactions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."credit_transactions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."credit_transactions" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."payment_method" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."payment_method" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."payment_method" TO "service_role";



GRANT ALL ON SEQUENCE "public"."credit_transactions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."credit_transactions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."credit_transactions_id_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."debug_logs" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."debug_logs" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."debug_logs" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."domain_slugs" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."domain_slugs" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."domain_slugs" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."email_messages" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."email_messages" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."email_messages" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."email_notification_templates" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."email_notification_templates" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."email_notification_templates" TO "service_role";



GRANT ALL ON SEQUENCE "public"."engine_selector_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."engine_selector_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."engine_selector_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."feature_usage" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."feature_usage" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."feature_usage" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."geo_cache" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."geo_cache" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."geo_cache" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."insights" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."insights" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."insights" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."ip_allowlist" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."ip_allowlist" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."ip_allowlist" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."journal_entries" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."journal_entries" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."journal_entries" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."landing_page_config" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."landing_page_config" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."landing_page_config" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."legal_documents" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."legal_documents" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."legal_documents" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."messages" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."messages" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."messages" TO "anon";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."message_archival_stats" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."message_archival_stats" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."message_archival_stats" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."password_reset_tokens" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."password_reset_tokens" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."password_reset_tokens" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."plan_limits" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."plan_limits" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."plan_limits" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE ON TABLE "public"."price_list" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE ON TABLE "public"."price_list" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."price_list" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."profiles" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."promo_codes" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."promo_codes" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."promo_codes" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."report_logs" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."report_logs" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."report_logs" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."report_prompts" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."report_prompts" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."report_prompts" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."stripe_products" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."stripe_products" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."stripe_products" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."stripe_webhook_events" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."stripe_webhook_events" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."stripe_webhook_events" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."swissdebuglogs" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."swissdebuglogs" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."swissdebuglogs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."swissdebuglogs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."swissdebuglogs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."swissdebuglogs_id_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."system_config" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."system_config" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."system_config" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."system_prompts" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."system_prompts" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."system_prompts" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."temp_audio" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."temp_audio" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."temp_audio" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."temp_report_data" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."temp_report_data" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."temp_report_data" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."token_emails" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."token_emails" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."token_emails" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."topup_logs" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."topup_logs" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."topup_logs" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."topup_queue" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."topup_queue" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."topup_queue" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."translator_logs" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."translator_logs" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."translator_logs" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_credits" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_credits" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_credits" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_errors" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_errors" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_errors" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_images" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_images" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_images" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_memory" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_memory" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_memory" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_memory_monthly_summaries" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_memory_monthly_summaries" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_memory_monthly_summaries" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_memory_weekly_summaries" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_memory_weekly_summaries" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_memory_weekly_summaries" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_preferences" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_preferences" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_preferences" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_profile_list" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_profile_list" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_profile_list" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_roles" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_roles" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_roles" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."voice_usage" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."voice_usage" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."voice_usage" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."website_templates" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."website_templates" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."website_templates" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "storage"."buckets" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "storage"."buckets" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "storage"."buckets" TO "service_role";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "storage"."buckets" TO "postgres" WITH GRANT OPTION;



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "storage"."buckets_analytics" TO "service_role";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "storage"."buckets_analytics" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "storage"."buckets_analytics" TO "anon";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "storage"."objects" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "storage"."objects" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "storage"."objects" TO "service_role";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "storage"."objects" TO "postgres" WITH GRANT OPTION;



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "storage"."prefixes" TO "service_role";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "storage"."prefixes" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "storage"."prefixes" TO "anon";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "storage"."s3_multipart_uploads" TO "service_role";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads" TO "authenticated";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads" TO "anon";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "storage"."s3_multipart_uploads_parts" TO "service_role";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads_parts" TO "authenticated";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads_parts" TO "anon";



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON SEQUENCES TO "dashboard_user";



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON FUNCTIONS TO "dashboard_user";



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "dashboard_user";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "service_role";




