-- ============================================================================
-- FIX FREE USER LIMITS
-- Free users get:
-- - 3 chat messages per day
-- - 3 @therai calls per day (in Together Mode)
-- - Zero voice, zero images
-- ============================================================================

-- 1. Add chat_messages_daily_limit column
ALTER TABLE plan_limits 
ADD COLUMN IF NOT EXISTS chat_messages_daily_limit INTEGER;

-- 2. Update free plan limits
UPDATE plan_limits 
SET 
  voice_seconds_limit = 0,              -- No voice
  image_generation_daily_limit = 0,     -- No images
  therai_calls_limit = 3,               -- 3 @therai calls per day
  chat_messages_daily_limit = 3         -- 3 chat messages per day
WHERE plan_id = 'free';

-- 3. Set unlimited for paid plans
UPDATE plan_limits 
SET 
  chat_messages_daily_limit = NULL      -- Unlimited chat messages
WHERE plan_id IN ('10_monthly', '18_monthly');

-- 4. Add chat_messages column to feature_usage
ALTER TABLE feature_usage 
ADD COLUMN IF NOT EXISTS chat_messages INTEGER DEFAULT 0;

-- 5. Update check_feature_limit to handle chat_messages (daily limit)
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
    -- Trial expired - block ALL AI features
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
      v_period := COALESCE(p_period, TO_CHAR(NOW(), 'YYYY-MM-DD')); -- Daily for free users
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
  
  -- 6. Get current usage
  IF p_feature_type = 'image_generation' THEN
    -- Special handling for images (uses log table)
    SELECT COUNT(*)
    INTO v_current_usage
    FROM image_generation_log
    WHERE user_id = p_user_id
      AND created_at >= (NOW() - INTERVAL '24 hours');
  ELSIF p_feature_type = 'therai_calls' AND v_plan_id = 'free' THEN
    -- Special handling for daily @therai limit for free users
    EXECUTE format('SELECT COALESCE(%I, 0) FROM feature_usage WHERE user_id = $1 AND period = $2', v_feature_column)
    INTO v_current_usage
    USING p_user_id, TO_CHAR(NOW(), 'YYYY-MM-DD');
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

-- 6. Create increment function for chat messages
CREATE OR REPLACE FUNCTION increment_chat_messages(
  p_user_id UUID,
  p_count INTEGER,
  p_period TEXT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO feature_usage (user_id, period, chat_messages, feature_type)
  VALUES (p_user_id, p_period, p_count, 'chat')
  ON CONFLICT (user_id, period, feature_type)
  DO UPDATE SET 
    chat_messages = feature_usage.chat_messages + p_count,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION increment_chat_messages TO authenticated, anon, service_role;

-- 7. Update @therai increment to use daily period for free users
CREATE OR REPLACE FUNCTION increment_therai_calls(
  p_user_id UUID,
  p_calls INTEGER,
  p_period TEXT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO feature_usage (user_id, period, therai_calls, feature_type)
  VALUES (p_user_id, p_period, p_calls, 'therai_calls')
  ON CONFLICT (user_id, period, feature_type)
  DO UPDATE SET 
    therai_calls = feature_usage.therai_calls + p_calls,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON COLUMN plan_limits.chat_messages_daily_limit IS 'Daily limit for chat messages. NULL = unlimited. Free users: 3/day.';

