-- Create feature_usage table for tracking monthly feature limits
CREATE TABLE IF NOT EXISTS feature_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_type TEXT NOT NULL CHECK (feature_type IN ('voice_seconds', 'insights_count')),
  usage_amount INTEGER NOT NULL DEFAULT 0,
  period TEXT NOT NULL, -- 'YYYY-MM' format
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, feature_type, period)
);
-- Add index for fast lookups (only if feature_type column exists)
-- This migration was superseded by 20250207000000_modular_feature_usage.sql
-- Commenting out to avoid conflicts
-- CREATE INDEX IF NOT EXISTS idx_feature_usage_lookup 
-- ON feature_usage(user_id, feature_type, period);

-- Enable RLS
ALTER TABLE feature_usage ENABLE ROW LEVEL SECURITY;
-- RLS Policies: Users can only see their own usage
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
-- Atomic increment function for concurrent usage tracking
CREATE OR REPLACE FUNCTION increment_feature_usage(
  p_user_id UUID,
  p_feature_type TEXT,
  p_amount INTEGER,
  p_period TEXT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO feature_usage (user_id, feature_type, usage_amount, period, updated_at)
  VALUES (p_user_id, p_feature_type, p_amount, p_period, NOW())
  ON CONFLICT (user_id, feature_type, period)
  DO UPDATE SET 
    usage_amount = feature_usage.usage_amount + p_amount,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION increment_feature_usage(UUID, TEXT, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_feature_usage(UUID, TEXT, INTEGER, TEXT) TO service_role;
