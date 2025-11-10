-- ============================================================================
-- FIX FEATURE_USAGE PERIOD FILTERING
-- Update get_user_limits to query both daily and monthly periods correctly
-- Prevents duplicate rows by ensuring proper period filtering
-- ============================================================================

-- Update get_user_limits function to query both daily and monthly periods
CREATE OR REPLACE FUNCTION get_user_limits(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_plan_id TEXT;
  v_limits JSONB;
  v_usage JSONB;
  v_monthly_period TEXT;
  v_daily_period TEXT;
  v_monthly_usage JSONB;
  v_daily_usage JSONB;
BEGIN
  -- Get user's plan
  SELECT subscription_plan INTO v_plan_id
  FROM profiles
  WHERE id = p_user_id;
  
  IF v_plan_id IS NULL THEN
    v_plan_id := 'free';
  END IF;
  
  -- Set periods
  v_monthly_period := TO_CHAR(NOW(), 'YYYY-MM');  -- For voice_seconds, insights_count
  v_daily_period := TO_CHAR(NOW(), 'YYYY-MM-DD'); -- For images_generated, chat_messages, therai_calls
  
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
  
  -- Get monthly usage (voice_seconds, insights_count)
  SELECT jsonb_build_object(
    'voice_seconds', COALESCE(voice_seconds, 0),
    'insights_count', COALESCE(insights_count, 0)
  )
  INTO v_monthly_usage
  FROM feature_usage
  WHERE user_id = p_user_id 
    AND period = v_monthly_period;
  
  -- Get daily usage (images_generated, chat_messages, therai_calls)
  SELECT jsonb_build_object(
    'images_generated', COALESCE(images_generated, 0),
    'chat_messages', COALESCE(chat_messages, 0),
    'therai_calls', COALESCE(therai_calls, 0)
  )
  INTO v_daily_usage
  FROM feature_usage
  WHERE user_id = p_user_id 
    AND period = v_daily_period;
  
  -- Combine usage from both periods
  v_usage := COALESCE(v_monthly_usage, '{}'::jsonb) || COALESCE(v_daily_usage, '{}'::jsonb);
  
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix increment functions to remove feature_type references (modular design doesn't use feature_type)
CREATE OR REPLACE FUNCTION increment_chat_messages(
  p_user_id UUID,
  p_count INTEGER,
  p_period TEXT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO feature_usage (user_id, period, chat_messages, updated_at)
  VALUES (p_user_id, p_period, p_count, NOW())
  ON CONFLICT (user_id, period)
  DO UPDATE SET 
    chat_messages = feature_usage.chat_messages + p_count,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_therai_calls(
  p_user_id UUID,
  p_calls INTEGER,
  p_period TEXT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO feature_usage (user_id, period, therai_calls, updated_at)
  VALUES (p_user_id, p_period, p_calls, NOW())
  ON CONFLICT (user_id, period)
  DO UPDATE SET 
    therai_calls = feature_usage.therai_calls + p_calls,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION increment_chat_messages TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION increment_therai_calls TO authenticated, service_role;

-- Update comments
COMMENT ON FUNCTION get_user_limits IS 'Get all limits and current usage for a user. Queries both daily (YYYY-MM-DD) and monthly (YYYY-MM) periods correctly to prevent duplicate rows.';
COMMENT ON FUNCTION increment_chat_messages IS 'Increment daily chat messages count. Uses YYYY-MM-DD period format.';
COMMENT ON FUNCTION increment_therai_calls IS 'Increment daily @therai calls count. Uses YYYY-MM-DD period format.';

