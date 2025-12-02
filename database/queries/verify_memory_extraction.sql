-- Verification Script for Memory Extraction Fix
-- Run this to check if the fix is working

-- 1. Check if recent conversations have profile_id set
SELECT 
  'Recent Conversations' as check_type,
  COUNT(*) as total_conversations,
  COUNT(profile_id) as conversations_with_profile_id,
  ROUND(100.0 * COUNT(profile_id) / NULLIF(COUNT(*), 0), 2) as percentage_with_profile
FROM conversations
WHERE created_at > NOW() - INTERVAL '24 hours';

-- 2. Show recent conversations with their profile linkage
SELECT 
  c.id as conversation_id,
  c.title,
  c.mode,
  c.profile_id,
  c.user_id,
  c.created_at,
  CASE 
    WHEN c.profile_id IS NULL THEN '❌ NO PROFILE'
    ELSE '✅ HAS PROFILE'
  END as status
FROM conversations c
WHERE c.created_at > NOW() - INTERVAL '24 hours'
ORDER BY c.created_at DESC
LIMIT 20;

-- 3. Check if memories are being extracted
SELECT 
  'Memory Extraction Status' as check_type,
  COUNT(*) as total_memories_extracted,
  COUNT(DISTINCT conversation_id) as unique_conversations_with_memories,
  COUNT(DISTINCT profile_id) as unique_profiles
FROM user_memory
WHERE created_at > NOW() - INTERVAL '24 hours';

-- 4. Show recent memories with their linkage
SELECT 
  um.id as memory_id,
  um.memory_text,
  um.memory_type,
  um.confidence_score,
  um.profile_id,
  um.conversation_id,
  um.created_at,
  c.title as conversation_title,
  c.mode as conversation_mode
FROM user_memory um
JOIN conversations c ON c.id = um.conversation_id
WHERE um.created_at > NOW() - INTERVAL '24 hours'
ORDER BY um.created_at DESC
LIMIT 10;

-- 5. Check for conversations WITHOUT profile_id (should be minimal or zero after fix)
SELECT 
  'Conversations Missing Profile' as check_type,
  COUNT(*) as count_without_profile_id,
  ARRAY_AGG(DISTINCT mode) as modes_affected
FROM conversations
WHERE profile_id IS NULL 
  AND created_at > NOW() - INTERVAL '24 hours'
  AND mode != 'profile'; -- profile mode conversations may not need profile_id

-- 6. Check user_profile_list to ensure primary profiles exist
SELECT 
  'Primary Profiles' as check_type,
  COUNT(*) as total_profiles,
  COUNT(CASE WHEN is_primary THEN 1 END) as primary_profiles,
  COUNT(DISTINCT user_id) as unique_users
FROM user_profile_list;

-- 7. Find users without a primary profile (potential issue)
SELECT 
  'Users Without Primary Profile' as check_type,
  COUNT(DISTINCT p.id) as users_without_primary
FROM profiles p
LEFT JOIN user_profile_list upl ON upl.user_id = p.id AND upl.is_primary = true
WHERE upl.id IS NULL;

