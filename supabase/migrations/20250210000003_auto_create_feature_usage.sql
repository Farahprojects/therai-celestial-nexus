-- ============================================================================
-- AUTO-CREATE FEATURE_USAGE ROWS
-- Ensures feature_usage rows exist before checking limits (no more missing row errors)
-- ============================================================================

-- Update check_feature_limit to auto-create rows if missing
CREATE OR REPLACE FUNCTION check_feature_limit(
  p_user_id UUID,
  p_feature_type TEXT,
  p_requested_amount INTEGER DEFAULT 1,
  p_period TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_plan_id TEXT;
  v_subscription_active BOOLEAN;
  v_subscription_status TEXT;
  v_trial_end_date TIMESTAMPTZ;
  v_limit INTEGER;
  v_current_usage INTEGER := 0;
  v_period TEXT;
  v_feature_column TEXT;
  v_limit_column TEXT;
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
  
  -- 4. Determine period and feature mapping
  CASE p_feature_type
    WHEN 'voice_seconds' THEN
      v_limit_column := 'voice_seconds_limit';
      v_feature_column := 'voice_seconds';
      v_period := COALESCE(p_period, TO_CHAR(NOW(), 'YYYY-MM')); -- Monthly
    WHEN 'image_generation' THEN
      v_limit_column := 'image_generation_daily_limit';
      v_period := COALESCE(p_period, TO_CHAR(NOW(), 'YYYY-MM-DD')); -- Daily
    WHEN 'therai_calls' THEN
      v_limit_column := 'therai_calls_limit';
      v_feature_column := 'therai_calls';
      v_period := COALESCE(p_period, TO_CHAR(NOW(), 'YYYY-MM-DD')); -- Daily
    WHEN 'chat' THEN
      v_limit_column := 'chat_messages_daily_limit';
      v_feature_column := 'chat_messages';
      v_period := COALESCE(p_period, TO_CHAR(NOW(), 'YYYY-MM-DD')); -- Daily
    WHEN 'insights' THEN
      v_limit_column := 'insights_limit';
      v_feature_column := 'insights_count';
      v_period := COALESCE(p_period, TO_CHAR(NOW(), 'YYYY-MM')); -- Monthly
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
  
  -- 6. ✅ AUTO-CREATE ROW: Ensure feature_usage row exists
  IF v_feature_column IS NOT NULL AND p_feature_type != 'image_generation' THEN
    INSERT INTO feature_usage (user_id, period, feature_type)
    VALUES (p_user_id, v_period, p_feature_type)
    ON CONFLICT (user_id, period, feature_type) DO NOTHING;
  END IF;
  
  -- 7. Get current usage (now guaranteed to have a row)
  IF p_feature_type = 'image_generation' THEN
    -- Images use log table
    SELECT COUNT(*)
    INTO v_current_usage
    FROM image_generation_log
    WHERE user_id = p_user_id
      AND created_at >= (NOW() - INTERVAL '24 hours');
  ELSIF v_feature_column IS NOT NULL THEN
    -- Use feature_usage table
    EXECUTE format('SELECT COALESCE(%I, 0) FROM feature_usage WHERE user_id = $1 AND period = $2 AND feature_type = $3', v_feature_column)
    INTO v_current_usage
    USING p_user_id, v_period, p_feature_type;
  END IF;
  
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_feature_limit IS 'Check feature limits with auto-creation of feature_usage rows. No more missing row errors!';

