-- ============================================================================
-- INTELLIGENT MEMORY BUFFER SYSTEM
-- Three-tier memory architecture: buffer -> cache -> long-term
-- ============================================================================

-- 1. Short-term observation buffer (ephemeral, awaiting context)
CREATE TABLE IF NOT EXISTS user_memory_buffer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, -- References profiles.id (no FK to avoid auth.users)
  profile_id UUID NOT NULL REFERENCES user_profile_list(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  source_message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  
  -- Observation content
  observation_text TEXT NOT NULL,
  observation_type TEXT NOT NULL CHECK (observation_type IN ('fact', 'emotion', 'goal', 'pattern', 'relationship')),
  
  -- Metadata for intelligent processing
  confidence_score NUMERIC(4,3) DEFAULT 0.850,
  value_score NUMERIC(4,3) DEFAULT 0.750,
  time_horizon TEXT DEFAULT 'seasonal' CHECK (time_horizon IN ('enduring', 'seasonal', 'ephemeral')),
  
  -- Context tracking
  turns_observed INT DEFAULT 1,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'contradicted', 'superseded', 'merged')),
  
  -- Related observations (for merging/superseding)
  related_buffer_ids UUID[],
  
  -- Processing metadata
  extraction_metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_memory_buffer ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own memory buffers"
  ON user_memory_buffer FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage memory buffers"
  ON user_memory_buffer FOR ALL
  USING (auth.role() = 'service_role');

-- Indexes for efficient querying
CREATE INDEX idx_memory_buffer_user_pending ON user_memory_buffer(user_id, status) WHERE status = 'pending';
CREATE INDEX idx_memory_buffer_conversation ON user_memory_buffer(conversation_id, status);
CREATE INDEX idx_memory_buffer_last_seen ON user_memory_buffer(last_seen_at) WHERE status = 'pending';
CREATE INDEX idx_memory_buffer_profile ON user_memory_buffer(profile_id, user_id);

-- ============================================================================
-- 2. Conversation activity tracking (for inactivity detection)
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversation_activity (
  conversation_id UUID PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- References profiles.id (no FK to avoid auth.users)
  
  last_user_message_at TIMESTAMPTZ,
  last_assistant_message_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Buffer processing tracking
  last_buffer_processed_at TIMESTAMPTZ,
  pending_buffer_count INT DEFAULT 0,
  
  -- Inactivity detection
  inactivity_threshold_minutes INT DEFAULT 10,
  buffer_processing_scheduled BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE conversation_activity ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own conversation activity"
  ON conversation_activity FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage conversation activity"
  ON conversation_activity FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX idx_conversation_activity_last_activity ON conversation_activity(last_activity_at);
CREATE INDEX idx_conversation_activity_pending_buffer ON conversation_activity(pending_buffer_count) WHERE pending_buffer_count > 0;

-- ============================================================================
-- 3. Update user_memory table to track promotion from buffer
-- ============================================================================
ALTER TABLE user_memory 
  ADD COLUMN IF NOT EXISTS promoted_from_buffer_id UUID REFERENCES user_memory_buffer(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS memory_tier TEXT DEFAULT 'long_term' CHECK (memory_tier IN ('long_term', 'medium_term'));

CREATE INDEX IF NOT EXISTS idx_user_memory_tier ON user_memory(user_id, memory_tier);

-- ============================================================================
-- 4. Function to update conversation activity
-- ============================================================================
CREATE OR REPLACE FUNCTION update_conversation_activity()
RETURNS TRIGGER AS $$
DECLARE
  conv_user_id UUID;
BEGIN
  -- Only track completed messages
  IF NEW.status = 'complete' THEN
    -- Get user_id once (avoid repeated subquery)
    SELECT user_id INTO conv_user_id FROM conversations WHERE id = NEW.chat_id;
    
    INSERT INTO conversation_activity (
      conversation_id,
      user_id,
      last_user_message_at,
      last_assistant_message_at,
      last_activity_at
    ) VALUES (
      NEW.chat_id,
      COALESCE(NEW.user_id, conv_user_id),
      CASE WHEN NEW.role = 'user' THEN NEW.created_at ELSE NULL END,
      CASE WHEN NEW.role = 'assistant' THEN NEW.created_at ELSE NULL END,
      NEW.created_at
    )
    ON CONFLICT (conversation_id) DO UPDATE SET
      last_user_message_at = CASE 
        WHEN NEW.role = 'user' THEN NEW.created_at 
        ELSE conversation_activity.last_user_message_at 
      END,
      last_assistant_message_at = CASE 
        WHEN NEW.role = 'assistant' THEN NEW.created_at 
        ELSE conversation_activity.last_assistant_message_at 
      END,
      last_activity_at = NEW.created_at,
      updated_at = NOW(),
      buffer_processing_scheduled = false;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic activity tracking
DROP TRIGGER IF EXISTS track_conversation_activity ON messages;
CREATE TRIGGER track_conversation_activity
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_activity();

-- ============================================================================
-- 5. Function to get conversations with pending buffers needing processing
-- ============================================================================
CREATE OR REPLACE FUNCTION get_conversations_needing_buffer_processing(
  inactivity_minutes INT DEFAULT 10
)
RETURNS TABLE (
  conversation_id UUID,
  user_id UUID,
  pending_count INT,
  minutes_since_activity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ca.conversation_id,
    ca.user_id,
    ca.pending_buffer_count,
    EXTRACT(EPOCH FROM (NOW() - ca.last_activity_at)) / 60.0 AS minutes_since_activity
  FROM conversation_activity ca
  WHERE 
    ca.pending_buffer_count > 0
    AND ca.buffer_processing_scheduled = false
    AND (NOW() - ca.last_activity_at) >= INTERVAL '1 minute' * inactivity_minutes
  ORDER BY ca.last_activity_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. Function to update buffer pending count
-- ============================================================================
CREATE OR REPLACE FUNCTION update_buffer_pending_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    -- Increment pending count
    UPDATE conversation_activity
    SET 
      pending_buffer_count = pending_buffer_count + 1,
      updated_at = NOW()
    WHERE conversation_id = NEW.conversation_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status != 'pending' THEN
    -- Decrement pending count when status changes from pending
    UPDATE conversation_activity
    SET 
      pending_buffer_count = GREATEST(0, pending_buffer_count - 1),
      updated_at = NOW()
    WHERE conversation_id = NEW.conversation_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for buffer count tracking
DROP TRIGGER IF EXISTS track_buffer_pending_count ON user_memory_buffer;
CREATE TRIGGER track_buffer_pending_count
  AFTER INSERT OR UPDATE ON user_memory_buffer
  FOR EACH ROW
  EXECUTE FUNCTION update_buffer_pending_count();

-- ============================================================================
-- 7. Documentation
-- ============================================================================
COMMENT ON TABLE user_memory_buffer IS 'Short-term buffer for memory observations awaiting context validation';
COMMENT ON TABLE conversation_activity IS 'Tracks conversation activity for intelligent buffer processing';
COMMENT ON COLUMN user_memory_buffer.turns_observed IS 'Number of conversation turns this observation has been tracked';
COMMENT ON COLUMN user_memory_buffer.status IS 'pending: awaiting validation, confirmed: ready for commit, contradicted: discard, superseded: replaced by better observation, merged: combined with another';
COMMENT ON COLUMN conversation_activity.buffer_processing_scheduled IS 'Flag to prevent duplicate processing triggers';
