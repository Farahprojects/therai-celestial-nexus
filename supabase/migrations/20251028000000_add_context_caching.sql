-- Gemini Context Caching System Migration
-- Adds tables for caching Gemini context and storing conversation summaries

-- 1. Create conversation_caches table
-- Stores Gemini cache references per conversation
CREATE TABLE IF NOT EXISTS conversation_caches (
  chat_id TEXT PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
  cache_name TEXT NOT NULL,
  system_data_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Index for expiration-based cleanup
CREATE INDEX IF NOT EXISTS idx_caches_expires ON conversation_caches(expires_at);

-- Enable RLS
ALTER TABLE conversation_caches ENABLE ROW LEVEL SECURITY;

-- Service role full access policy
CREATE POLICY "Service role full access on conversation_caches" 
  ON conversation_caches 
  FOR ALL 
  TO service_role 
  USING (true)
  WITH CHECK (true);

-- 2. Create conversation_summaries table
-- Stores lightweight summaries of conversation context
CREATE TABLE IF NOT EXISTS conversation_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  summary_text TEXT NOT NULL,
  turn_range TEXT NOT NULL, -- e.g., "1-15", "16-30"
  message_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient chat_id + created_at queries
CREATE INDEX IF NOT EXISTS idx_summaries_chat_created 
  ON conversation_summaries(chat_id, created_at DESC);

-- Enable RLS
ALTER TABLE conversation_summaries ENABLE ROW LEVEL SECURITY;

-- Service role full access policy
CREATE POLICY "Service role full access on conversation_summaries" 
  ON conversation_summaries 
  FOR ALL 
  TO service_role 
  USING (true)
  WITH CHECK (true);

-- 3. Update conversations table
-- Add turn counter to track when summaries are needed
ALTER TABLE conversations 
  ADD COLUMN IF NOT EXISTS turn_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_summary_at_turn INTEGER DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN conversations.turn_count IS 'Total number of user-assistant message pairs in this conversation';
COMMENT ON COLUMN conversations.last_summary_at_turn IS 'Turn count when the last summary was generated';
COMMENT ON TABLE conversation_caches IS 'Stores Gemini API cache references for system messages to reduce token costs';
COMMENT ON TABLE conversation_summaries IS 'Stores psychological/energetic summaries of conversation history';

