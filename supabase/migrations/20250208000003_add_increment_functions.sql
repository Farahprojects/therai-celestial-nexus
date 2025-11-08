-- ============================================================================
-- INCREMENT FUNCTIONS FOR NEW FEATURES
-- Add RPC functions for incrementing new feature types
-- ============================================================================

-- Increment @therai calls in Together Mode
CREATE OR REPLACE FUNCTION increment_therai_calls(
  p_user_id UUID,
  p_calls INTEGER,
  p_period TEXT
) RETURNS VOID AS $$
BEGIN
  -- Upsert usage record
  INSERT INTO feature_usage (user_id, period, therai_calls, updated_at)
  VALUES (p_user_id, p_period, p_calls, NOW())
  ON CONFLICT (user_id, period)
  DO UPDATE SET 
    therai_calls = feature_usage.therai_calls + p_calls,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomic check-and-increment for @therai calls
CREATE OR REPLACE FUNCTION check_and_increment_therai_calls(
  p_user_id UUID,
  p_calls INTEGER,
  p_period TEXT,
  p_limit INTEGER
) RETURNS JSONB AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION increment_therai_calls TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION check_and_increment_therai_calls TO authenticated, service_role;

-- Add helpful comments
COMMENT ON FUNCTION increment_therai_calls IS 'Increment @therai call count for Together Mode feature tracking';
COMMENT ON FUNCTION check_and_increment_therai_calls IS 'Atomically check limit and increment @therai calls in single transaction';

