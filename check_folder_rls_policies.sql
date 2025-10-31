-- Check the actual RLS policy definitions for folders
-- Run this in Supabase SQL Editor to see what the policies are actually checking

SELECT 
  policyname,
  tablename,
  cmd,
  roles,
  qual AS using_clause,
  with_check
FROM pg_policies
WHERE tablename IN ('chat_folders', 'chat_folder_participants')
ORDER BY tablename, policyname;

-- Also check if share_mode column exists and its values for public folders
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'chat_folders' 
      AND column_name = 'share_mode'
    ) THEN 'share_mode column EXISTS'
    ELSE 'share_mode column DOES NOT EXIST'
  END AS share_mode_status;

-- Show public folders and their current state
SELECT 
  id,
  name,
  is_public,
  user_id,
  CASE 
    WHEN is_public = true
    THEN '✅ PUBLIC'
    WHEN is_public = false
    THEN '🔒 PRIVATE'
    ELSE '❓ UNKNOWN STATE'
  END AS status
FROM public.chat_folders
WHERE is_public = true
ORDER BY updated_at DESC
LIMIT 10;

