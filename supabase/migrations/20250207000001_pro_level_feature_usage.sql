-- Pro-level atomic check-and-increment functions for feature usage
-- These functions atomically check limits and increment usage in a single transaction
-- Prevents race conditions and ensures limits are never exceeded

-- Atomic check-and-increment for voice seconds
CREATE OR REPLACE FUNCTION check_and_increment_voice_seconds(
  p_user_id UUID,
  p_seconds INTEGER,
  p_period TEXT,
  p_limit INTEGER
) RETURNS JSONB AS $$
DECLARE
  current_usage INTEGER := 0;
  new_usage INTEGER;
  result JSONB;
BEGIN
  -- Input validation
  IF p_seconds <= 0 THEN
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

  -- Get current usage with row lock (prevents concurrent modifications)
  SELECT COALESCE(voice_seconds, 0) INTO current_usage
  FROM feature_usage
  WHERE user_id = p_user_id AND period = p_period
  FOR UPDATE;
  
  -- Calculate new usage
  new_usage := current_usage + p_seconds;
  
  -- Check limit BEFORE incrementing
  IF new_usage > p_limit THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'Monthly limit exceeded',
      'current_usage', current_usage,
      'requested', p_seconds,
      'new_usage', new_usage,
      'limit', p_limit,
      'remaining', GREATEST(0, p_limit - current_usage),
      'error_code', 'LIMIT_EXCEEDED'
    );
  END IF;
  
  -- Increment atomically (insert or update)
  INSERT INTO feature_usage (user_id, period, voice_seconds, updated_at)
  VALUES (p_user_id, p_period, p_seconds, NOW())
  ON CONFLICT (user_id, period)
  DO UPDATE SET 
    voice_seconds = feature_usage.voice_seconds + p_seconds,
    updated_at = NOW();
  
  -- Return success with usage info
  RETURN jsonb_build_object(
    'success', true,
    'previous_usage', current_usage,
    'incremented_by', p_seconds,
    'new_usage', new_usage,
    'remaining', p_limit - new_usage,
    'limit', p_limit
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Return error details
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'Database error: ' || SQLERRM,
      'error_code', 'DATABASE_ERROR'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomic check-and-increment for insights count
CREATE OR REPLACE FUNCTION check_and_increment_insights_count(
  p_user_id UUID,
  p_count INTEGER,
  p_period TEXT,
  p_limit INTEGER
) RETURNS JSONB AS $$
DECLARE
  current_usage INTEGER := 0;
  new_usage INTEGER;
BEGIN
  -- Input validation
  IF p_count <= 0 THEN
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

  -- Get current usage with row lock (prevents concurrent modifications)
  SELECT COALESCE(insights_count, 0) INTO current_usage
  FROM feature_usage
  WHERE user_id = p_user_id AND period = p_period
  FOR UPDATE;
  
  -- Calculate new usage
  new_usage := current_usage + p_count;
  
  -- Check limit BEFORE incrementing
  IF new_usage > p_limit THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'Monthly limit exceeded',
      'current_usage', current_usage,
      'requested', p_count,
      'new_usage', new_usage,
      'limit', p_limit,
      'remaining', GREATEST(0, p_limit - current_usage),
      'error_code', 'LIMIT_EXCEEDED'
    );
  END IF;
  
  -- Increment atomically (insert or update)
  INSERT INTO feature_usage (user_id, period, insights_count, updated_at)
  VALUES (p_user_id, p_period, p_count, NOW())
  ON CONFLICT (user_id, period)
  DO UPDATE SET 
    insights_count = feature_usage.insights_count + p_count,
    updated_at = NOW();
  
  -- Return success with usage info
  RETURN jsonb_build_object(
    'success', true,
    'previous_usage', current_usage,
    'incremented_by', p_count,
    'new_usage', new_usage,
    'remaining', p_limit - new_usage,
    'limit', p_limit
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Return error details
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'Database error: ' || SQLERRM,
      'error_code', 'DATABASE_ERROR'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Keep the simple increment functions for backward compatibility
-- (These are used when we're just incrementing without checking limits)

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_and_increment_voice_seconds(UUID, INTEGER, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION check_and_increment_voice_seconds(UUID, INTEGER, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION check_and_increment_insights_count(UUID, INTEGER, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION check_and_increment_insights_count(UUID, INTEGER, TEXT, INTEGER) TO service_role;

-- Add comments for documentation
COMMENT ON FUNCTION check_and_increment_voice_seconds IS 'Atomically checks limit and increments voice seconds. Returns JSONB with success status and usage details.';
COMMENT ON FUNCTION check_and_increment_insights_count IS 'Atomically checks limit and increments insights count. Returns JSONB with success status and usage details.';
