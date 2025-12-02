-- Cleanup report_logs indexes for realtime broadcasting
-- Keep only essential indexes

-- Drop potentially unnecessary indexes
DROP INDEX IF EXISTS idx_report_logs_client_id;
DROP INDEX IF EXISTS idx_report_logs_api_key;

-- Keep these essential indexes:
-- report_logs_pkey (primary key - cannot drop)
-- idx_report_logs_created_at (for time-based queries)
-- idx_report_logs_user_id (for user-specific realtime subscriptions)

-- Verify final index state
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename = 'report_logs'
ORDER BY indexname;
