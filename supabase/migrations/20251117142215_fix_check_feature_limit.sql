-- Fix check_feature_limit function
-- Change A: Treat inactive subscriptions as free
-- Change B: Remove redundant NO_SUBSCRIPTION check
-- Change C: Ensure error responses include limit values where applicable

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

COMMENT ON FUNCTION "public"."check_feature_limit"("p_user_id" "uuid", "p_feature_type" "text", "p_requested_amount" integer, "p_period" "text") IS 'Check feature limits with unified tracking. Images now use feature_usage instead of log table. Treats inactive/canceled subscriptions as free tier.';

