# Memory System - SQL Migrations

Run these in Supabase SQL Editor in order:

## 1. Add profile_id to conversations

```sql
-- File: supabase/migrations/20250204000001_add_profile_id_to_conversations.sql

ALTER TABLE conversations 
ADD COLUMN profile_id UUID REFERENCES user_profile_list(id);

CREATE INDEX idx_conversations_profile_id ON conversations(profile_id);
CREATE INDEX idx_conversations_user_profile ON conversations(user_id, profile_id) 
WHERE profile_id IS NOT NULL;

ALTER TABLE user_profile_list
ADD CONSTRAINT unique_primary_per_user 
UNIQUE (user_id) 
WHERE is_primary = true;

COMMENT ON COLUMN conversations.profile_id IS 'Links conversation to user profile for memory tracking - only set when user selects their primary profile';
```

## 2. Create memory_type ENUM

```sql
-- File: supabase/migrations/20250204000002_create_memory_type_enum.sql

CREATE TYPE memory_type AS ENUM ('fact', 'emotion', 'goal', 'pattern', 'relationship');

COMMENT ON TYPE memory_type IS 'Classification types for user memories extracted from conversations';
```

## 3. Create user_memory table

```sql
-- File: supabase/migrations/20250204000003_create_user_memory_table.sql

CREATE TABLE user_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES user_profile_list(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  source_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  turn_index INTEGER,
  memory_text TEXT NOT NULL,
  memory_type memory_type NOT NULL,
  confidence_score NUMERIC(4,3) DEFAULT 0.800 CHECK (confidence_score BETWEEN 0 AND 1),
  astrological_context JSONB,
  origin_mode TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_referenced_at TIMESTAMPTZ,
  reference_count SMALLINT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_user_memory_user_profile_active 
ON user_memory(user_id, profile_id, is_active, last_referenced_at DESC) 
WHERE is_active = true;

CREATE INDEX idx_user_memory_created ON user_memory(created_at DESC);

CREATE INDEX idx_user_memory_reference 
ON user_memory(reference_count DESC, last_referenced_at DESC);

CREATE INDEX user_memory_fts 
ON user_memory USING gin (to_tsvector('english', coalesce(memory_text,'')));

COMMENT ON TABLE user_memory IS 'Stores individual memories extracted from profile-based conversations';
COMMENT ON COLUMN user_memory.source_message_id IS 'Links to the message that created this memory for traceability';
COMMENT ON COLUMN user_memory.turn_index IS 'Conversation turn number when memory was created';
COMMENT ON COLUMN user_memory.origin_mode IS 'Conversation mode: chat|astro|profile|together|swiss';
COMMENT ON COLUMN user_memory.deleted_at IS 'Soft delete timestamp for GDPR compliance';
```

## 4. Create weekly summaries table

```sql
-- File: supabase/migrations/20250204000004_create_weekly_summaries_table.sql

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
```

## 5. Create monthly summaries table

```sql
-- File: supabase/migrations/20250204000005_create_monthly_summaries_table.sql

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
```

## 6. Add RLS policies

```sql
-- File: supabase/migrations/20250204000006_add_memory_rls_policies.sql

ALTER TABLE user_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memory_weekly_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memory_monthly_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own memories"
ON user_memory FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own weekly summaries"
ON user_memory_weekly_summaries FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own monthly summaries"
ON user_memory_monthly_summaries FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```
