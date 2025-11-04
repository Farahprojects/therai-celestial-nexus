-- Enable Row Level Security on all memory tables

ALTER TABLE user_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memory_weekly_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memory_monthly_summaries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_memory
CREATE POLICY "Users can manage their own memories"
ON user_memory FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS Policies for user_memory_weekly_summaries
CREATE POLICY "Users can manage their own weekly summaries"
ON user_memory_weekly_summaries FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS Policies for user_memory_monthly_summaries
CREATE POLICY "Users can manage their own monthly summaries"
ON user_memory_monthly_summaries FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Note: In together/shared mode, each participant's memories are separate
-- RLS ensures complete isolation between users

