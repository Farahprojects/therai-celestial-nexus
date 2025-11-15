-- ============================================================================
-- FIX FEATURE_USAGE - DROP VOICE_SECONDS COLUMN
-- This migration ensures voice_seconds is dropped from feature_usage table
-- Voice tracking is now in the separate voice_usage table
-- ============================================================================

-- Drop voice_seconds column if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'feature_usage' 
    AND column_name = 'voice_seconds'
  ) THEN
    ALTER TABLE feature_usage DROP COLUMN voice_seconds;
    RAISE NOTICE 'Dropped voice_seconds column from feature_usage table';
  ELSE
    RAISE NOTICE 'voice_seconds column does not exist in feature_usage table';
  END IF;
END $$;

-- Drop period column if it exists (no longer needed with single row per user)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'feature_usage' 
    AND column_name = 'period'
  ) THEN
    -- First drop the unique constraint that uses period
    ALTER TABLE feature_usage DROP CONSTRAINT IF EXISTS feature_usage_user_id_period_key;
    ALTER TABLE feature_usage DROP COLUMN period;
    RAISE NOTICE 'Dropped period column from feature_usage table';
  ELSE
    RAISE NOTICE 'period column does not exist in feature_usage table';
  END IF;
END $$;

-- Add last_reset_date if it doesn't exist
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'feature_usage') THEN
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'feature_usage' 
      AND column_name = 'last_reset_date'
    ) THEN
      ALTER TABLE feature_usage ADD COLUMN last_reset_date DATE NOT NULL DEFAULT CURRENT_DATE;
      RAISE NOTICE 'Added last_reset_date column to feature_usage table';
    ELSE
      RAISE NOTICE 'last_reset_date column already exists in feature_usage table';
    END IF;
  END IF;
END $$;

-- Drop id column and make user_id primary key if needed
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'feature_usage') THEN
    -- Check if id column exists
    IF EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'feature_usage' 
      AND column_name = 'id'
    ) THEN
      -- Drop old primary key if it exists
      ALTER TABLE feature_usage DROP CONSTRAINT IF EXISTS feature_usage_pkey;
      ALTER TABLE feature_usage DROP COLUMN id;
      RAISE NOTICE 'Dropped id column from feature_usage table';
    END IF;
    
    -- Make user_id the primary key if it's not already
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conrelid = 'feature_usage'::regclass 
      AND contype = 'p'
    ) THEN
      ALTER TABLE feature_usage ADD PRIMARY KEY (user_id);
      RAISE NOTICE 'Made user_id primary key on feature_usage table';
    ELSE
      RAISE NOTICE 'Primary key already exists on feature_usage table';
    END IF;
  END IF;
END $$;

-- Drop old index if it exists
DROP INDEX IF EXISTS idx_feature_usage_user_period;

-- Update table comment
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'feature_usage') THEN
    COMMENT ON TABLE feature_usage IS 'Feature usage tracking - ONE row per user with daily auto-reset. Voice tracking moved to voice_usage table.';
  END IF;
END $$;




