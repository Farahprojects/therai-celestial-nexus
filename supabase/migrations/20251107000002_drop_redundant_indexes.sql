-- Drop redundant indexes that are covered by primary keys, unique constraints, or more specific partial indexes
-- These indexes were identified as unused or redundant after query performance analysis
-- Executed manually on 2025-11-07, persisted here for migration record

-- 1. Drop redundant index on conversations.id (covered by primary key)
DROP INDEX IF EXISTS public.idx_conversations_id;
-- 2. Drop redundant index on profiles.email (covered by unique constraint)
DROP INDEX IF EXISTS public.idx_profiles_email;
-- 3. Drop redundant message indexes - keeping only the most specific partial indexes
-- Drop ASC version (keep DESC for most recent messages)
DROP INDEX IF EXISTS public.idx_messages_chat_id_created_at;
-- Drop general DESC version (keep partial indexes for specific queries)
DROP INDEX IF EXISTS public.idx_messages_chat_created_desc;
-- Drop the partial index that's less specific (keep idx_messages_history_optimized)
DROP INDEX IF EXISTS public.idx_messages_chat_created_desc_no_system;
-- 4. Drop composite index where first column is primary key (redundant)
DROP INDEX IF EXISTS public.idx_conv_id_user;
-- Comments:
-- These indexes were consuming storage and maintenance overhead without providing query benefits
-- Primary keys and unique constraints already provide index coverage
-- More specific partial indexes (e.g., idx_messages_history_optimized) cover the actual query patterns
-- Frontend performance confirmed snappy after removal;
