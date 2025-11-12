-- Fix get_user_limits to use voice_usage table instead of dropped voice_seconds column
CREATE OR REPLACE FUNCTION public.get_user_limits(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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