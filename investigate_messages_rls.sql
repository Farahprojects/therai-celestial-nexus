-- ============================================
-- MESSAGES RLS SECURITY INVESTIGATION
-- ============================================

-- 1. Show current RLS policies on messages table
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
ORDER BY policyname;

-- 2. Show messages table structure
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'messages'
ORDER BY ordinal_position;

-- 3. Show conversations table structure (for comparison)
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'conversations'
ORDER BY ordinal_position;

-- 4. Show current conversations RLS policies
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'conversations'
ORDER BY policyname;

-- 5. Test the vulnerability: Show a sample of messages and their conversation ownership
-- This will help understand if messages can be accessed without proper conversation ownership
SELECT
    m.id as message_id,
    m.chat_id,
    m.user_id as message_user_id,
    c.user_id as conversation_user_id,
    c.owner_user_id as conversation_owner_user_id,
    c.is_public,
    c.folder_id
FROM messages m
LEFT JOIN conversations c ON m.chat_id = c.id
LIMIT 10;

-- 6. Check if there are any messages where the message user doesn't match conversation ownership
-- This could indicate data integrity issues or potential security problems
SELECT
    COUNT(*) as potentially_problematic_messages
FROM messages m
LEFT JOIN conversations c ON m.chat_id = c.id
WHERE c.id IS NULL  -- Messages with no corresponding conversation
   OR (m.user_id != c.user_id AND m.user_id != c.owner_user_id AND c.is_public = false);

-- 7. Show folder participants and sharing structure
SELECT
    fp.folder_id,
    fp.user_id as participant_user_id,
    cf.user_id as folder_owner_id,
    cf.is_public as folder_is_public
FROM chat_folder_participants fp
JOIN chat_folders cf ON fp.folder_id = cf.id
LIMIT 10;
