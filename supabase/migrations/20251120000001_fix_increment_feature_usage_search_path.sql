-- Fix increment_feature_usage function search_path security issue
-- Add SET search_path to prevent search path manipulation attacks

CREATE OR REPLACE FUNCTION public.increment_feature_usage(
  p_user_id UUID,
  p_feature_type TEXT,
  p_amount INTEGER,
  p_period TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO feature_usage (user_id, feature_type, usage_amount, period, updated_at)
  VALUES (p_user_id, p_feature_type, p_amount, p_period, NOW())
  ON CONFLICT (user_id, feature_type, period)
  DO UPDATE SET 
    usage_amount = feature_usage.usage_amount + p_amount,
    updated_at = NOW();
END;
$$;

-- Add comment explaining the security fix
COMMENT ON FUNCTION public.increment_feature_usage(UUID, TEXT, INTEGER, TEXT) IS 
  'Increments feature usage for a user. Fixed with SET search_path to prevent search path manipulation attacks.';

