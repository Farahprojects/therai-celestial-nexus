-- Check if messages table realtime migration was applied
-- Run this in Supabase SQL Editor to validate current state

-- 1. Check if messages table is in realtime publication
SELECT 
  schemaname, 
  tablename, 
  pubname,
  CASE 
    WHEN tablename = 'messages' THEN '❌ MIGRATION NOT APPLIED - messages still in realtime'
    ELSE '✅ OK'
  END as status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
  AND tablename = 'messages';

-- 2. List all tables currently in realtime publication
SELECT 
  schemaname,
  tablename,
  CASE 
    WHEN tablename IN ('messages', 'conversations', 'folder_documents', 'insights') 
    THEN '⚠️  Using postgres_changes - consider migrating to broadcast'
    ELSE '✅ OK'
  END as migration_status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- 3. Count active realtime subscriptions (if accessible)
-- Note: This requires pg_stat_statements or similar monitoring
SELECT 
  COUNT(*) as active_subscriptions_estimate
FROM pg_stat_activity 
WHERE state = 'active' 
  AND query LIKE '%realtime%';

-- Expected result:
-- If migration was applied: No rows for messages table
-- If migration NOT applied: 1 row showing messages table in publication



