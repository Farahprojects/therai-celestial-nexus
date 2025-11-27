-- Monitoring queries for realtime performance
-- Run these periodically to track realtime.list_changes performance
-- Set up alerts for thresholds: >1s 95p or >200 concurrent channels

-- 1. Check realtime.list_changes latency (requires pg_stat_statements)
-- Note: This may require enabling pg_stat_statements extension
SELECT 
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time,
  (total_exec_time / calls) as avg_ms,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY mean_exec_time) as p95_ms
FROM pg_stat_statements
WHERE query LIKE '%realtime.list_changes%'
  OR query LIKE '%realtime%'
GROUP BY query, calls, total_exec_time, mean_exec_time, max_exec_time
ORDER BY total_exec_time DESC
LIMIT 10;

-- 2. Count active realtime channels/subscriptions
-- This is an estimate based on active connections
SELECT 
  COUNT(DISTINCT pid) as estimated_active_channels,
  COUNT(*) as total_realtime_queries
FROM pg_stat_activity
WHERE state = 'active'
  AND (
    query LIKE '%realtime%'
    OR application_name LIKE '%realtime%'
  );

-- 3. Check for long-running realtime queries (>1 second)
SELECT 
  pid,
  now() - query_start as duration,
  state,
  query
FROM pg_stat_activity
WHERE (
    query LIKE '%realtime%'
    OR application_name LIKE '%realtime%'
  )
  AND state = 'active'
  AND now() - query_start > interval '1 second'
ORDER BY duration DESC;

-- 4. Monitor realtime publication status
SELECT 
  schemaname,
  tablename,
  pubname
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- 5. Alert thresholds (run this query and check results)
-- Alert if:
-- - p95 latency > 1000ms (1 second)
-- - Active channels > 200
-- - Long-running queries > 1 second

-- Example alert query:
SELECT 
  CASE 
    WHEN (SELECT COUNT(*) FROM pg_stat_activity 
          WHERE state = 'active' AND query LIKE '%realtime%') > 200 
    THEN '⚠️ ALERT: More than 200 active realtime connections'
    ELSE '✅ OK: Connection count within limits'
  END as connection_alert,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_stat_activity
      WHERE state = 'active' 
        AND query LIKE '%realtime%'
        AND now() - query_start > interval '1 second'
    )
    THEN '⚠️ ALERT: Long-running realtime queries detected'
    ELSE '✅ OK: No long-running queries'
  END as latency_alert;



