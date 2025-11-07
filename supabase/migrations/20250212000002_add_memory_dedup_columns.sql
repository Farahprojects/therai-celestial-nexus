-- Add columns and indexes for improved memory deduplication
-- Supports canonical hash-based deduplication and metadata storage

-- Add canonical_hash column for fast exact duplicate detection
ALTER TABLE user_memory 
ADD COLUMN IF NOT EXISTS canonical_hash TEXT;

-- Add memory_metadata JSONB column for storing extraction metadata
ALTER TABLE user_memory 
ADD COLUMN IF NOT EXISTS memory_metadata JSONB DEFAULT '{}';

-- Clean up duplicate source_message_id values before creating unique index
-- Keep the most recent memory (or highest reference_count if tied) for each source_message_id
DELETE FROM user_memory
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY source_message_id 
        ORDER BY 
          created_at DESC NULLS LAST,
          reference_count DESC NULLS LAST,
          id DESC
      ) as rn
    FROM user_memory
    WHERE source_message_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- Create unique partial index for idempotency (one memory per source message)
CREATE UNIQUE INDEX IF NOT EXISTS ux_user_memory_source_message 
ON user_memory(source_message_id) 
WHERE source_message_id IS NOT NULL;

-- Create index on canonical_hash for fast hash-based deduplication
CREATE INDEX IF NOT EXISTS ix_user_memory_canonical_hash 
ON user_memory(canonical_hash) 
WHERE canonical_hash IS NOT NULL;

-- Composite index for hash-based dedup queries (user + profile + hash)
CREATE INDEX IF NOT EXISTS ix_user_memory_user_profile_hash 
ON user_memory(user_id, profile_id, canonical_hash, is_active) 
WHERE is_active = true AND canonical_hash IS NOT NULL;

-- Comments
COMMENT ON COLUMN user_memory.canonical_hash IS 'SHA-256 hash of canonicalized memory text for fast duplicate detection';
COMMENT ON COLUMN user_memory.memory_metadata IS 'JSONB metadata: time_horizon, value_score, rationale, extractor info';

