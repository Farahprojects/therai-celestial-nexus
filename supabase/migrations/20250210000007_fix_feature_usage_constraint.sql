-- ============================================================================
-- FIX FEATURE_USAGE CONSTRAINT
-- Ensure we have the correct UNIQUE constraint for the modular design
-- ============================================================================

-- Drop the old constraint if it exists (from the old feature_type design)
DO $$ 
BEGIN
  -- Drop old unique constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'feature_usage_user_id_feature_type_period_key'
  ) THEN
    ALTER TABLE feature_usage DROP CONSTRAINT feature_usage_user_id_feature_type_period_key;
  END IF;

  -- Drop feature_type column if it exists (old design)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'feature_usage' AND column_name = 'feature_type'
  ) THEN
    ALTER TABLE feature_usage DROP COLUMN feature_type;
  END IF;

  -- Drop usage_amount column if it exists (old design)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'feature_usage' AND column_name = 'usage_amount'
  ) THEN
    ALTER TABLE feature_usage DROP COLUMN usage_amount;
  END IF;
END $$;

-- Ensure we have the correct unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'feature_usage_user_id_period_key'
    AND conrelid = 'feature_usage'::regclass
  ) THEN
    ALTER TABLE feature_usage ADD CONSTRAINT feature_usage_user_id_period_key UNIQUE (user_id, period);
  END IF;
END $$;

-- Verify all columns exist (add if missing)
ALTER TABLE feature_usage ADD COLUMN IF NOT EXISTS voice_seconds INTEGER DEFAULT 0;
ALTER TABLE feature_usage ADD COLUMN IF NOT EXISTS insights_count INTEGER DEFAULT 0;
ALTER TABLE feature_usage ADD COLUMN IF NOT EXISTS therai_calls INTEGER DEFAULT 0;
ALTER TABLE feature_usage ADD COLUMN IF NOT EXISTS images_generated INTEGER DEFAULT 0;
ALTER TABLE feature_usage ADD COLUMN IF NOT EXISTS chat_messages INTEGER DEFAULT 0;

COMMENT ON TABLE feature_usage IS 'Modular feature usage tracking - one row per user per period with columns for each feature';

