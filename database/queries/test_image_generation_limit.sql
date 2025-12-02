-- ============================================
-- TEST IMAGE GENERATION LIMIT LOGIC
-- Run these queries in Supabase SQL Editor
-- ============================================

-- 1. Check current image generation count for a user (last 24 hours)
-- Replace 'USER_ID_HERE' with actual user ID
SELECT 
  COUNT(*) as image_count,
  MIN(created_at) as oldest_in_window,
  MAX(created_at) as newest_in_window,
  NOW() - MAX(created_at) as time_since_last
FROM image_generation_log
WHERE user_id = 'USER_ID_HERE'::uuid
  AND created_at >= NOW() - INTERVAL '24 hours';

-- 2. Check if limit logic works correctly (should return count < 3 if under limit)
SELECT 
  COUNT(*) >= 3 as limit_exceeded,
  COUNT(*) as current_count,
  3 as limit
FROM image_generation_log
WHERE user_id = 'USER_ID_HERE'::uuid
  AND created_at >= NOW() - INTERVAL '24 hours';

-- 3. View all image generations for a user (last 24 hours) with details
SELECT 
  id,
  chat_id,
  image_url,
  model,
  created_at,
  NOW() - created_at as age
FROM image_generation_log
WHERE user_id = 'USER_ID_HERE'::uuid
  AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- 4. Test 24-hour window calculation
-- This simulates what the edge function does
SELECT 
  COUNT(*) as count_last_24h,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as count_in_window
FROM image_generation_log
WHERE user_id = 'USER_ID_HERE'::uuid;

-- 5. Check for any orphaned logs (should be 0 - logs persist even if chat deleted)
SELECT 
  COUNT(*) as orphaned_logs,
  COUNT(DISTINCT chat_id) as unique_chats_referenced
FROM image_generation_log
WHERE chat_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM conversations WHERE id = image_generation_log.chat_id
  );

-- 6. Verify RLS policies are correct (should only see own logs)
-- Run as authenticated user to test RLS
SELECT COUNT(*) as visible_logs
FROM image_generation_log;

-- 7. Test edge case: exactly 24 hours ago (should be included)
SELECT 
  COUNT(*) as count_at_exactly_24h
FROM image_generation_log
WHERE user_id = 'USER_ID_HERE'::uuid
  AND created_at >= NOW() - INTERVAL '24 hours'
  AND created_at < NOW() - INTERVAL '23 hours 59 minutes';

-- 8. Summary: Current status for all users (last 24 hours)
SELECT 
  user_id,
  COUNT(*) as image_count,
  COUNT(*) >= 3 as at_limit,
  MAX(created_at) as last_generation
FROM image_generation_log
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY user_id
ORDER BY image_count DESC;

