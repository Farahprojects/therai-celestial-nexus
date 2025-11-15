-- ============================================================================
-- PRO SUBSCRIPTION LIMITS ARCHITECTURE
-- Single source of truth for all plan limits, database-driven and flexible
-- ============================================================================

-- 1. Plan Limits Table - Defines what each plan includes
-- This is your single source of truth. Change limits without redeploying!
CREATE TABLE IF NOT EXISTS plan_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id TEXT NOT NULL UNIQUE, -- e.g., '10_monthly', '18_monthly'
  plan_name TEXT NOT NULL, -- e.g., 'Growth', 'Premium'
  
  -- Voice limits (seconds per month)
  voice_seconds_limit INTEGER, -- NULL = unlimited
  
  -- Image generation limits (per day)
  image_generation_daily_limit INTEGER, -- NULL = unlimited
  
  -- Together Mode @therai calls (per month)
  therai_calls_limit INTEGER, -- NULL = unlimited
  
  -- Insights/Reports (per month)
  insights_limit INTEGER, -- NULL = unlimited
  
  -- Feature flags
  has_together_mode BOOLEAN DEFAULT true,
  has_voice_mode BOOLEAN DEFAULT true,
  has_image_generation BOOLEAN DEFAULT true,
  has_priority_support BOOLEAN DEFAULT false,
  has_early_access BOOLEAN DEFAULT false,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Index for fast lookups
CREATE INDEX idx_plan_limits_plan_id ON plan_limits(plan_id) WHERE is_active = true;
-- 2. Insert Initial Plan Configurations
INSERT INTO plan_limits (plan_id, plan_name, voice_seconds_limit, image_generation_daily_limit, therai_calls_limit, insights_limit, has_priority_support, has_early_access, display_order) VALUES
  -- Free tier (for reference)
  ('free', 'Free', 120, 0, 0, 0, false, false, 0),
  
  -- Growth Plan ($10/month)
  ('10_monthly', 'Growth', 600, 3, NULL, NULL, false, false, 1),
  
  -- Premium Plan ($18/month)
  ('18_monthly', 'Premium', NULL, NULL, NULL, NULL, true, true, 2)
ON CONFLICT (plan_id) DO UPDATE SET
  voice_seconds_limit = EXCLUDED.voice_seconds_limit,
  image_generation_daily_limit = EXCLUDED.image_generation_daily_limit,
  therai_calls_limit = EXCLUDED.therai_calls_limit,
  insights_limit = EXCLUDED.insights_limit,
  has_priority_support = EXCLUDED.has_priority_support,
  has_early_access = EXCLUDED.has_early_access,
  updated_at = NOW();
-- 3. Enable RLS
ALTER TABLE plan_limits ENABLE ROW LEVEL SECURITY;
-- Public read access (anyone can see plan limits)
CREATE POLICY "Plan limits are publicly readable"
  ON plan_limits FOR SELECT
  USING (is_active = true);
-- Only admins can modify
CREATE POLICY "Only admins can modify plan limits"
  ON plan_limits FOR ALL
  USING (auth.jwt() ->> 'email' IN (
    SELECT email FROM profiles WHERE subscription_plan = 'admin'
  ));
-- 4. Enhanced Feature Usage Table
-- Extend existing feature_usage to track all feature types
ALTER TABLE feature_usage ADD COLUMN IF NOT EXISTS therai_calls INTEGER DEFAULT 0;
ALTER TABLE feature_usage ADD COLUMN IF NOT EXISTS insights_count INTEGER DEFAULT 0;
-- 5. Centralized Limit Check Function
-- Single function to check any feature limit for any user
CREATE OR REPLACE FUNCTION check_feature_limit(
  p_user_id UUID,
  p_feature_type TEXT, -- 'voice_seconds', 'image_generation', 'therai_calls', 'insights'
  p_requested_amount INTEGER DEFAULT 1,
  p_period TEXT DEFAULT NULL -- NULL = auto-detect based on feature type
) RETURNS JSONB AS $$
DECLARE
  v_plan_id TEXT;
  v_subscription_active BOOLEAN;
  v_subscription_status TEXT;
  v_limit INTEGER;
  v_current_usage INTEGER := 0;
  v_period TEXT;
  v_feature_column TEXT;
  v_limit_column TEXT;
  v_result JSONB;
BEGIN
  -- 1. Get user's subscription plan
  SELECT subscription_plan, subscription_active, subscription_status
  INTO v_plan_id, v_subscription_active, v_subscription_status
  FROM profiles
  WHERE id = p_user_id;
  
  IF v_plan_id IS NULL THEN
    v_plan_id := 'free';
  END IF;
  
  -- 2. Check if user has active subscription (except for free tier checks)
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
  
  -- 3. Get limit for this plan and feature
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
    ELSE
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'Unknown feature type',
        'error_code', 'INVALID_FEATURE'
      );
  END CASE;
  
  -- Get limit from plan_limits table
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
  
  -- 4. Get current usage
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
  
  -- 5. Check if limit exceeded
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
  
  -- 6. Allow access
  RETURN jsonb_build_object(
    'allowed', true,
    'limit', v_limit,
    'current_usage', v_current_usage,
    'remaining', v_limit - v_current_usage - p_requested_amount,
    'is_unlimited', false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 6. Helper function to get all limits for a user (useful for UI)
CREATE OR REPLACE FUNCTION get_user_limits(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_plan_id TEXT;
  v_limits JSONB;
  v_usage JSONB;
BEGIN
  -- Get user's plan
  SELECT subscription_plan INTO v_plan_id
  FROM profiles
  WHERE id = p_user_id;
  
  IF v_plan_id IS NULL THEN
    v_plan_id := 'free';
  END IF;
  
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
  
  -- Get current usage
  SELECT jsonb_build_object(
    'voice_seconds', COALESCE(voice_seconds, 0),
    'therai_calls', COALESCE(therai_calls, 0),
    'insights_count', COALESCE(insights_count, 0)
  )
  INTO v_usage
  FROM feature_usage
  WHERE user_id = p_user_id 
    AND period = TO_CHAR(NOW(), 'YYYY-MM');
  
  -- Combine and return
  RETURN jsonb_build_object(
    'limits', v_limits,
    'usage', COALESCE(v_usage, '{}'::jsonb)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_feature_limit TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_user_limits TO authenticated, anon, service_role;
-- 7. Add helpful comments
COMMENT ON TABLE plan_limits IS 'Single source of truth for subscription plan limits. Change limits here without redeploying code.';
COMMENT ON FUNCTION check_feature_limit IS 'Centralized function to check any feature limit for any user. Returns allowed status with usage details.';
COMMENT ON FUNCTION get_user_limits IS 'Get all limits and current usage for a user. Useful for displaying in UI.';
