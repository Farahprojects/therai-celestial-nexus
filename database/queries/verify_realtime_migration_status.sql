-- Verify Realtime Migration Status
-- Run this to check if messages and conversations are still in realtime publication

-- ============================================================================
-- CHECK 1: What tables are currently in supabase_realtime publication?
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  pubname
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- ============================================================================
-- CHECK 2: Specifically check messages and conversations
-- ============================================================================
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
        AND tablename = 'messages'
    ) THEN '❌ MESSAGES STILL IN REALTIME - Migration not applied'
    ELSE '✅ MESSAGES REMOVED FROM REALTIME - Migration applied'
  END as messages_status,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
        AND tablename = 'conversations'
    ) THEN '❌ CONVERSATIONS STILL IN REALTIME - Migration not applied'
    ELSE '✅ CONVERSATIONS REMOVED FROM REALTIME - Migration applied'
  END as conversations_status;

-- ============================================================================
-- CHECK 3: Verify conversations broadcast trigger exists
-- ============================================================================
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_trigger 
      WHERE tgname = 'conversations_broadcast_trigger'
    ) THEN '✅ CONVERSATIONS BROADCAST TRIGGER EXISTS'
    ELSE '❌ CONVERSATIONS BROADCAST TRIGGER MISSING - Run migration'
  END as trigger_status;

-- ============================================================================
-- CHECK 4: Verify RLS policy for folder conversations exists
-- ============================================================================
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'messages' 
        AND schemaname = 'realtime'
        AND policyname = 'folder_members_can_receive'
    ) THEN '✅ FOLDER CONVERSATIONS RLS POLICY EXISTS'
    ELSE '❌ FOLDER CONVERSATIONS RLS POLICY MISSING - Run migration'
  END as rls_policy_status;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- If messages/conversations are still in realtime publication:
--   1. Run: supabase/migrations/20250211000000_websocket_optimization.sql
--   2. Run: supabase/migrations/20251120000006_conversations_broadcast_trigger.sql
--   3. Re-run this script to verify



