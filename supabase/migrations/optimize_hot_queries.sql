-- Database Optimization: Composite Indexes for Hot Query Paths
-- Impact: Significantly faster queries for conversation lists, message history, and feature usage lookups
-- Run this on production during low-traffic period

-- 1. Conversations: user_id + mode + created_at (for conversation list queries)
-- Speeds up: Fetching conversations by user and mode with date ordering
CREATE INDEX IF NOT EXISTS idx_conversations_user_mode_created 
ON conversations(user_id, mode, created_at DESC);

-- 2. Messages: Optimize history queries with status and role filters
-- Speeds up: Message history fetches in LLM handlers with status='complete' and role filtering
-- Covers: chat_id + created_at + role + status queries
CREATE INDEX IF NOT EXISTS idx_messages_history_optimized 
ON messages(chat_id, created_at DESC, role, status) 
WHERE status = 'complete' AND role != 'system';

-- 3. Messages: Optimize system message lookups
-- Speeds up: Fetching the latest system message for a conversation
CREATE INDEX IF NOT EXISTS idx_messages_system_lookup
ON messages(chat_id, created_at DESC)
WHERE role = 'system' AND status = 'complete';

-- 4. Feature usage: user_id + feature_key + period (hot lookup for rate limiting)
-- Speeds up: Feature usage checks in featureGating/featureLimits
CREATE INDEX IF NOT EXISTS idx_feature_usage_user_key_period 
ON feature_usage(user_id, feature_key, period_start DESC);

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
ANALYZE messages;
ANALYZE feature_usage;
ANALYZE user_memory;
ANALYZE conversation_caches;
ANALYZE conversation_summaries;

-- Query to verify index creation
-- Run this after migration to confirm:
-- SELECT schemaname, tablename, indexname, indexdef 
-- FROM pg_indexes 
-- WHERE indexname LIKE 'idx_%_optimized' OR indexname LIKE 'idx_%_user_%'
-- ORDER BY tablename, indexname;

