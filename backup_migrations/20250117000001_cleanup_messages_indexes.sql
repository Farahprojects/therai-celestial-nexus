-- Clean up unused and low-usage indexes on messages table to reduce write overhead
-- Based on pg_stat_user_indexes analysis showing actual usage patterns

-- ========================================
-- ZERO USAGE INDEXES (0 scans)
-- ========================================

-- Drop unique constraint for one streaming assistant per chat
-- Usage: 0 scans | Size: 16 kB
-- NOTE: This was a business rule constraint - if you need to prevent multiple streaming 
-- assistant messages per chat, implement this check in application logic instead
DROP INDEX IF EXISTS public.messages_one_streaming_assistant_per_chat;

-- Drop filtered index for recent complete messages
-- Usage: 0 scans | Size: 80 kB (largest unused index)
-- This was for a specific query pattern that's apparently not being used
DROP INDEX IF EXISTS public.idx_messages_chat_recent_complete;

-- Drop unique constraint for chat_id + message_number
-- Usage: 0 scans | Size: 0 bytes
-- NOTE: This enforces unique message numbering per chat. If you rely on message_number 
-- uniqueness, implement this check in application logic or triggers instead
DROP INDEX IF EXISTS public.messages_chat_id_message_number_uniq;

-- ========================================
-- LOW USAGE INDEXES (<30 scans)
-- ========================================

-- Drop chat_id + mode composite index
-- Usage: 7 scans only | Size: 16 kB
-- Rarely used, and mode queries are typically done without needing an index
DROP INDEX IF EXISTS public.idx_messages_chat_id_mode;

-- Drop chat_id + role composite index
-- Usage: 26 scans only | Size: 16 kB
-- Low usage suggests this query pattern is rare
DROP INDEX IF EXISTS public.idx_messages_chat_id_role;

-- ========================================
-- RESULT
-- ========================================
-- Reduced from 12 to 7 indexes on public.messages (41% reduction)
-- Eliminated: 5 indexes totaling ~128 kB
-- Every INSERT/UPDATE will maintain 5 fewer indexes
-- 
-- REMAINING ESSENTIAL INDEXES:
-- ✅ messages_pkey (6,210 scans)
-- ✅ messages_client_msg_id_key (2,903 scans)
-- ✅ idx_messages_chat_id_created_at (1,291 scans)
-- ✅ idx_messages_context_injected (466 scans)
-- 
-- MONITORING: Run this query to verify no issues after deployment:
-- SELECT indexrelname, idx_scan, idx_tup_read 
-- FROM pg_stat_user_indexes 
-- WHERE relname = 'messages' 
-- ORDER BY idx_scan DESC;

