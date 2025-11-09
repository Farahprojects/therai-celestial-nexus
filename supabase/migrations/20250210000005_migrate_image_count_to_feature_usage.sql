-- ============================================================================
-- MIGRATE IMAGE COUNT TO FEATURE_USAGE TABLE
-- Add images_generated column and update functions
-- ============================================================================

-- 1. Add images_generated column to feature_usage table
ALTER TABLE feature_usage ADD COLUMN IF NOT EXISTS images_generated INTEGER DEFAULT 0;

-- 2. Create increment function for images_generated (daily tracking)
CREATE OR REPLACE FUNCTION increment_images_generated(
  p_user_id UUID,
  p_count INTEGER,
  p_period TEXT -- Format: 'YYYY-MM-DD' for daily tracking
) RETURNS VOID AS $$
BEGIN
  INSERT INTO feature_usage (user_id, period, images_generated, updated_at)
  VALUES (p_user_id, p_period, p_count, NOW())
  ON CONFLICT (user_id, period)
  DO UPDATE SET 
    images_generated = feature_usage.images_generated + p_count,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update check_feature_limit function to use feature_usage for images
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
      v_feature_column := 'images_generated'; -- ✅ NOW USES feature_usage
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
  
  -- 6. AUTO-CREATE ROW: Ensure feature_usage row exists
  INSERT INTO feature_usage (user_id, period)
  VALUES (p_user_id, v_period)
  ON CONFLICT (user_id, period) DO NOTHING;
  
  -- 7. Get current usage from feature_usage table
  EXECUTE format('SELECT COALESCE(%I, 0) FROM feature_usage WHERE user_id = $1 AND period = $2', v_feature_column)
  INTO v_current_usage
  USING p_user_id, v_period;
  
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

-- 4. Grant permissions
GRANT EXECUTE ON FUNCTION increment_images_generated TO authenticated, service_role;

-- 5. Add comments
COMMENT ON FUNCTION increment_images_generated IS 'Increment daily image generation count in feature_usage table';
COMMENT ON FUNCTION check_feature_limit IS 'Check feature limits with unified tracking. Images now use feature_usage instead of log table.';
