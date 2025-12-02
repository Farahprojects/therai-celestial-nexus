-- Add is_primary flag to identify the user's main profile
-- This allows quick lookup for Together Mode and future automated features

ALTER TABLE user_profile_list
ADD COLUMN is_primary BOOLEAN NOT NULL DEFAULT false;

-- Create unique constraint: only one primary profile per user
-- The WHERE clause makes this a partial index (only rows where is_primary = true)
CREATE UNIQUE INDEX idx_user_profile_list_primary_per_user 
ON user_profile_list(user_id) 
WHERE is_primary = true;

-- Add comment for documentation
COMMENT ON COLUMN user_profile_list.is_primary IS 'Identifies the user''s main profile used for Together Mode and automated features like daily nudges';

