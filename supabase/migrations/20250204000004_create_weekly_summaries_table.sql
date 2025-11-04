-- Create user_memory_weekly_summaries table for weekly energy patterns

CREATE TABLE user_memory_weekly_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES user_profile_list(id) ON DELETE CASCADE,
  year SMALLINT NOT NULL,
  week_number SMALLINT NOT NULL CHECK (week_number >= 1 AND week_number <= 53),
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  emotional_summary TEXT NOT NULL,
  key_themes TEXT[],
  dominant_patterns TEXT[],
  conversation_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, profile_id, year, week_number)
);

CREATE INDEX idx_weekly_summaries_user 
ON user_memory_weekly_summaries(user_id, year DESC, week_number DESC);

COMMENT ON TABLE user_memory_weekly_summaries IS 'Weekly energy summaries synthesized from 4-turn conversation summaries';

