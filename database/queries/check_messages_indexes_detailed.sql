-- Check all indexes on messages table with full details
-- This will show index definitions, sizes, and usage stats

SELECT 
    indexname,
    indexdef,
    pg_size_pretty(pg_relation_size(schemaname||'.'||indexname)) as index_size,
    idx_scan as times_used,
    idx_tup_read as rows_read,
    idx_tup_fetch as rows_fetched
FROM pg_indexes
LEFT JOIN pg_stat_user_indexes ON pg_indexes.indexname = pg_stat_user_indexes.indexrelname
WHERE pg_indexes.schemaname = 'public' 
  AND pg_indexes.tablename = 'messages'
ORDER BY indexname;

-- Specifically check for indexes that could help with history query:
-- Query pattern: chat_id = X AND role != 'system' AND status = 'complete' AND text IS NOT NULL AND text != ''
-- ORDER BY created_at DESC LIMIT 6

SELECT 
    '=== ANALYSIS: Can these indexes help the history query? ===' as info;

SELECT 
    indexname,
    indexdef,
    CASE 
        WHEN indexdef ILIKE '%chat_id%' AND indexdef ILIKE '%created_at%' THEN '✅ Could help - has chat_id + created_at'
        WHEN indexdef ILIKE '%chat_id%' AND indexdef ILIKE '%status%' THEN '⚠️  Partial help - has chat_id + status'
        WHEN indexdef ILIKE '%chat_id%' AND indexdef ILIKE '%role%' THEN '⚠️  Partial help - has chat_id + role'
        WHEN indexdef ILIKE '%chat_id%' THEN '⚠️  Minimal help - has chat_id only'
        ELSE '❌ No help'
    END as usefulness
FROM pg_indexes
WHERE schemaname = 'public' 
  AND tablename = 'messages'
ORDER BY usefulness DESC, indexname;

