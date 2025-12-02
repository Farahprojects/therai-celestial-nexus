-- Quick Fix: Remove messages and conversations from realtime publication
-- This should reduce realtime.list_changes from 97% to <10%

-- ============================================================================
-- STEP 1: Check current status
-- ============================================================================
SELECT 
  '📊 CURRENT STATUS' as step,
  tablename,
  CASE tablename
    WHEN 'messages' THEN '❌ SHOULD BE REMOVED'
    WHEN 'conversations' THEN '❌ SHOULD BE REMOVED'
    ELSE 'OK'
  END as status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('messages', 'conversations')
ORDER BY tablename;

-- ============================================================================
-- STEP 2: Remove messages from realtime publication
-- ============================================================================
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE messages;
    RAISE NOTICE '✅ Removed messages from realtime publication';
  ELSE
    RAISE NOTICE '✅ Messages already removed from realtime publication';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Remove conversations from realtime publication
-- ============================================================================
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE conversations;
    RAISE NOTICE '✅ Removed conversations from realtime publication';
  ELSE
    RAISE NOTICE '✅ Conversations already removed from realtime publication';
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Verify final status
-- ============================================================================
SELECT 
  '✅ VERIFICATION' as step,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ SUCCESS: Both tables removed from realtime'
    ELSE '❌ WARNING: Some tables still in realtime'
  END as result,
  COUNT(*) as remaining_tables,
  STRING_AGG(tablename, ', ') as tables_still_in_realtime
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('messages', 'conversations');

-- ============================================================================
-- STEP 5: Remove insights from realtime publication (migrated to polling)
-- ============================================================================
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'insights'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE insights;
    RAISE NOTICE '✅ Removed insights from realtime publication (using polling now)';
  ELSE
    RAISE NOTICE '✅ Insights already removed from realtime publication';
  END IF;
END $$;

-- ============================================================================
-- STEP 6: Final verification - should be empty or only low-traffic tables
-- ============================================================================
SELECT 
  '✅ FINAL STATUS' as step,
  COUNT(*) as total_tables_in_realtime,
  STRING_AGG(tablename, ', ' ORDER BY tablename) as remaining_tables
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';

-- ============================================================================
-- STEP 7: Show all tables in realtime (for reference)
-- ============================================================================
SELECT 
  '📋 ALL TABLES IN REALTIME' as step,
  tablename,
  CASE tablename
    WHEN 'messages' THEN '❌ Should be removed'
    WHEN 'conversations' THEN '❌ Should be removed'
    WHEN 'insights' THEN '❌ Should be removed (using polling)'
    ELSE '✅ OK (low traffic)'
  END as status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

