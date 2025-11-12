-- ============================================================================
-- CRITICAL FIX: Update all feature limit functions to match new schema
-- Removes 'period' column references, uses 'last_reset_date' for daily resets
-- ============================================================================

-- 1. Fix increment_chat_messages (daily reset)
CREATE OR REPLACE FUNCTION public.increment_chat_messages(p_user_id uuid, p_count integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
$function$;

-- 2. Fix increment_images_generated (daily reset)
CREATE OR REPLACE FUNCTION public.increment_images_generated(p_user_id uuid, p_count integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
$function$;

-- 3. Fix increment_therai_calls (daily reset)
CREATE OR REPLACE FUNCTION public.increment_therai_calls(p_user_id uuid, p_calls integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
$function$;

-- 4. Fix increment_insights_count (monthly reset using first day of month)
CREATE OR REPLACE FUNCTION public.increment_insights_count(p_user_id uuid, p_count integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
$function$;

-- 5. Fix check_feature_limit to use last_reset_date instead of period
CREATE OR REPLACE FUNCTION public.check_feature_limit(p_user_id uuid, p_feature_type text, p_requested_amount integer DEFAULT 1, p_period text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
$function$;

-- 6. Grant permissions to all roles
GRANT EXECUTE ON FUNCTION public.increment_chat_messages(uuid, integer) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.increment_images_generated(uuid, integer) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.increment_therai_calls(uuid, integer) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.increment_insights_count(uuid, integer) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.check_feature_limit(uuid, text, integer, text) TO authenticated, anon, service_role;