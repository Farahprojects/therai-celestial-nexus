-- Gemini Context Caching System Migration

-- Create conversation_caches table
CREATE TABLE IF NOT EXISTS conversation_caches (
  chat_id UUID PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
  cache_name TEXT NOT NULL,
  system_data_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_caches_expires ON conversation_caches(expires_at);

ALTER TABLE conversation_caches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on conversation_caches" 
  ON conversation_caches 
  FOR ALL 
  TO service_role 
  USING (true)
  WITH CHECK (true);

-- Create conversation_summaries table
CREATE TABLE IF NOT EXISTS conversation_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  summary_text TEXT NOT NULL,
  turn_range TEXT NOT NULL,
  message_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_summaries_chat_created 
  ON conversation_summaries(chat_id, created_at DESC);

ALTER TABLE conversation_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on conversation_summaries" 
  ON conversation_summaries 
  FOR ALL 
  TO service_role 
  USING (true)
  WITH CHECK (true);

-- Update conversations table
ALTER TABLE conversations 
  ADD COLUMN IF NOT EXISTS turn_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_summary_at_turn INTEGER DEFAULT 0;
