-- ============================================================================
-- ADD PLUS PLAN ($8/month) FOR A/B TESTING
-- ============================================================================
-- This migration adds a new Plus plan as an A/B test alternative to Growth
-- Plus: $8/month, 1 image/day, 5 min voice
-- Growth: $10/month, 3 images/day, 10 min voice
-- ============================================================================

-- 1. Add ab_test_group column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ab_test_group TEXT;

-- Add index for A/B test queries
CREATE INDEX IF NOT EXISTS idx_profiles_ab_test_group ON profiles(ab_test_group) WHERE ab_test_group IS NOT NULL;

-- Add comment
COMMENT ON COLUMN profiles.ab_test_group IS 'A/B test group identifier (e.g., "plus_plan", "growth_plan"). Used to show different pricing options to different users.';

-- 2. Add Plus plan to plan_limits table
INSERT INTO plan_limits (
  plan_id, 
  plan_name, 
  voice_seconds_limit, 
  image_generation_daily_limit, 
  therai_calls_limit, 
  insights_limit, 
  has_together_mode,
  has_voice_mode,
  has_image_generation,
  has_priority_support, 
  has_early_access, 
  display_order
) VALUES (
  '8_monthly',
  'Plus',
  300,  -- 5 minutes (300 seconds)
  1,    -- 1 image per day
  NULL, -- unlimited @therai calls
  NULL, -- unlimited insights
  true,
  true,
  true,
  false,
  false,
  1
)
ON CONFLICT (plan_id) DO UPDATE SET
  voice_seconds_limit = EXCLUDED.voice_seconds_limit,
  image_generation_daily_limit = EXCLUDED.image_generation_daily_limit,
  therai_calls_limit = EXCLUDED.therai_calls_limit,
  insights_limit = EXCLUDED.insights_limit,
  has_together_mode = EXCLUDED.has_together_mode,
  has_voice_mode = EXCLUDED.has_voice_mode,
  has_image_generation = EXCLUDED.has_image_generation,
  has_priority_support = EXCLUDED.has_priority_support,
  has_early_access = EXCLUDED.has_early_access,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- 3. Add Plus plan to price_list table
INSERT INTO price_list (
  id, 
  endpoint, 
  name, 
  description, 
  unit_price_usd, 
  product_code, 
  stripe_price_id
) VALUES (
  '8_monthly',
  'subscription',
  'Plus',
  'Essential features for daily practice',
  8.00,
  'plus_monthly',
  'price_1SSizlJ1YhE4Ljp0ldtlN0j6'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  unit_price_usd = EXCLUDED.unit_price_usd,
  product_code = EXCLUDED.product_code,
  stripe_price_id = EXCLUDED.stripe_price_id;

-- 4. Update table comments
COMMENT ON TABLE price_list IS 'Product pricing catalog - Plus ($8/month A/B test), Growth ($10/month), Premium ($18/month)';

-- 5. Add helper function to assign A/B test groups
CREATE OR REPLACE FUNCTION assign_ab_test_group()
RETURNS TEXT AS $$
BEGIN
  -- Simple random assignment: 50/50 split between Plus and Growth
  -- Can be modified later for more sophisticated assignment logic
  IF random() < 0.5 THEN
    RETURN 'plus_plan';
  ELSE
    RETURN 'growth_plan';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION assign_ab_test_group TO authenticated, service_role;

COMMENT ON FUNCTION assign_ab_test_group IS 'Randomly assigns new users to A/B test groups for pricing experiments';

-- 6. Create trigger to auto-assign A/B test groups to new users
-- (Optional - only if you want automatic assignment)
-- Commenting out for now - you can manually assign via admin or signup flow
-- CREATE OR REPLACE FUNCTION trigger_assign_ab_test_group()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   IF NEW.ab_test_group IS NULL AND NEW.subscription_plan = 'free' THEN
--     NEW.ab_test_group := assign_ab_test_group();
--   END IF;
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
-- 
-- CREATE TRIGGER trg_assign_ab_test_group
-- BEFORE INSERT ON profiles
-- FOR EACH ROW
-- EXECUTE FUNCTION trigger_assign_ab_test_group();


