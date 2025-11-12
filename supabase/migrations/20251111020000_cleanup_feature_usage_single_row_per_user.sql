-- ============================================================================
-- CLEAN UP FEATURE_USAGE TABLE - SINGLE ROW PER USER
-- Migrate from period-based rows to single row per user with daily auto-reset
-- ============================================================================

-- Step 1: Analyze and consolidate duplicate rows (if table exists)
-- Keep the most recent row for each user (highest updated_at)
DO $$
DECLARE
  v_user_id UUID;
  v_max_updated_at TIMESTAMPTZ;
  v_table_exists BOOLEAN;
BEGIN
  -- Check if table exists
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'feature_usage'
  ) INTO v_table_exists;
  
  IF v_table_exists THEN
    -- Find users with multiple rows
    FOR v_user_id IN 
      SELECT DISTINCT user_id 
      FROM feature_usage 
      WHERE user_id IN (
        SELECT user_id 
        FROM feature_usage 
        GROUP BY user_id 
        HAVING COUNT(*) > 1
      )
    LOOP
      -- Get the most recent updated_at for this user
      SELECT MAX(updated_at) INTO v_max_updated_at
      FROM feature_usage
      WHERE user_id = v_user_id;
      
      -- Delete all rows except the most recent one
      DELETE FROM feature_usage
      WHERE user_id = v_user_id
        AND updated_at < v_max_updated_at;
    END LOOP;
  END IF;
END $$;

-- Step 2: Drop voice_seconds column (now in voice_usage table)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'feature_usage') THEN
    ALTER TABLE feature_usage DROP COLUMN IF EXISTS voice_seconds;
  END IF;
END $$;

-- Step 3: Drop old period-based constraint
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'feature_usage') THEN
    ALTER TABLE feature_usage DROP CONSTRAINT IF EXISTS feature_usage_user_id_period_key;
  END IF;
END $$;

-- Step 4: Drop period column (no longer needed)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'feature_usage') THEN
    ALTER TABLE feature_usage DROP COLUMN IF EXISTS period;
  END IF;
END $$;

-- Step 5: Add last_reset_date for auto-reset logic
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'feature_usage') THEN
    ALTER TABLE feature_usage ADD COLUMN IF NOT EXISTS last_reset_date DATE NOT NULL DEFAULT CURRENT_DATE;
  END IF;
END $$;

-- Step 6: Drop old primary key (id column) and make user_id primary key
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'feature_usage') THEN
    -- Drop old primary key if it exists
    ALTER TABLE feature_usage DROP CONSTRAINT IF EXISTS feature_usage_pkey;
    
    -- Drop id column if it exists
    ALTER TABLE feature_usage DROP COLUMN IF EXISTS id;
    
    -- Make user_id the primary key (enforces ONE row per user)
    -- Only add if primary key doesn't already exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conrelid = 'feature_usage'::regclass 
      AND contype = 'p'
    ) THEN
      ALTER TABLE feature_usage ADD PRIMARY KEY (user_id);
    END IF;
  END IF;
END $$;

-- Step 7: Drop old index (no longer needed with single row per user)
DROP INDEX IF EXISTS idx_feature_usage_user_period;

-- Step 10: Update increment_chat_messages function
CREATE OR REPLACE FUNCTION increment_chat_messages(
  p_user_id UUID,
  p_count INTEGER
) RETURNS VOID AS $$
BEGIN
  INSERT INTO feature_usage (user_id, chat_messages, last_reset_date, updated_at)
  VALUES (p_user_id, p_count, CURRENT_DATE, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    chat_messages = CASE
      WHEN feature_usage.last_reset_date < CURRENT_DATE
        THEN p_count  -- Reset to new count (new day)
      ELSE feature_usage.chat_messages + p_count  -- Increment existing count
    END,
    last_reset_date = CURRENT_DATE,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 11: Update increment_images_generated function
CREATE OR REPLACE FUNCTION increment_images_generated(
  p_user_id UUID,
  p_count INTEGER
) RETURNS VOID AS $$
BEGIN
  INSERT INTO feature_usage (user_id, images_generated, last_reset_date, updated_at)
  VALUES (p_user_id, p_count, CURRENT_DATE, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    images_generated = CASE
      WHEN feature_usage.last_reset_date < CURRENT_DATE
        THEN p_count  -- Reset to new count (new day)
      ELSE feature_usage.images_generated + p_count  -- Increment existing count
    END,
    last_reset_date = CURRENT_DATE,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 12: Update increment_therai_calls function
CREATE OR REPLACE FUNCTION increment_therai_calls(
  p_user_id UUID,
  p_calls INTEGER
) RETURNS VOID AS $$
BEGIN
  INSERT INTO feature_usage (user_id, therai_calls, last_reset_date, updated_at)
  VALUES (p_user_id, p_calls, CURRENT_DATE, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    therai_calls = CASE
      WHEN feature_usage.last_reset_date < CURRENT_DATE
        THEN p_calls  -- Reset to new count (new day)
      ELSE feature_usage.therai_calls + p_calls  -- Increment existing count
    END,
    last_reset_date = CURRENT_DATE,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 13: Update increment_insights_count function
CREATE OR REPLACE FUNCTION increment_insights_count(
  p_user_id UUID,
  p_count INTEGER
) RETURNS VOID AS $$
BEGIN
  INSERT INTO feature_usage (user_id, insights_count, last_reset_date, updated_at)
  VALUES (p_user_id, p_count, CURRENT_DATE, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    insights_count = CASE
      WHEN feature_usage.last_reset_date < CURRENT_DATE
        THEN p_count  -- Reset to new count (new day)
      ELSE feature_usage.insights_count + p_count  -- Increment existing count
    END,
    last_reset_date = CURRENT_DATE,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 14: Update check_feature_limit function
CREATE OR REPLACE FUNCTION check_feature_limit(
  p_user_id UUID,
  p_feature_type TEXT,
  p_requested_amount INTEGER DEFAULT 1,
  p_period TEXT DEFAULT NULL -- Ignored, kept for backward compatibility
) RETURNS JSONB AS $$
DECLARE
  v_plan_id TEXT;
  v_subscription_active BOOLEAN;
  v_subscription_status TEXT;
  v_trial_end_date TIMESTAMPTZ;
  v_limit INTEGER;
  v_current_usage INTEGER := 0;
  v_feature_column TEXT;
  v_limit_column TEXT;
  v_last_reset_date DATE;
BEGIN
  -- 1. Get user's subscription plan and trial status
  SELECT subscription_plan, subscription_active, subscription_status, trial_end_date
  INTO v_plan_id, v_subscription_active, v_subscription_status, v_trial_end_date
  FROM profiles
  WHERE id = p_user_id;
  
  IF v_plan_id IS NULL THEN
    v_plan_id := 'free';
  END IF;
  
  -- 2. FREE TRIAL CHECK: Block AI features after 1 week for free users
  IF v_plan_id = 'free' AND v_trial_end_date IS NOT NULL AND NOW() > v_trial_end_date THEN
    IF p_feature_type IN ('chat', 'voice_seconds', 'image_generation', 'therai_calls', 'insights') THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'Free trial expired. Upgrade to continue using AI features.',
        'error_code', 'TRIAL_EXPIRED',
        'trial_end_date', v_trial_end_date
      );
    END IF;
  END IF;
  
  -- 3. Check if user has active subscription (except for free tier checks)
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
  
  -- 4. Determine feature mapping (all features are daily now)
  CASE p_feature_type
    WHEN 'voice_seconds' THEN
      -- Voice uses separate voice_usage table, handled by check_voice_limit
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'Use check_voice_limit for voice features',
        'error_code', 'INVALID_FEATURE'
      );
    WHEN 'image_generation' THEN
      v_limit_column := 'image_generation_daily_limit';
      v_feature_column := 'images_generated';
    WHEN 'therai_calls' THEN
      v_limit_column := 'therai_calls_limit';
      v_feature_column := 'therai_calls';
    WHEN 'chat' THEN
      v_limit_column := 'chat_messages_daily_limit';
      v_feature_column := 'chat_messages';
    WHEN 'insights' THEN
      v_limit_column := 'insights_limit';
      v_feature_column := 'insights_count';
    ELSE
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'Unknown feature type',
        'error_code', 'INVALID_FEATURE'
      );
  END CASE;
  
  -- 5. Get limit from plan_limits table
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
  
  -- 6. Get current usage (auto-reset if last_reset_date < CURRENT_DATE)
  SELECT last_reset_date INTO v_last_reset_date
  FROM feature_usage
  WHERE user_id = p_user_id;
  
  -- If row doesn't exist or needs reset, usage is 0
  IF v_last_reset_date IS NULL OR v_last_reset_date < CURRENT_DATE THEN
    v_current_usage := 0;
    -- Auto-create/reset row
    INSERT INTO feature_usage (user_id, last_reset_date, updated_at)
    VALUES (p_user_id, CURRENT_DATE, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      last_reset_date = CURRENT_DATE,
      updated_at = NOW();
  ELSE
    -- Get actual usage value (only if current day)
    EXECUTE format('SELECT COALESCE(%I, 0) FROM feature_usage WHERE user_id = $1', v_feature_column)
    INTO v_current_usage
    USING p_user_id;
  END IF;
  
  -- 7. Check if limit exceeded
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
  
  -- 8. Allow access
  RETURN jsonb_build_object(
    'allowed', true,
    'limit', v_limit,
    'current_usage', v_current_usage,
    'remaining', v_limit - v_current_usage - p_requested_amount,
    'is_unlimited', false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 15: Update get_user_limits function
CREATE OR REPLACE FUNCTION get_user_limits(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_plan_id TEXT;
  v_limits JSONB;
  v_usage JSONB;
  v_last_reset_date DATE;
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
  
  -- Get current usage (single row per user)
  SELECT last_reset_date INTO v_last_reset_date
  FROM feature_usage
  WHERE user_id = p_user_id;
  
  -- If no row exists or needs reset, return zeros
  IF v_last_reset_date IS NULL OR v_last_reset_date < CURRENT_DATE THEN
    v_usage := jsonb_build_object(
      'images_generated', 0,
      'chat_messages', 0,
      'therai_calls', 0,
      'insights_count', 0
    );
  ELSE
    -- Build usage object from actual values
    SELECT jsonb_build_object(
      'images_generated', COALESCE(images_generated, 0),
      'chat_messages', COALESCE(chat_messages, 0),
      'therai_calls', COALESCE(therai_calls, 0),
      'insights_count', COALESCE(insights_count, 0)
    )
    INTO v_usage
    FROM feature_usage
    WHERE user_id = p_user_id;
  END IF;
  
  -- Ensure all fields exist with defaults
  v_usage := jsonb_build_object(
    'images_generated', COALESCE((v_usage->>'images_generated')::INTEGER, 0),
    'chat_messages', COALESCE((v_usage->>'chat_messages')::INTEGER, 0),
    'therai_calls', COALESCE((v_usage->>'therai_calls')::INTEGER, 0),
    'insights_count', COALESCE((v_usage->>'insights_count')::INTEGER, 0)
  );
  
  -- Combine and return
  RETURN jsonb_build_object(
    'limits', v_limits,
    'usage', v_usage
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 16: Grant execute permissions
GRANT EXECUTE ON FUNCTION increment_chat_messages(UUID, INTEGER) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION increment_images_generated(UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION increment_therai_calls(UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION increment_insights_count(UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION check_feature_limit TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_user_limits TO authenticated, anon, service_role;

-- Step 17: Update comments
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'feature_usage') THEN
    COMMENT ON TABLE feature_usage IS 'Feature usage tracking - ONE row per user with daily auto-reset. Voice tracking moved to voice_usage table.';
  END IF;
END $$;
COMMENT ON FUNCTION increment_chat_messages IS 'Increment daily chat messages count. Auto-resets daily via last_reset_date.';
COMMENT ON FUNCTION increment_images_generated IS 'Increment daily image generation count. Auto-resets daily via last_reset_date.';
COMMENT ON FUNCTION increment_therai_calls IS 'Increment daily @therai calls count. Auto-resets daily via last_reset_date.';
COMMENT ON FUNCTION increment_insights_count IS 'Increment daily insights count. Auto-resets daily via last_reset_date.';
COMMENT ON FUNCTION check_feature_limit IS 'Check feature limits using single-row-per-user design with daily auto-reset. Voice uses separate check_voice_limit function.';
COMMENT ON FUNCTION get_user_limits IS 'Get all limits and current usage for a user. Uses single-row-per-user design with daily auto-reset.';

