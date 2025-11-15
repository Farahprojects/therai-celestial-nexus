-- Create modular feature_usage table for tracking monthly feature limits
-- One row per user per period with columns for each feature type

CREATE TABLE IF NOT EXISTS feature_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period TEXT NOT NULL, -- 'YYYY-MM' format
  
  -- Feature usage columns (simple counters)
  voice_seconds INTEGER NOT NULL DEFAULT 0,
  insights_count INTEGER NOT NULL DEFAULT 0,
  -- Add more features as columns:
  -- chart_requests INTEGER NOT NULL DEFAULT 0,
  -- api_calls INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, period)
);
-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_feature_usage_user_period 
ON feature_usage(user_id, period);
-- Enable RLS
ALTER TABLE feature_usage ENABLE ROW LEVEL SECURITY;
-- RLS Policy: Users can only view their own usage
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'feature_usage' 
    AND policyname = 'Users can view own feature usage'
  ) THEN
    CREATE POLICY "Users can view own feature usage"
      ON feature_usage
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;
-- Increment voice seconds atomically
CREATE OR REPLACE FUNCTION increment_voice_seconds(
  p_user_id UUID,
  p_seconds INTEGER,
  p_period TEXT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO feature_usage (user_id, period, voice_seconds, updated_at)
  VALUES (p_user_id, p_period, p_seconds, NOW())
  ON CONFLICT (user_id, period)
  DO UPDATE SET 
    voice_seconds = feature_usage.voice_seconds + p_seconds,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Increment insights count atomically
CREATE OR REPLACE FUNCTION increment_insights_count(
  p_user_id UUID,
  p_count INTEGER,
  p_period TEXT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO feature_usage (user_id, period, insights_count, updated_at)
  VALUES (p_user_id, p_period, p_count, NOW())
  ON CONFLICT (user_id, period)
  DO UPDATE SET 
    insights_count = feature_usage.insights_count + p_count,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Grant execute permissions
GRANT EXECUTE ON FUNCTION increment_voice_seconds(UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_voice_seconds(UUID, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION increment_insights_count(UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_insights_count(UUID, INTEGER, TEXT) TO service_role;
