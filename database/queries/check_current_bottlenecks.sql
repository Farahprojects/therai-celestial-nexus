-- 1. Check if conversations.user_id has an index
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'conversations'
  AND indexdef LIKE '%user_id%';

-- 2. Check current RLS policies on messages (see which are still active)
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages';

-- 3. Check if realtime is properly configured for messages
SELECT
    oid::regclass AS table_name,
    relreplident
FROM pg_class
WHERE oid = 'public.messages'::regclass;

-- 4. Check for any triggers on messages table
SELECT
    tgname,
    pg_get_triggerdef(oid)
FROM pg_trigger
WHERE tgrelid = 'public.messages'::regclass
  AND tgisinternal = false;

-- 5. Check if conversations_participants table has proper indexes
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'conversations_participants';



