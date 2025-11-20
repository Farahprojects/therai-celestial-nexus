-- Remove duplicate index on conversation_summaries
-- Both idx_conversation_summaries_latest and idx_summaries_chat_created index the same columns
-- Both index: (chat_id, created_at DESC)
-- Keep the clearer named index: idx_conversation_summaries_latest (created in optimize_hot_queries.sql)
-- Drop the older index: idx_summaries_chat_created (created in add_context_caching.sql)

DROP INDEX IF EXISTS public.idx_summaries_chat_created;

-- Add comment explaining the cleanup
COMMENT ON INDEX public.idx_conversation_summaries_latest IS 
  'Index on (chat_id, created_at DESC) for fetching latest summaries per conversation. Replaces duplicate idx_summaries_chat_created index.';

