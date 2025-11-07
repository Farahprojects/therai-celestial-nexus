-- Database Optimization: Composite Indexes for Hot Query Paths
-- Impact: Significantly faster queries for conversation lists and memory lookups
-- Run this on production during low-traffic period
-- 
-- NOTE: Some indexes already exist (messages, feature_usage) - those are skipped
-- This migration only adds NEW indexes that don't already exist

-- 1. Conversations: user_id + mode + created_at (for conversation list queries)
-- Speeds up: Fetching conversations by user and mode with date ordering
CREATE INDEX IF NOT EXISTS idx_conversations_user_mode_created 
ON conversations(user_id, mode, created_at DESC);

-- 2. SKIPPED - idx_messages_history_optimized already exists
-- 3. SKIPPED - idx_messages_system_optimized already exists  
-- 4. SKIPPED - idx_feature_usage_user_period already exists

-- 5. User memory: Optimize memory injection queries
-- Speeds up: Fetching active memories for a user+profile with reference count ordering
CREATE INDEX IF NOT EXISTS idx_user_memory_profile_active
ON user_memory(user_id, profile_id, reference_count DESC, created_at DESC)
WHERE is_active = true;

-- 6. Conversation caches: chat_id lookup for cache hit checks
-- Speeds up: Cache lookups in Gemini handler
CREATE INDEX IF NOT EXISTS idx_conversation_caches_chat_id
ON conversation_caches(chat_id, expires_at);

-- 7. Conversation summaries: Latest summary lookup
-- Speeds up: Fetching most recent summary for a conversation
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_latest
ON conversation_summaries(chat_id, created_at DESC);

-- Analyze tables to update query planner statistics
ANALYZE conversations;
ANALYZE user_memory;
ANALYZE conversation_caches;
ANALYZE conversation_summaries;

-- Query to verify new index creation
-- Run this after migration to confirm:
-- SELECT schemaname, tablename, indexname, indexdef 
-- FROM pg_indexes 
-- WHERE indexname IN (
--   'idx_conversations_user_mode_created',
--   'idx_user_memory_profile_active', 
--   'idx_conversation_caches_chat_id',
--   'idx_conversation_summaries_latest'
-- )
-- ORDER BY tablename, indexname;

