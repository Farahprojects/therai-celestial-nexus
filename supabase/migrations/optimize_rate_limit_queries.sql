-- Rate Limit Query Optimization
-- Adds critical indexes for check_feature_limit function performance
-- Run this to speed up rate limit checks across the application

-- 1. Profiles table: Optimize subscription info lookups
-- Used in check_feature_limit for getting user plan and trial status
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_lookup
ON profiles(id, subscription_plan, subscription_active, subscription_status, trial_end_date);

-- 2. Plan limits table: Optimize plan limit lookups
-- Used for getting limits by plan_id and active status
-- NOTE: idx_plan_limits_plan_id already exists, but let's ensure it's optimized
CREATE INDEX IF NOT EXISTS idx_plan_limits_active_limits
ON plan_limits(plan_id, is_active, image_generation_daily_limit, chat_messages_daily_limit, therai_calls_limit, insights_limit);

-- 3. Feature usage table: Optimize usage lookups
-- Used for getting current usage with user_id and reset_date filters
CREATE INDEX IF NOT EXISTS idx_feature_usage_user_reset_lookup
ON feature_usage(user_id, last_reset_date, images_generated, chat_messages, therai_calls, insights_count);

-- 4. Composite index for plan limits with specific columns
-- Optimize the dynamic column lookup in check_feature_limit
CREATE INDEX IF NOT EXISTS idx_plan_limits_dynamic_lookup
ON plan_limits(plan_id, is_active);

-- Analyze tables to update query planner statistics
ANALYZE profiles;
ANALYZE plan_limits;
ANALYZE feature_usage;

-- Verification query - run after migration:
-- SELECT schemaname, tablename, indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename IN ('profiles', 'plan_limits', 'feature_usage')
-- AND indexname LIKE '%rate_limit%' OR indexname LIKE '%subscription%' OR indexname LIKE '%feature_usage%'
-- ORDER BY tablename, indexname;
