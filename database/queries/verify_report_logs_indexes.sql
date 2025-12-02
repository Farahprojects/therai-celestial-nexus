-- Verify report_logs table indexes
-- Run this in your Supabase SQL editor to check current indexes

-- Check all indexes on report_logs table
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename = 'report_logs'
ORDER BY indexname;

-- Check index usage statistics (if any)
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE tablename = 'report_logs'
ORDER BY idx_scan DESC;
