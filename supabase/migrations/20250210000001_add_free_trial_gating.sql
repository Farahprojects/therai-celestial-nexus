-- ============================================================================
-- FREE TRIAL GATING - 1 Week Free Trial for All Features
-- After 1 week: Free users can ONLY access Together Mode (no AI features)
-- ============================================================================

-- 1. Add trial tracking to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMPTZ;
-- Set trial_end_date for existing users (7 days from account creation)
UPDATE profiles 
SET trial_end_date = created_at + INTERVAL '7 days'
WHERE trial_end_date IS NULL;
-- 2. Update check_feature_limit to respect trial period
CREATE OR REPLACE FUNCTION check_feature_limit(
  p_user_id UUID,
  p_feature_type TEXT, -- 'voice_seconds', 'image_generation', 'therai_calls', 'insights', 'chat'
  p_requested_amount INTEGER DEFAULT 1,
  p_period TEXT DEFAULT NULL -- NULL = auto-detect based on feature type
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
  v_result JSONB;
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
    -- Trial expired - block ALL AI features (chat, voice, images, @therai)
    -- Only Together Mode (non-AI) is allowed
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
  
  -- 4. Get limit for this plan and feature
  CASE p_feature_type
    WHEN 'voice_seconds' THEN
      v_limit_column := 'voice_seconds_limit';
      v_feature_column := 'voice_seconds';
      v_period := COALESCE(p_period, TO_CHAR(NOW(), 'YYYY-MM')); -- Monthly
    WHEN 'image_generation' THEN
      v_limit_column := 'image_generation_daily_limit';
      v_period := COALESCE(p_period, TO_CHAR(NOW(), 'YYYY-MM-DD')); -- Daily
      -- Images use log table, not feature_usage
    WHEN 'therai_calls' THEN
      v_limit_column := 'therai_calls_limit';
      v_feature_column := 'therai_calls';
      v_period := COALESCE(p_period, TO_CHAR(NOW(), 'YYYY-MM')); -- Monthly
    WHEN 'insights' THEN
      v_limit_column := 'insights_limit';
      v_feature_column := 'insights_count';
      v_period := COALESCE(p_period, TO_CHAR(NOW(), 'YYYY-MM')); -- Monthly
    WHEN 'chat' THEN
      -- Chat feature doesn't have a limit column (unlimited for paid plans)
      -- For free users during trial, allow; after trial, block (handled above)
      RETURN jsonb_build_object(
        'allowed', true,
        'is_unlimited', true
      );
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
  
  -- 6. Get current usage
  IF p_feature_type = 'image_generation' THEN
    -- Special handling for images (uses log table)
    SELECT COUNT(*)
    INTO v_current_usage
    FROM image_generation_log
    WHERE user_id = p_user_id
      AND created_at >= (NOW() - INTERVAL '24 hours');
  ELSIF v_feature_column IS NOT NULL THEN
    -- Use feature_usage table
    EXECUTE format('SELECT COALESCE(%I, 0) FROM feature_usage WHERE user_id = $1 AND period = $2', v_feature_column)
    INTO v_current_usage
    USING p_user_id, v_period;
  END IF;
  
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 3. Create trigger to set trial_end_date for new users
CREATE OR REPLACE FUNCTION set_trial_end_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.trial_end_date IS NULL THEN
    NEW.trial_end_date := NEW.created_at + INTERVAL '7 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS set_trial_end_date_trigger ON profiles;
CREATE TRIGGER set_trial_end_date_trigger
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_trial_end_date();
-- 4. Helper function to check if user is in trial
CREATE OR REPLACE FUNCTION is_user_in_trial(p_user_id UUID)
RETURNS BOOLEAN AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION is_user_in_trial TO authenticated, anon, service_role;
-- 5. Update plan_limits to reflect free plan has NO features after trial
-- (During trial, free users can use features; after trial, only Together Mode)
UPDATE plan_limits 
SET 
  voice_seconds_limit = 0,
  image_generation_daily_limit = 0,
  therai_calls_limit = 0,
  insights_limit = 0
WHERE plan_id = 'free';
COMMENT ON COLUMN profiles.trial_end_date IS '1-week free trial end date. After this, free users can only access Together Mode (no AI features).';
