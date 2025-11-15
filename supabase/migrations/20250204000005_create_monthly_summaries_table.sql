-- Create user_memory_monthly_summaries table for long-term pattern tracking

CREATE TABLE user_memory_monthly_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES user_profile_list(id) ON DELETE CASCADE,
  year SMALLINT NOT NULL,
  month SMALLINT NOT NULL CHECK (month >= 1 AND month <= 12),
  emotional_summary TEXT NOT NULL,
  cognitive_summary TEXT,
  key_themes TEXT[],
  dominant_transits JSONB,
  planetary_influences JSONB,
  conversation_count INTEGER DEFAULT 0,
  weekly_summaries_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, profile_id, year, month)
);
CREATE INDEX idx_monthly_summaries_user 
ON user_memory_monthly_summaries(user_id, year DESC, month DESC);
COMMENT ON TABLE user_memory_monthly_summaries IS 'Monthly summaries synthesized from weekly summaries for long-term pattern tracking';
COMMENT ON COLUMN user_memory_monthly_summaries.weekly_summaries_used IS 'Number of weekly summaries used to generate this monthly summary';
