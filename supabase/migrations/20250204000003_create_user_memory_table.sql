-- Create user_memory table for individual memory storage

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

-- Performance indexes
CREATE INDEX idx_user_memory_user_profile_active 
ON user_memory(user_id, profile_id, is_active, last_referenced_at DESC) 
WHERE is_active = true;

CREATE INDEX idx_user_memory_created ON user_memory(created_at DESC);

CREATE INDEX idx_user_memory_reference 
ON user_memory(reference_count DESC, last_referenced_at DESC);

-- Full-text search for keyword search in Settings
CREATE INDEX user_memory_fts 
ON user_memory USING gin (to_tsvector('english', coalesce(memory_text,'')));

-- Comments
COMMENT ON TABLE user_memory IS 'Stores individual memories extracted from profile-based conversations';
COMMENT ON COLUMN user_memory.source_message_id IS 'Links to the message that created this memory for traceability';
COMMENT ON COLUMN user_memory.turn_index IS 'Conversation turn number when memory was created';
COMMENT ON COLUMN user_memory.origin_mode IS 'Conversation mode: chat|astro|profile|together|swiss';
COMMENT ON COLUMN user_memory.deleted_at IS 'Soft delete timestamp for GDPR compliance';

