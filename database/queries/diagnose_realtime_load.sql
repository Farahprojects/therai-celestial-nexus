-- Comprehensive Realtime Load Diagnosis
-- Run this to identify what's causing realtime.list_changes to take 97% of DB time

-- ============================================================================
-- CHECK 1: All tables currently in supabase_realtime publication
-- ============================================================================
-- This shows EVERY table that can trigger postgres_changes
SELECT 
  '📊 ALL TABLES IN REALTIME PUBLICATION' as check_name,
  schemaname,
  tablename,
  pubname
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- ============================================================================
-- CHECK 2: Specifically check messages and conversations status
-- ============================================================================
SELECT 
  '🔍 MESSAGES & CONVERSATIONS STATUS' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
        AND tablename = 'messages'
    ) THEN '❌ MESSAGES STILL IN REALTIME'
    ELSE '✅ MESSAGES REMOVED FROM REALTIME'
  END as messages_status,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
        AND tablename = 'conversations'
    ) THEN '❌ CONVERSATIONS STILL IN REALTIME'
    ELSE '✅ CONVERSATIONS REMOVED FROM REALTIME'
  END as conversations_status;

-- ============================================================================
-- CHECK 3: Check for other high-traffic tables that might be in realtime
-- ============================================================================
-- Common tables that could cause high load if still in realtime
SELECT 
  '⚠️ HIGH-TRAFFIC TABLES CHECK' as check_name,
  tablename,
  CASE tablename
    WHEN 'messages' THEN 'HIGH TRAFFIC - Should be removed'
    WHEN 'conversations' THEN 'HIGH TRAFFIC - Should be removed'
    WHEN 'insights' THEN 'MEDIUM TRAFFIC - Check if needed'
    WHEN 'chat_folders' THEN 'LOW TRAFFIC - Usually OK'
    WHEN 'profiles' THEN 'LOW TRAFFIC - Usually OK'
    ELSE 'UNKNOWN - Review if needed'
  END as traffic_level
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('messages', 'conversations', 'insights', 'chat_folders', 'profiles', 'user_memory', 'translator_logs')
ORDER BY tablename;

-- ============================================================================
-- CHECK 4: Check for active realtime subscriptions (if accessible)
-- ============================================================================
-- Note: This may not be accessible depending on permissions
-- But it's worth checking if you have access to realtime schema
SELECT 
  '🔌 ACTIVE SUBSCRIPTIONS CHECK' as check_name,
  COUNT(*) as subscription_count,
  COUNT(DISTINCT entity) as unique_entities
FROM realtime.subscription
WHERE state = 'active'
GROUP BY state;

-- ============================================================================
-- CHECK 5: Verify broadcast triggers exist
-- ============================================================================
SELECT 
  '⚙️ BROADCAST TRIGGERS' as check_name,
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  CASE 
    WHEN tgname = 'conversations_broadcast_trigger' THEN '✅ Conversations broadcast'
    ELSE 'Other trigger'
  END as trigger_type
FROM pg_trigger
WHERE tgname LIKE '%broadcast%'
  AND NOT tgisinternal;

-- ============================================================================
-- CHECK 6: Check for any other tables that might have triggers
-- ============================================================================
SELECT 
  '🔧 ALL BROADCAST-RELATED TRIGGERS' as check_name,
  tgname as trigger_name,
  tgrelid::regclass as table_name
FROM pg_trigger
WHERE tgname LIKE '%broadcast%' OR tgname LIKE '%realtime%'
  AND NOT tgisinternal
ORDER BY tgrelid::regclass, tgname;

-- ============================================================================
-- CHECK 7: Count total tables in realtime publication
-- ============================================================================
SELECT 
  '📈 SUMMARY' as check_name,
  COUNT(*) as total_tables_in_realtime,
  COUNT(CASE WHEN tablename = 'messages' THEN 1 END) as messages_count,
  COUNT(CASE WHEN tablename = 'conversations' THEN 1 END) as conversations_count,
  COUNT(CASE WHEN tablename IN ('messages', 'conversations') THEN 1 END) as critical_tables_count
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';

-- ============================================================================
-- RECOMMENDATIONS
-- ============================================================================
-- If messages or conversations are still in the list above:
--   1. Run: supabase/migrations/20250211000000_websocket_optimization.sql
--   2. Run: supabase/migrations/20251120000006_conversations_broadcast_trigger.sql
--
-- If other high-traffic tables are in realtime:
--   - Consider migrating them to broadcast as well
--   - Or remove them from realtime if not needed
--
-- If you see many active subscriptions:
--   - Check browser DevTools Network tab for WebSocket connections
--   - Look for duplicate subscriptions or subscriptions that aren't cleaned up



