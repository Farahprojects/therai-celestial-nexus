-- ============================================================================
-- DROP IMAGE_GENERATION_LOG TABLE
-- Now that we track image counts in feature_usage, this table is no longer needed
-- ============================================================================

-- Drop the image_generation_log table
DROP TABLE IF EXISTS image_generation_log CASCADE;

-- Note: The table is completely removed. Image counts are now tracked in
-- the feature_usage.images_generated column with daily resets.

