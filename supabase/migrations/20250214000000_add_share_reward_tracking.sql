-- Add last_share_reward_date column to profiles for tracking daily share rewards
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS last_share_reward_date DATE;

-- Add comment for documentation
COMMENT ON COLUMN profiles.last_share_reward_date IS 'Tracks the last date user claimed share reward (once per day limit)';

