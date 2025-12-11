


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


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'Guest functionality removed - auth-only system. guest_reports table dropped.';



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


CREATE OR REPLACE FUNCTION "public"."_get_secret"("name" "text") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
DECLARE
  v text;
BEGIN
  -- Try helper function if available
  BEGIN
    EXECUTE 'SELECT vault.decrypted_secret_by_name($1)' INTO v USING name;
    IF v IS NOT NULL AND v <> '' THEN
      RETURN v;
    END IF;
  EXCEPTION WHEN undefined_function THEN
    -- Ignore; try the view next
    NULL;
  WHEN others THEN
    NULL;
  END;

  -- Try the decrypted view
  BEGIN
    EXECUTE $q$
      SELECT decrypted_secret
      FROM vault.decrypted_secrets
      WHERE name = $1
      LIMIT 1
    $q$ INTO v USING name;
    IF v IS NOT NULL AND v <> '' THEN
      RETURN v;
    END IF;
  EXCEPTION WHEN undefined_table OR insufficient_privilege THEN
    RETURN NULL;
  WHEN others THEN
    RETURN NULL;
  END;

  RETURN NULL;
END;
$_$;


ALTER FUNCTION "public"."_get_secret"("name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_credits"("_user_id" "uuid", "_credits" integer, "_amount_usd" numeric, "_type" "text" DEFAULT 'purchase'::"text", "_reference_id" "text" DEFAULT NULL::"text", "_description" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
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



CREATE OR REPLACE FUNCTION "public"."assign_ab_test_group"() RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Simple random assignment: 50/50 split between Plus and Growth
  -- Can be modified later for more sophisticated assignment logic
  IF random() < 0.5 THEN
    RETURN 'plus_plan';
  ELSE
    RETURN 'growth_plan';
  END IF;
END;
$$;


ALTER FUNCTION "public"."assign_ab_test_group"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."assign_ab_test_group"() IS 'Randomly assigns new users to A/B test groups for pricing experiments';



CREATE OR REPLACE FUNCTION "public"."check_and_increment_insights_count"("p_user_id" "uuid", "p_count" integer, "p_period" "text", "p_limit" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
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



CREATE OR REPLACE FUNCTION "public"."check_feature_access"("p_plan_id" "text", "p_trial_end_date" timestamp with time zone, "p_feature_type" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF p_plan_id = 'free'
     AND p_trial_end_date IS NOT NULL
     AND now() > p_trial_end_date
  THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'reason', 'Trial expired but free features remain available.',
      'error_code', 'TRIAL_EXPIRED_FREE_ALLOWED',
      'trial_end_date', p_trial_end_date,
      'limit', null,
      'current_usage', null,
      'remaining', null
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'reason', 'Allowed',
    'error_code', null,
    'trial_end_date', p_trial_end_date,
    'limit', null,
    'current_usage', null,
    'remaining', null
  );
END;
$$;


ALTER FUNCTION "public"."check_feature_access"("p_plan_id" "text", "p_trial_end_date" timestamp with time zone, "p_feature_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_feature_limit"("p_user_id" "uuid", "p_feature_type" "text", "p_requested_amount" integer DEFAULT 1, "p_period" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
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
  
  -- Treat NULL plans or inactive subscriptions as free
  IF v_plan_id IS NULL OR (v_subscription_active = false AND v_subscription_status = 'canceled') THEN
    v_plan_id := 'free';
  END IF;
  
  -- 2. FREE TRIAL CHECK: Block AI features after 1 week for free users
  IF v_plan_id = 'free' AND v_trial_end_date IS NOT NULL AND NOW() > v_trial_end_date THEN
    IF p_feature_type IN ('chat', 'voice_seconds', 'image_generation', 'therai_calls', 'insights') THEN
      -- Determine feature mapping to get limit for error response
      CASE p_feature_type
        WHEN 'image_generation' THEN
          v_limit_column := 'image_generation_daily_limit';
        WHEN 'therai_calls' THEN
          v_limit_column := 'therai_calls_limit';
        WHEN 'chat' THEN
          v_limit_column := 'chat_messages_daily_limit';
        WHEN 'insights' THEN
          v_limit_column := 'insights_limit';
        ELSE
          v_limit_column := NULL;
      END CASE;
      
      -- Get limit if we have a column name
      IF v_limit_column IS NOT NULL THEN
        EXECUTE format('SELECT %I FROM plan_limits WHERE plan_id = $1 AND is_active = true', v_limit_column)
        INTO v_limit
        USING 'free';
      END IF;
      
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'Free trial expired. Upgrade to continue using AI features.',
        'error_code', 'TRIAL_EXPIRED',
        'trial_end_date', v_trial_end_date,
        'limit', v_limit,
        'current_usage', 0,
        'remaining', GREATEST(0, COALESCE(v_limit, 0))
      );
    END IF;
  END IF;
  
  -- 3. Determine reset date and feature mapping
  CASE p_feature_type
    WHEN 'voice_seconds' THEN
      v_limit_column := 'voice_seconds_limit';
      v_feature_column := 'voice_seconds';
      -- Voice uses voice_usage table, not feature_usage
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'Use check_voice_limit for voice features',
        'error_code', 'WRONG_FUNCTION',
        'limit', NULL,
        'current_usage', 0,
        'remaining', NULL
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
        'error_code', 'INVALID_FEATURE',
        'limit', NULL,
        'current_usage', 0,
        'remaining', NULL
      );
  END CASE;
  
  -- 4. Get limit from plan_limits table
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
  
  -- 5. AUTO-CREATE ROW: Ensure feature_usage row exists with today's reset date
  INSERT INTO feature_usage (user_id, last_reset_date)
  VALUES (p_user_id, v_reset_date)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- 6. Get current usage from feature_usage table (only count if reset date matches)
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
  
  -- 7. Check if limit exceeded
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
  
  -- 8. Allow access
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


COMMENT ON FUNCTION "public"."check_feature_limit"("p_user_id" "uuid", "p_feature_type" "text", "p_requested_amount" integer, "p_period" "text") IS 'Check feature limits with unified tracking. Images now use feature_usage instead of log table. Treats inactive/canceled subscriptions as free tier.';



CREATE OR REPLACE FUNCTION "public"."check_folder_ai_limit"("p_user_id" "uuid", "p_limit" integer DEFAULT 50) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_count INTEGER;
  v_last_reset TIMESTAMPTZ;
BEGIN
  SELECT operation_count, last_reset_at
  INTO v_count, v_last_reset
  FROM public.folder_ai_usage
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN true;
  END IF;

  IF v_last_reset < now() - INTERVAL '24 hours' THEN
    UPDATE public.folder_ai_usage
    SET operation_count = 0,
        last_reset_at = now(),
        updated_at = now()
    WHERE user_id = p_user_id;
    RETURN true;
  END IF;

  RETURN v_count < p_limit;
END;
$$;


ALTER FUNCTION "public"."check_folder_ai_limit"("p_user_id" "uuid", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_orphaned_data"() RETURNS TABLE("table_name" "text", "orphaned_count" bigint, "total_size_estimate" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
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


CREATE OR REPLACE FUNCTION "public"."clean_edge_function_logs"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
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



CREATE OR REPLACE FUNCTION "public"."conversations_broadcast_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'conversation:' || COALESCE(NEW.id, OLD.id)::text,
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."conversations_broadcast_trigger"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."conversations_broadcast_trigger"() IS 'Broadcasts conversation changes to per-folder private channels (folder:{folder_id}:conversations). 
Replaces postgres_changes subscriptions to reduce database load.';



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
    SET "search_path" TO 'public', 'pg_temp'
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
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
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
    VALUES (_user_id, 0)
    RETURNING credits INTO _current_credits;
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
  
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."deduct_credits"("_user_id" "uuid", "_credits" integer, "_endpoint" "text", "_reference_id" "uuid", "_description" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_user_account"("user_id_to_delete" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN 'thp_' || encode(digest(gen_random_uuid()::text, 'sha256'), 'hex');
END;
$$;


ALTER FUNCTION "public"."generate_api_key"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_all_users_admin"() RETURNS TABLE("user_id" "uuid", "email" "text", "created_at" timestamp with time zone, "last_sign_in_at" timestamp with time zone, "email_confirmed_at" timestamp with time zone, "role" "text", "balance_usd" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
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


CREATE OR REPLACE FUNCTION "public"."get_conversations_needing_buffer_processing"("inactivity_minutes" integer DEFAULT 10) RETURNS TABLE("conversation_id" "uuid", "user_id" "uuid", "pending_count" integer, "minutes_since_activity" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ca.conversation_id,
    ca.user_id,
    ca.pending_buffer_count,
    EXTRACT(EPOCH FROM (NOW() - ca.last_activity_at)) / 60.0 AS minutes_since_activity
  FROM conversation_activity ca
  WHERE 
    ca.pending_buffer_count > 0
    AND ca.buffer_processing_scheduled = false
    AND (NOW() - ca.last_activity_at) >= INTERVAL '1 minute' * inactivity_minutes
  ORDER BY ca.last_activity_at ASC;
END;
$$;


ALTER FUNCTION "public"."get_conversations_needing_buffer_processing"("inactivity_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_billing_cycle"("p_user_id" "uuid") RETURNS TABLE("cycle_start" "date", "cycle_end" "date")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
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


CREATE OR REPLACE FUNCTION "public"."get_message_archival_stats"() RETURNS TABLE("archived_messages" bigint, "active_messages" bigint, "conversations_with_archived" bigint, "oldest_archive_date" timestamp with time zone, "latest_archive_date" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Verify that the caller is an admin or service_role
  -- Only admins should be able to see global archival statistics
  IF auth.role() = 'service_role' OR public.check_user_admin_role(auth.uid()) THEN
    RETURN QUERY
    SELECT 
      COUNT(*) FILTER (WHERE archived_at IS NOT NULL) as archived_messages,
      COUNT(*) FILTER (WHERE archived_at IS NULL) as active_messages,
      COUNT(DISTINCT chat_id) FILTER (WHERE archived_at IS NOT NULL) as conversations_with_archived,
      MIN(archived_at) as oldest_archive_date,
      MAX(archived_at) as latest_archive_date
    FROM public.messages;
  ELSE
    RAISE EXCEPTION 'Access denied. Only administrators can view archival statistics.';
  END IF;
END;
$$;


ALTER FUNCTION "public"."get_message_archival_stats"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_message_archival_stats"() IS 'Returns message archival statistics. Requires admin role. Use this instead of the old message_archival_stats view.';



CREATE OR REPLACE FUNCTION "public"."get_next_engine_sequence"() RETURNS bigint
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
    AS $$
  SELECT nextval('engine_selector_seq');
$$;


ALTER FUNCTION "public"."get_next_engine_sequence"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_stripe_customer_id_for_user"("user_id_param" "uuid") RETURNS TABLE("stripe_customer_id" "text", "stripe_payment_method_id" "text")
    LANGUAGE "sql"
    SET "search_path" TO 'public', 'pg_temp'
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


CREATE OR REPLACE FUNCTION "public"."get_supabase_url"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  url text;
  project_ref text;
BEGIN
  BEGIN
    url := current_setting('app.settings.supabase_url', true);
  EXCEPTION WHEN others THEN
    url := NULL;
  END;
  IF url IS NOT NULL AND url <> '' THEN
    RETURN url;
  END IF;

  BEGIN
    project_ref := current_setting('app.settings.project_ref', true);
  EXCEPTION WHEN others THEN
    project_ref := NULL;
  END;
  IF project_ref IS NOT NULL AND project_ref <> '' THEN
    RETURN 'https://' || project_ref || '.supabase.co';
  END IF;

  RETURN '';
END;
$$;


ALTER FUNCTION "public"."get_supabase_url"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_email_by_id"("user_id_param" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hard_delete_archived_messages"("months_old" integer DEFAULT 12) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
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


COMMENT ON FUNCTION "public"."increment_feature_usage"("p_user_id" "uuid", "p_feature_type" "text", "p_amount" integer, "p_period" "text") IS 'Increments feature usage for a user. Fixed with SET search_path to prevent search path manipulation attacks.';



CREATE OR REPLACE FUNCTION "public"."increment_folder_ai_usage"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
    AS $$
BEGIN
  INSERT INTO public.folder_ai_usage (user_id, operation_count, last_reset_at, updated_at)
  VALUES (p_user_id, 1, now(), now())
  ON CONFLICT (user_id)
  DO UPDATE SET
    operation_count = public.folder_ai_usage.operation_count + 1,
    updated_at = now();
END;
$$;


ALTER FUNCTION "public"."increment_folder_ai_usage"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_images_generated"("p_user_id" "uuid", "p_count" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
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


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_edge_system"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select (select auth.jwt() ->> 'edge_role') = 'system';
$$;


ALTER FUNCTION "public"."is_edge_system"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_ip_allowed"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  ip text;
BEGIN
  -- Try x-forwarded-for header (as passed by PostgREST)
  BEGIN
    ip := current_setting('request.header.x-forwarded-for', true);
  EXCEPTION WHEN others THEN
    ip := NULL;
  END;

  -- Fallback: custom claim 'ip' in JWT
  IF ip IS NULL OR ip = '' THEN
    BEGIN
      ip := current_setting('request.jwt.claims', true)::jsonb ->> 'ip';
    EXCEPTION WHEN others THEN
      ip := NULL;
    END;
  END IF;

  -- Normalize (take first when comma-separated)
  IF position(',' IN coalesce(ip,'')) > 0 THEN
    ip := split_part(ip, ',', 1);
  END IF;

  IF ip IS NULL OR ip = '' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.ip_allowlist a
    WHERE a.ip_address = ip
      AND (a.expires_at IS NULL OR a.expires_at > now())
  );
END;
$$;


ALTER FUNCTION "public"."is_ip_allowed"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_user_in_trial"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
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


CREATE OR REPLACE FUNCTION "public"."list_folder_journals"("p_folder_id" "uuid", "p_limit" integer DEFAULT 20, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "folder_id" "uuid", "folder_name" "text", "user_id" "uuid", "client_id" "uuid", "title" "text", "entry_text" "text", "tags" "text"[], "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    j.id,
    j.folder_id,
    f.name AS folder_name,
    j.user_id,
    j.client_id,
    j.title,
    j.entry_text,
    j.tags,
    j.created_at,
    j.updated_at
  FROM public.journal_entries j
  JOIN public.chat_folders f ON f.id = j.folder_id
  WHERE j.folder_id = p_folder_id
    AND EXISTS (
      SELECT 1
      FROM public.chat_folders cf
      WHERE cf.id = p_folder_id
        AND cf.user_id = (SELECT auth.uid())
    )
  ORDER BY j.created_at DESC
  LIMIT GREATEST(p_limit, 0)
  OFFSET GREATEST(p_offset, 0);
$$;


ALTER FUNCTION "public"."list_folder_journals"("p_folder_id" "uuid", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_modal_ready_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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


CREATE OR REPLACE FUNCTION "public"."recent_user_documents"("p_limit" integer DEFAULT 20, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "folder_id" "uuid", "folder_name" "text", "user_id" "uuid", "file_name" "text", "file_type" "text", "file_extension" "text", "file_size" integer, "file_path" "text", "upload_status" "text", "created_at" timestamp with time zone)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    d.id,
    d.folder_id,
    f.name AS folder_name,
    d.user_id,
    d.file_name,
    d.file_type,
    d.file_extension,
    d.file_size,
    d.file_path,
    d.upload_status,
    d.created_at
  FROM public.folder_documents d
  JOIN public.chat_folders f ON f.id = d.folder_id
  WHERE d.user_id = (SELECT auth.uid())
  ORDER BY d.created_at DESC
  LIMIT GREATEST(p_limit, 0)
  OFFSET GREATEST(p_offset, 0);
$$;


ALTER FUNCTION "public"."recent_user_documents"("p_limit" integer, "p_offset" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."recent_user_documents"("p_limit" integer, "p_offset" integer) IS 'Recent uploads for current user across folders.';



CREATE OR REPLACE FUNCTION "public"."reset_folder_ai_usage"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
    AS $$
BEGIN
  UPDATE public.folder_ai_usage
  SET operation_count = 0,
      last_reset_at = now(),
      updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."reset_folder_ai_usage"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_folder_documents"("p_folder_id" "uuid", "p_q" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 20, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "folder_id" "uuid", "folder_name" "text", "user_id" "uuid", "file_name" "text", "file_type" "text", "file_extension" "text", "file_size" integer, "file_path" "text", "upload_status" "text", "error_message" "text", "metadata" "jsonb", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    d.id,
    d.folder_id,
    f.name AS folder_name,
    d.user_id,
    d.file_name,
    d.file_type,
    d.file_extension,
    d.file_size,
    d.file_path,
    d.upload_status,
    d.error_message,
    d.metadata,
    d.created_at,
    d.updated_at
  FROM public.folder_documents d
  JOIN public.chat_folders f ON f.id = d.folder_id
  WHERE d.folder_id = p_folder_id
    AND (
      p_q IS NULL
      OR d.file_name ILIKE '%' || p_q || '%'
      OR COALESCE(d.content_text, '') ILIKE '%' || p_q || '%'
    )
    -- RLS-aligned check: ensure caller has access to this folder
    AND EXISTS (
      SELECT 1
      FROM public.chat_folders cf
      WHERE cf.id = p_folder_id
        AND cf.user_id = (SELECT auth.uid())
    )
  ORDER BY d.created_at DESC
  LIMIT GREATEST(p_limit, 0)
  OFFSET GREATEST(p_offset, 0);
$$;


ALTER FUNCTION "public"."search_folder_documents"("p_folder_id" "uuid", "p_q" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."search_folder_documents"("p_folder_id" "uuid", "p_q" "text", "p_limit" integer, "p_offset" integer) IS 'Search documents within a folder with RLS-aligned ownership checks; returns folder name for UI.';



CREATE OR REPLACE FUNCTION "public"."send_notification_email"("template_type" "text", "recipient_email" "text", "variables" "jsonb" DEFAULT '{}'::"jsonb") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
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
    SET "search_path" TO 'public', 'pg_temp'
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
    SET "search_path" TO 'public', 'pg_temp'
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
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Only set trial for new free users (gives access to premium features for 7 days)
  -- After trial, free users keep 3 daily chat messages
  IF NEW.trial_end_date IS NULL AND NEW.subscription_plan = 'free' THEN
    NEW.trial_end_date := NEW.created_at + INTERVAL '30 days'; -- Extended to 30 days
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_trial_end_date"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_active_payment_method"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;


ALTER FUNCTION "public"."touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_api_keys_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_api_keys_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_api_usage_costs"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
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


CREATE OR REPLACE FUNCTION "public"."update_buffer_pending_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."update_buffer_pending_count"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_buffer_pending_count"() IS 'Secure version: Gets credentials from vault instead of hardcoded JWT tokens';



CREATE OR REPLACE FUNCTION "public"."update_chat_folders_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_chat_folders_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_conversation_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  conv_user_id UUID;
BEGIN
  -- Only track completed messages
  IF NEW.status = 'complete' THEN
    -- Get user_id once (avoid repeated subquery)
    SELECT user_id INTO conv_user_id FROM conversations WHERE id = NEW.chat_id;
    
    INSERT INTO conversation_activity (
      conversation_id,
      user_id,
      last_user_message_at,
      last_assistant_message_at,
      last_activity_at
    ) VALUES (
      NEW.chat_id,
      COALESCE(NEW.user_id, conv_user_id),
      CASE WHEN NEW.role = 'user' THEN NEW.created_at ELSE NULL END,
      CASE WHEN NEW.role = 'assistant' THEN NEW.created_at ELSE NULL END,
      NEW.created_at
    )
    ON CONFLICT (conversation_id) DO UPDATE SET
      last_user_message_at = CASE 
        WHEN NEW.role = 'user' THEN NEW.created_at 
        ELSE conversation_activity.last_user_message_at 
      END,
      last_assistant_message_at = CASE 
        WHEN NEW.role = 'assistant' THEN NEW.created_at 
        ELSE conversation_activity.last_assistant_message_at 
      END,
      last_activity_at = NEW.created_at,
      updated_at = NOW(),
      buffer_processing_scheduled = false;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_conversation_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_email_templates_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_email_templates_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_folder_documents_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_folder_documents_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_geo_cache_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_geo_cache_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_landing_page_config_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_landing_page_config_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_modified_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_modified_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_service_purchases_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_stripe_flow_tracking_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_system_prompts_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_system_prompts_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_token_emails_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_token_emails_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_profile_list_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_user_profile_list_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_voice_previews_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
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
    SET "search_path" TO 'public', 'auth', 'extensions', 'pg_temp'
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


CREATE TABLE IF NOT EXISTS "public"."chat_folder_participants" (
    "folder_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "invited_by" "uuid",
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "can_view_journals" boolean DEFAULT true NOT NULL,
    "can_add_journals" boolean DEFAULT true NOT NULL,
    "can_view_documents" boolean DEFAULT false NOT NULL,
    "can_add_documents" boolean DEFAULT false NOT NULL,
    "can_view_conversations" boolean DEFAULT false NOT NULL,
    "can_view_insights" boolean DEFAULT false NOT NULL,
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
    "profile_id" "uuid",
    "has_profile_setup" boolean DEFAULT false,
    CONSTRAINT "chat_folders_name_length" CHECK ((("char_length"("name") > 0) AND ("char_length"("name") <= 100)))
);


ALTER TABLE "public"."chat_folders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversation_activity" (
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "last_user_message_at" timestamp with time zone,
    "last_assistant_message_at" timestamp with time zone,
    "last_activity_at" timestamp with time zone DEFAULT "now"(),
    "last_buffer_processed_at" timestamp with time zone,
    "pending_buffer_count" integer DEFAULT 0,
    "inactivity_threshold_minutes" integer DEFAULT 10,
    "buffer_processing_scheduled" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."conversation_activity" OWNER TO "postgres";


COMMENT ON TABLE "public"."conversation_activity" IS 'Tracks conversation activity for intelligent buffer processing';



COMMENT ON COLUMN "public"."conversation_activity"."buffer_processing_scheduled" IS 'Flag to prevent duplicate processing triggers';



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



CREATE TABLE IF NOT EXISTS "public"."folder_ai_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "folder_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "folder_ai_messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text", 'system'::"text", 'tool'::"text"]))),
    CONSTRAINT "folder_ai_messages_role_lowercase" CHECK (("role" = "lower"("role")))
);


ALTER TABLE "public"."folder_ai_messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."folder_ai_messages" IS 'Stores AI conversation history scoped per folder, for cross-analysis with folder content.';



CREATE TABLE IF NOT EXISTS "public"."folder_ai_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "operation_count" integer DEFAULT 0 NOT NULL,
    "last_reset_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."folder_ai_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."folder_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "folder_id" "uuid" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_type" "text" NOT NULL,
    "file_size" integer NOT NULL,
    "file_extension" "text" NOT NULL,
    "file_path" "text",
    "content_text" "text",
    "upload_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "error_message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ai_generated" boolean DEFAULT false,
    "ai_metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "parent_document_id" "uuid",
    CONSTRAINT "folder_documents_file_size_check" CHECK (("file_size" >= 0)),
    CONSTRAINT "folder_documents_upload_status_check" CHECK (("upload_status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."folder_documents" OWNER TO "postgres";


COMMENT ON TABLE "public"."folder_documents" IS 'Stores uploaded documents associated with folders';



COMMENT ON COLUMN "public"."folder_documents"."file_path" IS 'Path in Supabase Storage bucket';



COMMENT ON COLUMN "public"."folder_documents"."content_text" IS 'Extracted text content for search and insights';



COMMENT ON COLUMN "public"."folder_documents"."ai_generated" IS 'Whether this document was created by the Folder AI';



COMMENT ON COLUMN "public"."folder_documents"."ai_metadata" IS 'AI-related metadata including message_id, draft_status, and other context';



COMMENT ON COLUMN "public"."folder_documents"."version" IS 'Document version number (incremented on AI updates)';



COMMENT ON COLUMN "public"."folder_documents"."parent_document_id" IS 'Reference to parent document for versioning';



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
    "folder_id" "uuid",
    CONSTRAINT "insights_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."insights" OWNER TO "postgres";


COMMENT ON COLUMN "public"."insights"."folder_id" IS 'Optional link to folder for organizing insights';



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
    "user_id" "uuid" NOT NULL,
    "title" "text",
    "entry_text" "text" NOT NULL,
    "tags" "text"[],
    "linked_report_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "folder_id" "uuid"
);


ALTER TABLE "public"."journal_entries" OWNER TO "postgres";


COMMENT ON COLUMN "public"."journal_entries"."folder_id" IS 'Optional link to folder for organizing journal entries (owned by the folder''s user)';



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


ALTER TABLE "public"."messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."messages" IS 'Messages table - realtime disabled, using broadcast events via unified channel for WebSocket optimization';



COMMENT ON COLUMN "public"."messages"."mode" IS 'Chat mode when this message was sent (chat, astro, etc.)';



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


COMMENT ON TABLE "public"."price_list" IS 'Product pricing catalog - Plus ($8/month A/B test), Growth ($10/month), Premium ($18/month)';



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
    "subscription_end_date" timestamp with time zone,
    "ab_test_group" "text",
    "onboarding_modal_closed" boolean DEFAULT false
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."verification_token" IS 'Custom email verification token generated during signup';



COMMENT ON COLUMN "public"."profiles"."display_name" IS 'User-friendly display name for the profile';



COMMENT ON COLUMN "public"."profiles"."trial_end_date" IS '1-week free trial end date. After this, free users can only access Together Mode (no AI features).';



COMMENT ON COLUMN "public"."profiles"."has_seen_subscription_page" IS 'Flag set to true after user has seen the subscription page during onboarding. Used to control when starter questions are shown.';



COMMENT ON COLUMN "public"."profiles"."ab_test_group" IS 'A/B test group identifier (e.g., "plus_plan", "growth_plan"). Used to show different pricing options to different users.';



COMMENT ON COLUMN "public"."profiles"."onboarding_modal_closed" IS 'Tracks when the onboarding modal has fully closed during the onboarding flow';



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


COMMENT ON TABLE "public"."translator_logs" IS 'Logs from translator-edge function. Users can read their own logs via chat_id ownership. Duplicate index removed in migration: dropped translator_logs_user_id_idx, kept idx_translator_logs_chat_id.';



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
    "promoted_from_buffer_id" "uuid",
    "memory_tier" "text" DEFAULT 'long_term'::"text",
    CONSTRAINT "user_memory_confidence_score_check" CHECK ((("confidence_score" >= (0)::numeric) AND ("confidence_score" <= (1)::numeric))),
    CONSTRAINT "user_memory_memory_tier_check" CHECK (("memory_tier" = ANY (ARRAY['long_term'::"text", 'medium_term'::"text"])))
);


ALTER TABLE "public"."user_memory" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_memory" IS 'Stores individual memories extracted from profile-based conversations';



COMMENT ON COLUMN "public"."user_memory"."source_message_id" IS 'Links to the message that created this memory for traceability';



COMMENT ON COLUMN "public"."user_memory"."turn_index" IS 'Conversation turn number when memory was created';



COMMENT ON COLUMN "public"."user_memory"."origin_mode" IS 'Conversation mode: chat|astro|profile|together|swiss';



COMMENT ON COLUMN "public"."user_memory"."deleted_at" IS 'Soft delete timestamp for GDPR compliance';



COMMENT ON COLUMN "public"."user_memory"."canonical_hash" IS 'SHA-256 hash of canonicalized memory text for fast duplicate detection';



COMMENT ON COLUMN "public"."user_memory"."memory_metadata" IS 'JSONB metadata: time_horizon, value_score, rationale, extractor info';



CREATE TABLE IF NOT EXISTS "public"."user_memory_buffer" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "source_message_id" "uuid" NOT NULL,
    "observation_text" "text" NOT NULL,
    "observation_type" "text" NOT NULL,
    "confidence_score" numeric(4,3) DEFAULT 0.850,
    "value_score" numeric(4,3) DEFAULT 0.750,
    "time_horizon" "text" DEFAULT 'seasonal'::"text",
    "turns_observed" integer DEFAULT 1,
    "last_seen_at" timestamp with time zone DEFAULT "now"(),
    "first_seen_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'pending'::"text",
    "related_buffer_ids" "uuid"[],
    "extraction_metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_memory_buffer_observation_type_check" CHECK (("observation_type" = ANY (ARRAY['fact'::"text", 'emotion'::"text", 'goal'::"text", 'pattern'::"text", 'relationship'::"text"]))),
    CONSTRAINT "user_memory_buffer_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'contradicted'::"text", 'superseded'::"text", 'merged'::"text"]))),
    CONSTRAINT "user_memory_buffer_time_horizon_check" CHECK (("time_horizon" = ANY (ARRAY['enduring'::"text", 'seasonal'::"text", 'ephemeral'::"text"])))
);


ALTER TABLE "public"."user_memory_buffer" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_memory_buffer" IS 'Short-term buffer for memory observations awaiting context validation';



COMMENT ON COLUMN "public"."user_memory_buffer"."turns_observed" IS 'Number of conversation turns this observation has been tracked';



COMMENT ON COLUMN "public"."user_memory_buffer"."status" IS 'pending: awaiting validation, confirmed: ready for commit, contradicted: discard, superseded: replaced by better observation, merged: combined with another';



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


CREATE TABLE IF NOT EXISTS "public"."web_leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text",
    "email" "text" NOT NULL,
    "company" "text",
    "role" "text",
    "phone" "text",
    "message" "text",
    "lead_type" "text" NOT NULL,
    "source" "text" DEFAULT 'custom-ai-site'::"text",
    "page_path" "text",
    "utm_medium" "text",
    "utm_campaign" "text",
    "newsletter_opt_in" boolean DEFAULT false,
    "status" "text" DEFAULT 'new'::"text",
    CONSTRAINT "web_leads_lead_type_check" CHECK (("lead_type" = ANY (ARRAY['contact'::"text", 'lead_magnet'::"text", 'newsletter'::"text", 'booking'::"text"]))),
    CONSTRAINT "web_leads_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'qualified'::"text", 'contacted'::"text", 'won'::"text", 'lost'::"text"])))
);


ALTER TABLE "public"."web_leads" OWNER TO "postgres";


COMMENT ON TABLE "public"."web_leads" IS 'Stores lead information from marketing website forms (contact, newsletter, lead magnets, booking requests)';



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



ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."calendar_sessions"
    ADD CONSTRAINT "calendar_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_folder_participants"
    ADD CONSTRAINT "chat_folder_participants_pkey" PRIMARY KEY ("folder_id", "user_id");



ALTER TABLE ONLY "public"."chat_folders"
    ADD CONSTRAINT "chat_folders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_activity"
    ADD CONSTRAINT "conversation_activity_pkey" PRIMARY KEY ("conversation_id");



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



ALTER TABLE ONLY "public"."folder_ai_messages"
    ADD CONSTRAINT "folder_ai_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."folder_ai_usage"
    ADD CONSTRAINT "folder_ai_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."folder_documents"
    ADD CONSTRAINT "folder_documents_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."system_prompts"
    ADD CONSTRAINT "system_prompts_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."translator_logs"
    ADD CONSTRAINT "translator_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_credits"
    ADD CONSTRAINT "user_credits_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_images"
    ADD CONSTRAINT "user_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_memory_buffer"
    ADD CONSTRAINT "user_memory_buffer_pkey" PRIMARY KEY ("id");



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



CREATE INDEX "credit_transactions_email_idx" ON "public"."payment_method" USING "btree" ("email");



CREATE INDEX "credit_transactions_stripe_customer_id_idx" ON "public"."payment_method" USING "btree" ("stripe_customer_id");



CREATE INDEX "credit_transactions_user_ts_idx" ON "public"."payment_method" USING "btree" ("user_id", "ts" DESC);



CREATE INDEX "idx_blog_posts_content_type" ON "public"."blog_posts" USING "btree" ("content_type") WHERE ("published" = true);



CREATE INDEX "idx_blog_posts_featured" ON "public"."blog_posts" USING "btree" ("featured") WHERE (("published" = true) AND ("featured" = true));



CREATE INDEX "idx_blog_posts_tags" ON "public"."blog_posts" USING "gin" ("tags") WHERE ("published" = true);



CREATE INDEX "idx_caches_expires" ON "public"."conversation_caches" USING "btree" ("expires_at");



CREATE INDEX "idx_calendar_sessions_coach_id" ON "public"."calendar_sessions" USING "btree" ("coach_id");



CREATE INDEX "idx_chat_folder_participants_folder_id" ON "public"."chat_folder_participants" USING "btree" ("folder_id");



CREATE INDEX "idx_chat_folder_participants_invited_by" ON "public"."chat_folder_participants" USING "btree" ("invited_by");



CREATE INDEX "idx_chat_folder_participants_user_folder" ON "public"."chat_folder_participants" USING "btree" ("user_id", "folder_id");



CREATE INDEX "idx_chat_folder_participants_user_id" ON "public"."chat_folder_participants" USING "btree" ("user_id");



CREATE INDEX "idx_chat_folders_id_user" ON "public"."chat_folders" USING "btree" ("id", "user_id");



CREATE INDEX "idx_chat_folders_is_public" ON "public"."chat_folders" USING "btree" ("is_public") WHERE ("is_public" = true);



CREATE INDEX "idx_chat_folders_profile_id" ON "public"."chat_folders" USING "btree" ("profile_id");



CREATE INDEX "idx_chat_folders_user_id" ON "public"."chat_folders" USING "btree" ("user_id");



CREATE INDEX "idx_conversation_activity_last_activity" ON "public"."conversation_activity" USING "btree" ("last_activity_at");



CREATE INDEX "idx_conversation_activity_pending_buffer" ON "public"."conversation_activity" USING "btree" ("pending_buffer_count") WHERE ("pending_buffer_count" > 0);



CREATE INDEX "idx_conversation_caches_chat_id" ON "public"."conversation_caches" USING "btree" ("chat_id", "expires_at");



CREATE INDEX "idx_conversation_summaries_chat" ON "public"."conversation_summaries" USING "btree" ("chat_id");



CREATE INDEX "idx_conversation_summaries_latest" ON "public"."conversation_summaries" USING "btree" ("chat_id", "created_at" DESC);



COMMENT ON INDEX "public"."idx_conversation_summaries_latest" IS 'Index on (chat_id, created_at DESC) for fetching latest summaries per conversation. Replaces duplicate idx_summaries_chat_created index.';



CREATE INDEX "idx_conversations_created_at" ON "public"."conversations" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_conversations_folder_id" ON "public"."conversations" USING "btree" ("folder_id");



CREATE INDEX "idx_conversations_owner" ON "public"."conversations" USING "btree" ("owner_user_id");



CREATE INDEX "idx_conversations_participants_conversation_id" ON "public"."conversations_participants" USING "btree" ("conversation_id");



CREATE INDEX "idx_conversations_participants_invited_by" ON "public"."conversations_participants" USING "btree" ("invited_by");



CREATE INDEX "idx_conversations_participants_user_id" ON "public"."conversations_participants" USING "btree" ("user_id");



CREATE INDEX "idx_conversations_profile_id" ON "public"."conversations" USING "btree" ("profile_id");



CREATE INDEX "idx_conversations_public" ON "public"."conversations" USING "btree" ("is_public");



CREATE INDEX "idx_conversations_user" ON "public"."conversations" USING "btree" ("user_id");



CREATE INDEX "idx_conversations_user_mode_created" ON "public"."conversations" USING "btree" ("user_id", "mode", "created_at" DESC);



CREATE INDEX "idx_conversations_user_profile" ON "public"."conversations" USING "btree" ("user_id", "profile_id") WHERE ("profile_id" IS NOT NULL);



CREATE INDEX "idx_credit_transactions_user" ON "public"."credit_transactions" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_credit_tx_user_id" ON "public"."credit_transactions" USING "btree" ("user_id");



CREATE INDEX "idx_feature_usage_user_reset_lookup" ON "public"."feature_usage" USING "btree" ("user_id", "last_reset_date", "images_generated", "chat_messages", "therai_calls", "insights_count");



CREATE INDEX "idx_folder_ai_messages_created_at" ON "public"."folder_ai_messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_folder_ai_messages_folder_created" ON "public"."folder_ai_messages" USING "btree" ("folder_id", "created_at" DESC);



CREATE INDEX "idx_folder_ai_messages_folder_id" ON "public"."folder_ai_messages" USING "btree" ("folder_id");



COMMENT ON INDEX "public"."idx_folder_ai_messages_folder_id" IS 'Index on folder_id for folder_ai_messages queries. Replaces duplicate idx_folder_ai_messages_folder_fk index (auto-created from FK constraint).';



CREATE INDEX "idx_folder_ai_messages_folder_user_created" ON "public"."folder_ai_messages" USING "btree" ("folder_id", "user_id", "created_at" DESC);



CREATE INDEX "idx_folder_ai_messages_metadata_gin" ON "public"."folder_ai_messages" USING "gin" ("metadata");



CREATE INDEX "idx_folder_ai_messages_user_id" ON "public"."folder_ai_messages" USING "btree" ("user_id");



COMMENT ON INDEX "public"."idx_folder_ai_messages_user_id" IS 'Index on user_id for folder_ai_messages queries. Replaces duplicate idx_folder_ai_messages_user_fk index (auto-created from FK constraint).';



CREATE UNIQUE INDEX "idx_folder_ai_usage_user_id" ON "public"."folder_ai_usage" USING "btree" ("user_id");



CREATE INDEX "idx_folder_documents_ai_generated" ON "public"."folder_documents" USING "btree" ("ai_generated") WHERE ("ai_generated" = true);



CREATE INDEX "idx_folder_documents_created_at" ON "public"."folder_documents" USING "btree" ("created_at");



CREATE INDEX "idx_folder_documents_folder_created_at" ON "public"."folder_documents" USING "btree" ("folder_id", "created_at" DESC);



CREATE INDEX "idx_folder_documents_folder_id" ON "public"."folder_documents" USING "btree" ("folder_id");



CREATE INDEX "idx_folder_documents_parent" ON "public"."folder_documents" USING "btree" ("parent_document_id") WHERE ("parent_document_id" IS NOT NULL);



CREATE INDEX "idx_folder_documents_status" ON "public"."folder_documents" USING "btree" ("upload_status");



CREATE INDEX "idx_folder_documents_user_id" ON "public"."folder_documents" USING "btree" ("user_id");



CREATE INDEX "idx_insights_created_at" ON "public"."insights" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_insights_folder_id" ON "public"."insights" USING "btree" ("folder_id");



CREATE INDEX "idx_insights_is_ready" ON "public"."insights" USING "btree" ("is_ready");



CREATE INDEX "idx_insights_status" ON "public"."insights" USING "btree" ("status");



CREATE INDEX "idx_insights_user_id" ON "public"."insights" USING "btree" ("user_id");



CREATE INDEX "idx_ip_allowlist_expires_at" ON "public"."ip_allowlist" USING "btree" ("expires_at");



CREATE INDEX "idx_journal_entries_client_id" ON "public"."journal_entries" USING "btree" ("client_id");



CREATE INDEX "idx_journal_entries_coach_id" ON "public"."journal_entries" USING "btree" ("user_id");



CREATE INDEX "idx_journal_entries_folder_id" ON "public"."journal_entries" USING "btree" ("folder_id");



CREATE INDEX "idx_memory_buffer_conversation" ON "public"."user_memory_buffer" USING "btree" ("conversation_id", "status");



CREATE INDEX "idx_memory_buffer_last_seen" ON "public"."user_memory_buffer" USING "btree" ("last_seen_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_memory_buffer_profile" ON "public"."user_memory_buffer" USING "btree" ("profile_id", "user_id");



CREATE INDEX "idx_memory_buffer_user_pending" ON "public"."user_memory_buffer" USING "btree" ("user_id", "status") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_messages_archived" ON "public"."messages" USING "btree" ("archived_at") WHERE ("archived_at" IS NOT NULL);



CREATE INDEX "idx_messages_chat_id" ON "public"."messages" USING "btree" ("chat_id");



CREATE INDEX "idx_messages_chat_role_created_desc" ON "public"."messages" USING "btree" ("chat_id", "role", "created_at" DESC);



CREATE INDEX "idx_messages_context_injected" ON "public"."messages" USING "btree" ("chat_id", "context_injected") WHERE ("context_injected" = true);



CREATE INDEX "idx_messages_history_optimized" ON "public"."messages" USING "btree" ("chat_id", "created_at" DESC) WHERE (("role" <> 'system'::"text") AND ("status" = 'complete'::"text") AND ("text" IS NOT NULL) AND ("text" <> ''::"text"));



CREATE INDEX "idx_messages_system_optimized" ON "public"."messages" USING "btree" ("chat_id", "created_at") WHERE (("role" = 'system'::"text") AND ("status" = 'complete'::"text") AND ("text" IS NOT NULL) AND ("text" <> ''::"text"));



CREATE INDEX "idx_messages_user_id" ON "public"."messages" USING "btree" ("user_id");



CREATE INDEX "idx_monthly_summaries_user" ON "public"."user_memory_monthly_summaries" USING "btree" ("user_id", "year" DESC, "month" DESC);



CREATE INDEX "idx_password_reset_tokens_expires_at" ON "public"."password_reset_tokens" USING "btree" ("expires_at");



CREATE INDEX "idx_payment_method_user_active" ON "public"."payment_method" USING "btree" ("user_id", "active");



CREATE INDEX "idx_payment_method_user_id" ON "public"."payment_method" USING "btree" ("user_id");



CREATE INDEX "idx_plan_limits_active_limits" ON "public"."plan_limits" USING "btree" ("plan_id", "is_active", "image_generation_daily_limit", "chat_messages_daily_limit", "therai_calls_limit", "insights_limit");



CREATE INDEX "idx_plan_limits_plan_id" ON "public"."plan_limits" USING "btree" ("plan_id") WHERE ("is_active" = true);



CREATE INDEX "idx_profiles_ab_test_group" ON "public"."profiles" USING "btree" ("ab_test_group") WHERE ("ab_test_group" IS NOT NULL);



CREATE INDEX "idx_profiles_has_profile_setup" ON "public"."profiles" USING "btree" ("has_profile_setup");



CREATE INDEX "idx_profiles_has_seen_subscription_page" ON "public"."profiles" USING "btree" ("has_seen_subscription_page");



CREATE INDEX "idx_profiles_stripe_customer_id" ON "public"."profiles" USING "btree" ("stripe_customer_id");



CREATE INDEX "idx_profiles_stripe_subscription_id" ON "public"."profiles" USING "btree" ("stripe_subscription_id");



CREATE INDEX "idx_profiles_subscription_lookup" ON "public"."profiles" USING "btree" ("id", "subscription_plan", "subscription_active", "subscription_status", "trial_end_date");



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



CREATE INDEX "idx_system_prompts_category" ON "public"."system_prompts" USING "btree" ("category", "display_order");



CREATE INDEX "idx_topup_logs_user_id" ON "public"."topup_logs" USING "btree" ("user_id");



CREATE INDEX "idx_translator_logs_chat_id" ON "public"."translator_logs" USING "btree" ("chat_id");



CREATE INDEX "idx_user_credits_user_id" ON "public"."user_credits" USING "btree" ("user_id");



CREATE INDEX "idx_user_images_chat_id" ON "public"."user_images" USING "btree" ("chat_id") WHERE ("chat_id" IS NOT NULL);



CREATE INDEX "idx_user_images_message_id" ON "public"."user_images" USING "btree" ("message_id") WHERE ("message_id" IS NOT NULL);



CREATE INDEX "idx_user_images_user_id" ON "public"."user_images" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_user_memory_buffer_source_message_id" ON "public"."user_memory_buffer" USING "btree" ("source_message_id");



CREATE INDEX "idx_user_memory_conversation_id" ON "public"."user_memory" USING "btree" ("conversation_id");



CREATE INDEX "idx_user_memory_created" ON "public"."user_memory" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_user_memory_monthly_summaries_profile_id" ON "public"."user_memory_monthly_summaries" USING "btree" ("profile_id");



CREATE INDEX "idx_user_memory_profile_active" ON "public"."user_memory" USING "btree" ("user_id", "profile_id", "reference_count" DESC, "created_at" DESC) WHERE ("is_active" = true);



CREATE INDEX "idx_user_memory_profile_id" ON "public"."user_memory" USING "btree" ("profile_id");



CREATE INDEX "idx_user_memory_promoted_from_buffer_id" ON "public"."user_memory" USING "btree" ("promoted_from_buffer_id");



CREATE INDEX "idx_user_memory_reference" ON "public"."user_memory" USING "btree" ("reference_count" DESC, "last_referenced_at" DESC);



CREATE INDEX "idx_user_memory_tier" ON "public"."user_memory" USING "btree" ("user_id", "memory_tier");



CREATE INDEX "idx_user_memory_user_profile_active" ON "public"."user_memory" USING "btree" ("user_id", "profile_id", "is_active", "last_referenced_at" DESC) WHERE ("is_active" = true);



CREATE INDEX "idx_user_memory_weekly_summaries_profile_id" ON "public"."user_memory_weekly_summaries" USING "btree" ("profile_id");



CREATE UNIQUE INDEX "idx_user_profile_list_primary_per_user" ON "public"."user_profile_list" USING "btree" ("user_id") WHERE ("is_primary" = true);



CREATE INDEX "idx_user_profile_list_user_id" ON "public"."user_profile_list" USING "btree" ("user_id");



CREATE INDEX "idx_user_roles_role" ON "public"."user_roles" USING "btree" ("role");



CREATE INDEX "idx_user_roles_user_id" ON "public"."user_roles" USING "btree" ("user_id");



CREATE INDEX "idx_voice_usage_cycle_end" ON "public"."voice_usage" USING "btree" ("billing_cycle_end");



CREATE INDEX "idx_weekly_summaries_user" ON "public"."user_memory_weekly_summaries" USING "btree" ("user_id", "year" DESC, "week_number" DESC);



CREATE INDEX "ix_user_memory_canonical_hash" ON "public"."user_memory" USING "btree" ("canonical_hash") WHERE ("canonical_hash" IS NOT NULL);



CREATE INDEX "ix_user_memory_user_profile_hash" ON "public"."user_memory" USING "btree" ("user_id", "profile_id", "canonical_hash", "is_active") WHERE (("is_active" = true) AND ("canonical_hash" IS NOT NULL));



CREATE UNIQUE INDEX "messages_client_msg_id_key" ON "public"."messages" USING "btree" ("client_msg_id");



CREATE INDEX "translator_logs_created_at_idx" ON "public"."translator_logs" USING "btree" ("created_at");



CREATE INDEX "translator_logs_request_type_idx" ON "public"."translator_logs" USING "btree" ("request_type");



CREATE INDEX "user_memory_fts" ON "public"."user_memory" USING "gin" ("to_tsvector"('"english"'::"regconfig", COALESCE("memory_text", ''::"text")));



CREATE UNIQUE INDEX "ux_user_memory_source_message" ON "public"."user_memory" USING "btree" ("source_message_id") WHERE ("source_message_id" IS NOT NULL);



CREATE OR REPLACE TRIGGER "chat_folders_updated_at" BEFORE UPDATE ON "public"."chat_folders" FOR EACH ROW EXECUTE FUNCTION "public"."update_chat_folders_updated_at"();



CREATE OR REPLACE TRIGGER "conversations_broadcast_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."conversations" FOR EACH ROW EXECUTE FUNCTION "public"."conversations_broadcast_trigger"();



COMMENT ON TRIGGER "conversations_broadcast_trigger" ON "public"."conversations" IS 'Triggers broadcast events for conversation INSERT/UPDATE/DELETE to folder-specific channels.';



CREATE OR REPLACE TRIGGER "folder_documents_updated_at_trigger" BEFORE UPDATE ON "public"."folder_documents" FOR EACH ROW EXECUTE FUNCTION "public"."update_folder_documents_updated_at"();



CREATE OR REPLACE TRIGGER "set_trial_end_date_trigger" BEFORE INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_trial_end_date"();



CREATE OR REPLACE TRIGGER "track_buffer_pending_count" AFTER INSERT OR UPDATE ON "public"."user_memory_buffer" FOR EACH ROW EXECUTE FUNCTION "public"."update_buffer_pending_count"();



CREATE OR REPLACE TRIGGER "track_conversation_activity" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_conversation_activity"();



CREATE OR REPLACE TRIGGER "trg_deactivate_old_methods" AFTER INSERT ON "public"."payment_method" FOR EACH ROW EXECUTE FUNCTION "public"."deactivate_old_payment_methods"();



CREATE OR REPLACE TRIGGER "trg_handle_public_conversation" AFTER INSERT OR UPDATE OF "is_public" ON "public"."conversations" FOR EACH ROW EXECUTE FUNCTION "public"."handle_public_conversation_participant"();



CREATE OR REPLACE TRIGGER "trg_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_conversations_updated_at" BEFORE UPDATE ON "public"."conversations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_email_templates_updated_at" BEFORE UPDATE ON "public"."email_notification_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_email_templates_updated_at"();



CREATE OR REPLACE TRIGGER "update_geo_cache_updated_at" BEFORE UPDATE ON "public"."geo_cache" FOR EACH ROW EXECUTE FUNCTION "public"."update_geo_cache_updated_at"();



CREATE OR REPLACE TRIGGER "update_journal_entries_updated_at" BEFORE UPDATE ON "public"."journal_entries" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_landing_page_config_updated_at" BEFORE UPDATE ON "public"."landing_page_config" FOR EACH ROW EXECUTE FUNCTION "public"."update_landing_page_config_updated_at"();



CREATE OR REPLACE TRIGGER "update_system_prompts_updated_at" BEFORE UPDATE ON "public"."system_prompts" FOR EACH ROW EXECUTE FUNCTION "public"."update_system_prompts_updated_at"();



CREATE OR REPLACE TRIGGER "update_token_emails_updated_at" BEFORE UPDATE ON "public"."token_emails" FOR EACH ROW EXECUTE FUNCTION "public"."update_token_emails_updated_at"();



CREATE OR REPLACE TRIGGER "update_user_preferences_timestamp" BEFORE UPDATE ON "public"."user_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_timestamp"();



CREATE OR REPLACE TRIGGER "update_user_profile_list_updated_at_trigger" BEFORE UPDATE ON "public"."user_profile_list" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_profile_list_updated_at"();



ALTER TABLE ONLY "public"."chat_folder_participants"
    ADD CONSTRAINT "chat_folder_participants_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "public"."chat_folders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_folder_participants"
    ADD CONSTRAINT "chat_folder_participants_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chat_folder_participants"
    ADD CONSTRAINT "chat_folder_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_folders"
    ADD CONSTRAINT "chat_folders_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."user_profile_list"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chat_folders"
    ADD CONSTRAINT "chat_folders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_activity"
    ADD CONSTRAINT "conversation_activity_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



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



ALTER TABLE ONLY "public"."folder_ai_messages"
    ADD CONSTRAINT "folder_ai_messages_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "public"."chat_folders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."folder_ai_messages"
    ADD CONSTRAINT "folder_ai_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."folder_ai_usage"
    ADD CONSTRAINT "folder_ai_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."folder_documents"
    ADD CONSTRAINT "folder_documents_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "public"."chat_folders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."folder_documents"
    ADD CONSTRAINT "folder_documents_parent_document_id_fkey" FOREIGN KEY ("parent_document_id") REFERENCES "public"."folder_documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."folder_documents"
    ADD CONSTRAINT "folder_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."insights"
    ADD CONSTRAINT "insights_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "public"."chat_folders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."insights"
    ADD CONSTRAINT "insights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "public"."chat_folders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fk_auth_users" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_logs"
    ADD CONSTRAINT "report_logs_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."translator_logs"
    ADD CONSTRAINT "translator_logs_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_credits"
    ADD CONSTRAINT "user_credits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_images"
    ADD CONSTRAINT "user_images_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."conversations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_images"
    ADD CONSTRAINT "user_images_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_images"
    ADD CONSTRAINT "user_images_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_memory_buffer"
    ADD CONSTRAINT "user_memory_buffer_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_memory_buffer"
    ADD CONSTRAINT "user_memory_buffer_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."user_profile_list"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_memory_buffer"
    ADD CONSTRAINT "user_memory_buffer_source_message_id_fkey" FOREIGN KEY ("source_message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_memory"
    ADD CONSTRAINT "user_memory_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_memory_monthly_summaries"
    ADD CONSTRAINT "user_memory_monthly_summaries_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."user_profile_list"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_memory_monthly_summaries"
    ADD CONSTRAINT "user_memory_monthly_summaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_memory"
    ADD CONSTRAINT "user_memory_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."user_profile_list"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_memory"
    ADD CONSTRAINT "user_memory_promoted_from_buffer_id_fkey" FOREIGN KEY ("promoted_from_buffer_id") REFERENCES "public"."user_memory_buffer"("id") ON DELETE SET NULL;



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



CREATE POLICY "Admin delete user_roles" ON "public"."user_roles" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admin insert user_roles" ON "public"."user_roles" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin or edge delete" ON "public"."landing_page_config" FOR DELETE TO "authenticated" USING (("public"."is_admin"() OR "public"."is_edge_system"()));



CREATE POLICY "Admin or edge insert" ON "public"."landing_page_config" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin"() OR "public"."is_edge_system"()));



CREATE POLICY "Admin or edge select" ON "public"."landing_page_config" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR "public"."is_edge_system"()));



CREATE POLICY "Admin or edge select web_leads" ON "public"."web_leads" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR "public"."is_edge_system"()));



CREATE POLICY "Admin or edge update" ON "public"."landing_page_config" FOR UPDATE TO "authenticated" USING (("public"."is_admin"() OR "public"."is_edge_system"())) WITH CHECK (("public"."is_admin"() OR "public"."is_edge_system"()));



CREATE POLICY "Admin select user_roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admin update user_roles" ON "public"."user_roles" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can delete legal documents" ON "public"."legal_documents" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins can insert legal documents" ON "public"."legal_documents" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can update legal documents" ON "public"."legal_documents" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins full access admin_logs" ON "public"."admin_logs" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins full access ip_allowlist" ON "public"."ip_allowlist" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow public read access to geo_cache" ON "public"."geo_cache" FOR SELECT USING (true);



CREATE POLICY "Allow service role on blog_posts" ON "public"."blog_posts" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow service role only" ON "public"."report_prompts" TO "service_role" USING (true);



CREATE POLICY "Allow service role to insert/update geo_cache" ON "public"."geo_cache" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Allow service role to read email templates" ON "public"."token_emails" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "Allow service role to update geo_cache" ON "public"."geo_cache" FOR UPDATE TO "service_role" USING (true);



CREATE POLICY "Coach can delete own sessions" ON "public"."calendar_sessions" FOR DELETE USING (("coach_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Coach can insert sessions" ON "public"."calendar_sessions" FOR INSERT WITH CHECK (("coach_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Coach can update sessions" ON "public"."calendar_sessions" FOR UPDATE USING (("coach_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("coach_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Coach can view own sessions" ON "public"."calendar_sessions" FOR SELECT USING (("coach_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Public can read current legal documents" ON "public"."legal_documents" FOR SELECT USING (("is_current" = true));



CREATE POLICY "Public can read price list" ON "public"."price_list" FOR SELECT TO "anon", "authenticated" USING (true);



CREATE POLICY "Public can view active templates" ON "public"."website_templates" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Public can view published posts" ON "public"."blog_posts" FOR SELECT USING (("published" = true));



CREATE POLICY "Service role can manage all folder AI messages" ON "public"."folder_ai_messages" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage all folder AI usage" ON "public"."folder_ai_usage" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access on conversation_caches" ON "public"."conversation_caches" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access on conversation_summaries" ON "public"."conversation_summaries" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access to user images" ON "public"."user_images" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Users can delete own images" ON "public"."user_images" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their folder AI messages" ON "public"."folder_ai_messages" FOR DELETE TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."chat_folders" "cf"
  WHERE (("cf"."id" = "folder_ai_messages"."folder_id") AND ("cf"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Users can delete their own documents" ON "public"."folder_documents" FOR DELETE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."chat_folders" "cf"
  WHERE (("cf"."id" = "folder_documents"."folder_id") AND ("cf"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Users can delete their own profiles" ON "public"."user_profile_list" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert AI messages to their folders" ON "public"."folder_ai_messages" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."chat_folders" "cf"
  WHERE (("cf"."id" = "folder_ai_messages"."folder_id") AND ("cf"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Users can insert documents into their folders" ON "public"."folder_documents" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND ((EXISTS ( SELECT 1
   FROM "public"."chat_folders" "cf"
  WHERE (("cf"."id" = "folder_documents"."folder_id") AND ("cf"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."chat_folder_participants" "cfp"
  WHERE (("cfp"."folder_id" = "folder_documents"."folder_id") AND ("cfp"."user_id" = "auth"."uid"()) AND ("cfp"."can_add_documents" = true)))))));



CREATE POLICY "Users can insert own images" ON "public"."user_images" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own profiles" ON "public"."user_profile_list" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can join folders" ON "public"."chat_folder_participants" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can leave folders" ON "public"."chat_folder_participants" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can read their folder AI messages" ON "public"."folder_ai_messages" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can read their own folder AI usage" ON "public"."folder_ai_usage" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update own participant" ON "public"."chat_folder_participants" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own profiles" ON "public"."user_profile_list" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view documents in their folders" ON "public"."folder_documents" FOR SELECT USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."chat_folders" "cf"
  WHERE (("cf"."id" = "folder_documents"."folder_id") AND ("cf"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."chat_folder_participants" "cfp"
  WHERE (("cfp"."folder_id" = "folder_documents"."folder_id") AND ("cfp"."user_id" = "auth"."uid"()) AND ("cfp"."can_view_documents" = true))))));



CREATE POLICY "Users can view folder participants" ON "public"."chat_folder_participants" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own feature usage" ON "public"."feature_usage" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own images" ON "public"."user_images" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view participants" ON "public"."conversations_participants" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view their own profiles" ON "public"."user_profile_list" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."admin_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."blog_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."calendar_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_folder_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_folders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_folders_service_all" ON "public"."chat_folders" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "chat_folders_user_delete" ON "public"."chat_folders" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "chat_folders_user_insert" ON "public"."chat_folders" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "chat_folders_user_select_merged" ON "public"."chat_folders" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("is_public" = true) OR (EXISTS ( SELECT 1
   FROM "public"."chat_folder_participants" "p"
  WHERE (("p"."folder_id" = "chat_folders"."id") AND ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "chat_folders_user_update" ON "public"."chat_folders" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "conv_part_delete" ON "public"."conversations_participants" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "conv_part_insert" ON "public"."conversations_participants" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."conversation_activity" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversation_activity_service_all" ON "public"."conversation_activity" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."conversation_caches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversation_caches_service_all" ON "public"."conversation_caches" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "conversation_caches_user_select" ON "public"."conversation_caches" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "conversation_caches"."chat_id") AND (("c"."is_public" = true) OR (( SELECT "auth"."uid"() AS "uid") = COALESCE("c"."owner_user_id", "c"."user_id")) OR (EXISTS ( SELECT 1
           FROM "public"."conversations_participants" "cp"
          WHERE (("cp"."conversation_id" = "c"."id") AND ("cp"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))))));



ALTER TABLE "public"."conversation_summaries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversation_summaries_service_all" ON "public"."conversation_summaries" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "conversation_summaries_user_select" ON "public"."conversation_summaries" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "conversation_summaries"."chat_id") AND (("c"."is_public" = true) OR (( SELECT "auth"."uid"() AS "uid") = COALESCE("c"."owner_user_id", "c"."user_id")) OR (EXISTS ( SELECT 1
           FROM "public"."conversations_participants" "cp"
          WHERE (("cp"."conversation_id" = "c"."id") AND ("cp"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))))));



ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations_participants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "convo_delete_owner" ON "public"."conversations" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = COALESCE("owner_user_id", "user_id")));



CREATE POLICY "convo_insert_owner" ON "public"."conversations" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = COALESCE("owner_user_id", "user_id")));



CREATE POLICY "convo_select_participants" ON "public"."conversations" FOR SELECT USING ((("auth"."uid"() = "user_id") OR (("owner_user_id" IS NOT NULL) AND ("auth"."uid"() = "owner_user_id")) OR (EXISTS ( SELECT 1
   FROM "public"."conversations_participants" "cp"
  WHERE (("cp"."conversation_id" = "conversations"."id") AND ("cp"."user_id" = "auth"."uid"())))) OR ("is_public" = true) OR (("folder_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."chat_folder_participants" "cfp"
  WHERE (("cfp"."folder_id" = "conversations"."folder_id") AND ("cfp"."user_id" = "auth"."uid"()) AND ("cfp"."can_view_conversations" = true)))))));



CREATE POLICY "convo_service_all" ON "public"."conversations" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "convo_update_owner" ON "public"."conversations" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = COALESCE("owner_user_id", "user_id"))) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = COALESCE("owner_user_id", "user_id")));



ALTER TABLE "public"."credit_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "credit_tx_service_all" ON "public"."credit_transactions" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "credit_tx_user_select" ON "public"."credit_transactions" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."debug_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."domain_slugs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "domain_slugs_select" ON "public"."domain_slugs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "domain_slugs_service_all" ON "public"."domain_slugs" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."email_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "email_messages_service_all" ON "public"."email_messages" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."email_notification_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feature_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."folder_ai_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "folder_ai_messages_service_all" ON "public"."folder_ai_messages" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "folder_ai_messages_user_modify" ON "public"."folder_ai_messages" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."folder_ai_usage" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "folder_ai_usage_service_all" ON "public"."folder_ai_usage" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "folder_ai_usage_user_modify" ON "public"."folder_ai_usage" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."folder_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "folder_documents_service_all" ON "public"."folder_documents" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "folder_documents_user_update" ON "public"."folder_documents" FOR UPDATE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."chat_folders" "cf"
  WHERE (("cf"."id" = "folder_documents"."folder_id") AND ("cf"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."chat_folders" "cf"
  WHERE (("cf"."id" = "folder_documents"."folder_id") AND ("cf"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



ALTER TABLE "public"."geo_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."insights" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insights_service_all" ON "public"."insights" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "insights_user_delete" ON "public"."insights" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "insights_user_insert" ON "public"."insights" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "insights_user_select" ON "public"."insights" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."chat_folders" "cf"
  WHERE (("cf"."id" = "insights"."folder_id") AND ("cf"."user_id" = "auth"."uid"())))) OR (("folder_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."chat_folder_participants" "cfp"
  WHERE (("cfp"."folder_id" = "insights"."folder_id") AND ("cfp"."user_id" = "auth"."uid"()) AND ("cfp"."can_view_insights" = true)))))));



CREATE POLICY "insights_user_update" ON "public"."insights" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."ip_allowlist" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "journal_delete" ON "public"."journal_entries" FOR DELETE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."journal_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "journal_insert" ON "public"."journal_entries" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (("folder_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."chat_folders" "cf"
  WHERE (("cf"."id" = "journal_entries"."folder_id") AND ("cf"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."chat_folder_participants" "cfp"
  WHERE (("cfp"."folder_id" = "journal_entries"."folder_id") AND ("cfp"."user_id" = "auth"."uid"()) AND ("cfp"."can_add_journals" = true)))))));



CREATE POLICY "journal_select" ON "public"."journal_entries" FOR SELECT USING ((("auth"."uid"() = "user_id") OR (("folder_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."chat_folder_participants" "cfp"
  WHERE (("cfp"."folder_id" = "journal_entries"."folder_id") AND ("cfp"."user_id" = "auth"."uid"()) AND ("cfp"."can_view_journals" = true))))) OR (("folder_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."chat_folders" "cf"
  WHERE (("cf"."id" = "journal_entries"."folder_id") AND ("cf"."user_id" = "auth"."uid"())))))));



CREATE POLICY "journal_update" ON "public"."journal_entries" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."landing_page_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."legal_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "msg_delete_author" ON "public"."messages" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "msg_insert_participants" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."chat_id") AND (("c"."user_id" = "auth"."uid"()) OR ("c"."owner_user_id" = "auth"."uid"()) OR ("c"."is_public" = true) OR (EXISTS ( SELECT 1
           FROM "public"."conversations_participants" "cp"
          WHERE (("cp"."conversation_id" = "c"."id") AND ("cp"."user_id" = "auth"."uid"())))) OR (("c"."folder_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."chat_folder_participants" "cfp"
          WHERE (("cfp"."folder_id" = "c"."folder_id") AND ("cfp"."user_id" = "auth"."uid"()) AND ("cfp"."can_view_conversations" = true))))))))));



CREATE POLICY "msg_select_participants" ON "public"."messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."chat_id") AND (("c"."user_id" = "auth"."uid"()) OR ("c"."owner_user_id" = "auth"."uid"()) OR ("c"."is_public" = true) OR (EXISTS ( SELECT 1
           FROM "public"."conversations_participants" "cp"
          WHERE (("cp"."conversation_id" = "c"."id") AND ("cp"."user_id" = "auth"."uid"())))) OR (("c"."folder_id" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."chat_folder_participants" "cfp"
          WHERE (("cfp"."folder_id" = "c"."folder_id") AND ("cfp"."user_id" = "auth"."uid"()) AND ("cfp"."can_view_conversations" = true))))))))));



CREATE POLICY "msg_service_all" ON "public"."messages" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "msg_update_author" ON "public"."messages" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."password_reset_tokens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "password_reset_tokens_service_all" ON "public"."password_reset_tokens" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."payment_method" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_method_service_all" ON "public"."payment_method" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "payment_method_user_insert" ON "public"."payment_method" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "payment_method_user_select" ON "public"."payment_method" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "payment_method_user_update" ON "public"."payment_method" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."plan_limits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "plan_limits_public_read" ON "public"."plan_limits" FOR SELECT USING (true);



CREATE POLICY "plan_limits_service_all" ON "public"."plan_limits" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."price_list" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_service_all" ON "public"."profiles" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "profiles_user_select" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "profiles_user_update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



ALTER TABLE "public"."promo_codes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public_read_promo" ON "public"."promo_codes" FOR SELECT TO "authenticated" USING (("is_active" = true));



CREATE POLICY "public_read_token_emails" ON "public"."token_emails" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."report_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "report_logs_service_all" ON "public"."report_logs" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "report_logs_user_delete" ON "public"."report_logs" FOR DELETE TO "authenticated" USING ((("chat_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "report_logs"."chat_id") AND (("c"."is_public" = true) OR (( SELECT "auth"."uid"() AS "uid") = COALESCE("c"."owner_user_id", "c"."user_id")) OR (EXISTS ( SELECT 1
           FROM "public"."conversations_participants" "cp"
          WHERE (("cp"."conversation_id" = "c"."id") AND ("cp"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))))))));



CREATE POLICY "report_logs_user_insert" ON "public"."report_logs" FOR INSERT TO "authenticated" WITH CHECK ((("chat_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "report_logs"."chat_id") AND (("c"."is_public" = true) OR (( SELECT "auth"."uid"() AS "uid") = COALESCE("c"."owner_user_id", "c"."user_id")) OR (EXISTS ( SELECT 1
           FROM "public"."conversations_participants" "cp"
          WHERE (("cp"."conversation_id" = "c"."id") AND ("cp"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))))))));



CREATE POLICY "report_logs_user_select" ON "public"."report_logs" FOR SELECT TO "authenticated" USING ((("chat_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "report_logs"."chat_id") AND (("c"."is_public" = true) OR (( SELECT "auth"."uid"() AS "uid") = COALESCE("c"."owner_user_id", "c"."user_id")) OR (EXISTS ( SELECT 1
           FROM "public"."conversations_participants" "cp"
          WHERE (("cp"."conversation_id" = "c"."id") AND ("cp"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))))))));



CREATE POLICY "report_logs_user_update" ON "public"."report_logs" FOR UPDATE TO "authenticated" USING ((("chat_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "report_logs"."chat_id") AND (("c"."is_public" = true) OR (( SELECT "auth"."uid"() AS "uid") = COALESCE("c"."owner_user_id", "c"."user_id")) OR (EXISTS ( SELECT 1
           FROM "public"."conversations_participants" "cp"
          WHERE (("cp"."conversation_id" = "c"."id") AND ("cp"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))))))) WITH CHECK ((("chat_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "report_logs"."chat_id") AND (("c"."is_public" = true) OR (( SELECT "auth"."uid"() AS "uid") = COALESCE("c"."owner_user_id", "c"."user_id")) OR (EXISTS ( SELECT 1
           FROM "public"."conversations_participants" "cp"
          WHERE (("cp"."conversation_id" = "c"."id") AND ("cp"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))))))));



ALTER TABLE "public"."report_prompts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_all_blog" ON "public"."blog_posts" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_all_email_templates" ON "public"."email_notification_templates" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_all_legal" ON "public"."legal_documents" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_all_price_list" ON "public"."price_list" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_all_promo" ON "public"."promo_codes" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_all_templates" ON "public"."website_templates" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_all_token_emails" ON "public"."token_emails" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_insert" ON "public"."debug_logs" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "service_role_insert" ON "public"."promo_codes" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "service_role_insert" ON "public"."swissdebuglogs" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "service_role_insert" ON "public"."temp_report_data" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "service_role_select" ON "public"."debug_logs" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "service_role_select" ON "public"."promo_codes" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "service_role_select" ON "public"."swissdebuglogs" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "service_role_select" ON "public"."temp_report_data" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "service_role_update" ON "public"."debug_logs" FOR UPDATE TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_update" ON "public"."promo_codes" FOR UPDATE TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_update" ON "public"."swissdebuglogs" FOR UPDATE TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_update" ON "public"."temp_report_data" FOR UPDATE TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "stripe_events_service_all" ON "public"."stripe_webhook_events" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "stripe_events_user_select" ON "public"."stripe_webhook_events" FOR SELECT TO "authenticated" USING (("stripe_customer_id" IN ( SELECT "p"."stripe_customer_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = ( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."stripe_products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stripe_products_public_read" ON "public"."stripe_products" FOR SELECT TO "anon", "authenticated" USING (true);



CREATE POLICY "stripe_products_service_all" ON "public"."stripe_products" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."stripe_webhook_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "svc_all" ON "public"."conversations" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."swissdebuglogs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_prompts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "system_prompts_service_all" ON "public"."system_prompts" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."temp_report_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."token_emails" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."topup_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "topup_logs_service_all" ON "public"."topup_logs" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "topup_logs_user_insert" ON "public"."topup_logs" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "topup_logs_user_select" ON "public"."topup_logs" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "topup_logs_user_update" ON "public"."topup_logs" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."translator_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "translator_logs_service_all" ON "public"."translator_logs" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "translator_logs_user_select" ON "public"."translator_logs" FOR SELECT TO "authenticated" USING ((("chat_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "translator_logs"."chat_id") AND (("c"."is_public" = true) OR (( SELECT "auth"."uid"() AS "uid") = COALESCE("c"."owner_user_id", "c"."user_id")) OR (EXISTS ( SELECT 1
           FROM "public"."conversations_participants" "cp"
          WHERE (("cp"."conversation_id" = "c"."id") AND ("cp"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))))))));



ALTER TABLE "public"."user_credits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_credits_service_all" ON "public"."user_credits" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "user_credits_user_select" ON "public"."user_credits" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "user_credits_user_update" ON "public"."user_credits" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."user_images" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_images_service_all" ON "public"."user_images" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "user_images_user_modify" ON "public"."user_images" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."user_memory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_memory_buffer" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_memory_buffer_service_all" ON "public"."user_memory_buffer" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "user_memory_buffer_user_delete" ON "public"."user_memory_buffer" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "user_memory_buffer_user_insert" ON "public"."user_memory_buffer" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "user_memory_buffer_user_select" ON "public"."user_memory_buffer" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "user_memory_buffer_user_update" ON "public"."user_memory_buffer" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."user_memory_monthly_summaries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_memory_service_all" ON "public"."user_memory" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "user_memory_user_delete" ON "public"."user_memory" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "user_memory_user_insert" ON "public"."user_memory" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "user_memory_user_select" ON "public"."user_memory" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "user_memory_user_update" ON "public"."user_memory" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."user_memory_weekly_summaries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_memory_weekly_summaries_delete_own" ON "public"."user_memory_weekly_summaries" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "user_memory_weekly_summaries_select_own" ON "public"."user_memory_weekly_summaries" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "user_memory_weekly_summaries_service_all" ON "public"."user_memory_weekly_summaries" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "user_monthly_summaries_service_all" ON "public"."user_memory_monthly_summaries" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "user_monthly_summaries_user_delete" ON "public"."user_memory_monthly_summaries" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "user_monthly_summaries_user_select" ON "public"."user_memory_monthly_summaries" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."user_preferences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_prefs_insert" ON "public"."user_preferences" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "user_prefs_select" ON "public"."user_preferences" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "user_prefs_update" ON "public"."user_preferences" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."user_profile_list" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."voice_usage" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "voice_usage_service_all" ON "public"."voice_usage" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "voice_usage_user_select" ON "public"."voice_usage" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."web_leads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."website_templates" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."_get_secret"("name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_get_secret"("name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_get_secret"("name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_secret"("name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."add_credits"("_user_id" "uuid", "_credits" integer, "_amount_usd" numeric, "_type" "text", "_reference_id" "text", "_description" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_credits"("_user_id" "uuid", "_credits" integer, "_amount_usd" numeric, "_type" "text", "_reference_id" "text", "_description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_credits"("_user_id" "uuid", "_credits" integer, "_amount_usd" numeric, "_type" "text", "_reference_id" "text", "_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_credits"("_user_id" "uuid", "_credits" integer, "_amount_usd" numeric, "_type" "text", "_reference_id" "text", "_description" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."archive_old_messages"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."archive_old_messages"() TO "anon";
GRANT ALL ON FUNCTION "public"."archive_old_messages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_old_messages"() TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_ab_test_group"() TO "anon";
GRANT ALL ON FUNCTION "public"."assign_ab_test_group"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_ab_test_group"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_and_increment_insights_count"("p_user_id" "uuid", "p_count" integer, "p_period" "text", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_and_increment_insights_count"("p_user_id" "uuid", "p_count" integer, "p_period" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_and_increment_insights_count"("p_user_id" "uuid", "p_count" integer, "p_period" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_and_increment_insights_count"("p_user_id" "uuid", "p_count" integer, "p_period" "text", "p_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_and_increment_therai_calls"("p_user_id" "uuid", "p_calls" integer, "p_period" "text", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_and_increment_therai_calls"("p_user_id" "uuid", "p_calls" integer, "p_period" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_and_increment_therai_calls"("p_user_id" "uuid", "p_calls" integer, "p_period" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_and_increment_therai_calls"("p_user_id" "uuid", "p_calls" integer, "p_period" "text", "p_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_and_increment_voice_seconds"("p_user_id" "uuid", "p_seconds" integer, "p_period" "text", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_and_increment_voice_seconds"("p_user_id" "uuid", "p_seconds" integer, "p_period" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_and_increment_voice_seconds"("p_user_id" "uuid", "p_seconds" integer, "p_period" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_and_increment_voice_seconds"("p_user_id" "uuid", "p_seconds" integer, "p_period" "text", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_feature_access"("p_plan_id" "text", "p_trial_end_date" timestamp with time zone, "p_feature_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_feature_access"("p_plan_id" "text", "p_trial_end_date" timestamp with time zone, "p_feature_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_feature_access"("p_plan_id" "text", "p_trial_end_date" timestamp with time zone, "p_feature_type" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_feature_limit"("p_user_id" "uuid", "p_feature_type" "text", "p_requested_amount" integer, "p_period" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_feature_limit"("p_user_id" "uuid", "p_feature_type" "text", "p_requested_amount" integer, "p_period" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_feature_limit"("p_user_id" "uuid", "p_feature_type" "text", "p_requested_amount" integer, "p_period" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_feature_limit"("p_user_id" "uuid", "p_feature_type" "text", "p_requested_amount" integer, "p_period" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_folder_ai_limit"("p_user_id" "uuid", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_folder_ai_limit"("p_user_id" "uuid", "p_limit" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."check_folder_ai_limit"("p_user_id" "uuid", "p_limit" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."check_orphaned_data"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_orphaned_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_orphaned_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_orphaned_data"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_user_admin_role"("user_id_param" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_user_admin_role"("user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_user_admin_role"("user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_user_admin_role"("user_id_param" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_voice_limit"("p_user_id" "uuid", "p_requested_seconds" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_voice_limit"("p_user_id" "uuid", "p_requested_seconds" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_voice_limit"("p_user_id" "uuid", "p_requested_seconds" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_voice_limit"("p_user_id" "uuid", "p_requested_seconds" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."clean_edge_function_logs"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."clean_edge_function_logs"() TO "anon";
GRANT ALL ON FUNCTION "public"."clean_edge_function_logs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."clean_edge_function_logs"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."clean_old_webhook_events"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."clean_old_webhook_events"() TO "anon";
GRANT ALL ON FUNCTION "public"."clean_old_webhook_events"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."clean_old_webhook_events"() TO "service_role";



GRANT ALL ON FUNCTION "public"."conversations_broadcast_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."conversations_broadcast_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."conversations_broadcast_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_user_after_payment"("user_id" "uuid", "plan_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_user_after_payment"("user_id" "uuid", "plan_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_after_payment"("user_id" "uuid", "plan_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."deactivate_old_payment_methods"() TO "anon";
GRANT ALL ON FUNCTION "public"."deactivate_old_payment_methods"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."deactivate_old_payment_methods"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."deduct_credits"("_user_id" "uuid", "_credits" integer, "_endpoint" "text", "_reference_id" "uuid", "_description" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."deduct_credits"("_user_id" "uuid", "_credits" integer, "_endpoint" "text", "_reference_id" "uuid", "_description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."deduct_credits"("_user_id" "uuid", "_credits" integer, "_endpoint" "text", "_reference_id" "uuid", "_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."deduct_credits"("_user_id" "uuid", "_credits" integer, "_endpoint" "text", "_reference_id" "uuid", "_description" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_user_account"("user_id_to_delete" "uuid") FROM PUBLIC;
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



REVOKE ALL ON FUNCTION "public"."get_all_users_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_all_users_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_all_users_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_all_users_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_config"("config_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_config"("config_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_config"("config_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_config"("config_key" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_conversations_needing_buffer_processing"("inactivity_minutes" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_conversations_needing_buffer_processing"("inactivity_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_conversations_needing_buffer_processing"("inactivity_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_conversations_needing_buffer_processing"("inactivity_minutes" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_current_billing_cycle"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_current_billing_cycle"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_billing_cycle"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_billing_cycle"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_flow_status"("user_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_flow_status"("user_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_flow_status"("user_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_flow_status"("user_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_message_archival_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_message_archival_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_message_archival_stats"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_next_engine_sequence"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_next_engine_sequence"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_next_engine_sequence"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_next_engine_sequence"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_stripe_customer_id_for_user"("user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_stripe_customer_id_for_user"("user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_stripe_customer_id_for_user"("user_id_param" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_supabase_url"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_supabase_url"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_supabase_url"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_supabase_url"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_user_email_by_id"("user_id_param" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_email_by_id"("user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_email_by_id"("user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_email_by_id"("user_id_param" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_user_limits"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_limits"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_limits"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_limits"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_public_conversation_participant"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_public_conversation_participant"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_public_conversation_participant"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."hard_delete_archived_messages"("months_old" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."hard_delete_archived_messages"("months_old" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."hard_delete_archived_messages"("months_old" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hard_delete_archived_messages"("months_old" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_chat_messages"("p_user_id" "uuid", "p_count" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_chat_messages"("p_user_id" "uuid", "p_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_chat_messages"("p_user_id" "uuid", "p_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_chat_messages"("p_user_id" "uuid", "p_count" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_chat_messages"("p_user_id" "uuid", "p_count" integer, "p_period" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_chat_messages"("p_user_id" "uuid", "p_count" integer, "p_period" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_chat_messages"("p_user_id" "uuid", "p_count" integer, "p_period" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_chat_messages"("p_user_id" "uuid", "p_count" integer, "p_period" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_feature_usage"("p_user_id" "uuid", "p_feature_type" "text", "p_amount" integer, "p_period" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_feature_usage"("p_user_id" "uuid", "p_feature_type" "text", "p_amount" integer, "p_period" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_feature_usage"("p_user_id" "uuid", "p_feature_type" "text", "p_amount" integer, "p_period" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_feature_usage"("p_user_id" "uuid", "p_feature_type" "text", "p_amount" integer, "p_period" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_folder_ai_usage"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_folder_ai_usage"("p_user_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."increment_folder_ai_usage"("p_user_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."increment_images_generated"("p_user_id" "uuid", "p_count" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_images_generated"("p_user_id" "uuid", "p_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_images_generated"("p_user_id" "uuid", "p_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_images_generated"("p_user_id" "uuid", "p_count" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_images_generated"("p_user_id" "uuid", "p_count" integer, "p_period" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_images_generated"("p_user_id" "uuid", "p_count" integer, "p_period" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_images_generated"("p_user_id" "uuid", "p_count" integer, "p_period" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_images_generated"("p_user_id" "uuid", "p_count" integer, "p_period" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_insights_count"("p_user_id" "uuid", "p_count" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_insights_count"("p_user_id" "uuid", "p_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_insights_count"("p_user_id" "uuid", "p_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_insights_count"("p_user_id" "uuid", "p_count" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_insights_count"("p_user_id" "uuid", "p_count" integer, "p_period" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_insights_count"("p_user_id" "uuid", "p_count" integer, "p_period" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_insights_count"("p_user_id" "uuid", "p_count" integer, "p_period" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_insights_count"("p_user_id" "uuid", "p_count" integer, "p_period" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_therai_calls"("p_user_id" "uuid", "p_calls" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_therai_calls"("p_user_id" "uuid", "p_calls" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_therai_calls"("p_user_id" "uuid", "p_calls" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_therai_calls"("p_user_id" "uuid", "p_calls" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_therai_calls"("p_user_id" "uuid", "p_calls" integer, "p_period" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_therai_calls"("p_user_id" "uuid", "p_calls" integer, "p_period" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_therai_calls"("p_user_id" "uuid", "p_calls" integer, "p_period" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_therai_calls"("p_user_id" "uuid", "p_calls" integer, "p_period" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_voice_seconds"("p_user_id" "uuid", "p_seconds" integer, "p_period" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_voice_seconds"("p_user_id" "uuid", "p_seconds" integer, "p_period" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_voice_seconds"("p_user_id" "uuid", "p_seconds" integer, "p_period" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_voice_seconds"("p_user_id" "uuid", "p_seconds" integer, "p_period" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_voice_usage"("p_user_id" "uuid", "p_seconds" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_voice_usage"("p_user_id" "uuid", "p_seconds" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_voice_usage"("p_user_id" "uuid", "p_seconds" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_voice_usage"("p_user_id" "uuid", "p_seconds" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_edge_system"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_ip_allowed"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_ip_allowed"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_ip_allowed"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_ip_allowed"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_user_in_trial"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_user_in_trial"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_user_in_trial"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_user_in_trial"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_user_verified"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_user_verified"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_user_verified"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."list_folder_journals"("p_folder_id" "uuid", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."list_folder_journals"("p_folder_id" "uuid", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_folder_journals"("p_folder_id" "uuid", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."log_modal_ready_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_modal_ready_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_modal_ready_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_profile_verified"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_profile_verified"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_profile_verified"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."recent_user_documents"("p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."recent_user_documents"("p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."recent_user_documents"("p_limit" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."reset_folder_ai_usage"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reset_folder_ai_usage"("p_user_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."reset_folder_ai_usage"("p_user_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."search_folder_documents"("p_folder_id" "uuid", "p_q" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_folder_documents"("p_folder_id" "uuid", "p_q" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_folder_documents"("p_folder_id" "uuid", "p_q" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."send_notification_email"("template_type" "text", "recipient_email" "text", "variables" "jsonb") FROM PUBLIC;
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



REVOKE ALL ON FUNCTION "public"."update_auto_topup_settings"("_user_id" "uuid", "_enabled" boolean, "_threshold" integer, "_amount" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_auto_topup_settings"("_user_id" "uuid", "_enabled" boolean, "_threshold" integer, "_amount" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."update_auto_topup_settings"("_user_id" "uuid", "_enabled" boolean, "_threshold" integer, "_amount" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_auto_topup_settings"("_user_id" "uuid", "_enabled" boolean, "_threshold" integer, "_amount" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_buffer_pending_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_buffer_pending_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_buffer_pending_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_chat_folders_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_chat_folders_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_chat_folders_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_conversation_activity"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_conversation_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_conversation_activity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_email_templates_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_email_templates_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_email_templates_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_folder_documents_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_folder_documents_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_folder_documents_updated_at"() TO "service_role";



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



REVOKE ALL ON FUNCTION "public"."user_owns_insight"("report_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."user_owns_insight"("report_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_owns_insight"("report_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_owns_insight"("report_id" "uuid") TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."admin_logs" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."admin_logs" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."admin_logs" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."blog_posts" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."blog_posts" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."blog_posts" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."calendar_sessions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."calendar_sessions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."calendar_sessions" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."chat_folder_participants" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."chat_folder_participants" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."chat_folder_participants" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."chat_folders" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."chat_folders" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."chat_folders" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."conversation_activity" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."conversation_activity" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."conversation_activity" TO "service_role";



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



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."folder_ai_messages" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."folder_ai_messages" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."folder_ai_messages" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."folder_ai_usage" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."folder_ai_usage" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."folder_ai_usage" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."folder_documents" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."folder_documents" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."folder_documents" TO "service_role";



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
GRANT REFERENCES,TRIGGER,TRUNCATE ON TABLE "public"."landing_page_config" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."landing_page_config" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."legal_documents" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."legal_documents" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."legal_documents" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."messages" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."messages" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."messages" TO "anon";



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



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."system_prompts" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."system_prompts" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."system_prompts" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."temp_report_data" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."temp_report_data" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."temp_report_data" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."token_emails" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."token_emails" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."token_emails" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."topup_logs" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."topup_logs" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."topup_logs" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."translator_logs" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."translator_logs" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."translator_logs" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_credits" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_credits" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_credits" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_images" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_images" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_images" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_memory" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_memory" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_memory" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_memory_buffer" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_memory_buffer" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_memory_buffer" TO "service_role";



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
GRANT REFERENCES,TRIGGER,TRUNCATE ON TABLE "public"."user_roles" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_roles" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."voice_usage" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."voice_usage" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."voice_usage" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."web_leads" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE ON TABLE "public"."web_leads" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."web_leads" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."website_templates" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."website_templates" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."website_templates" TO "service_role";



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







