-- Check if the folder actually has is_public = true
-- Replace 'YOUR_FOLDER_ID' with the actual folder ID that's failing

-- First, let's see all public folders
SELECT 
  id,
  name,
  is_public,
  user_id,
  created_at,
  updated_at
FROM public.chat_folders
WHERE is_public = true
ORDER BY updated_at DESC;

-- Check conversations RLS policy for public access
-- THIS IS LIKELY THE ISSUE - check if it references share_mode
SELECT 
  policyname,
  tablename,
  cmd,
  roles,
  qual AS using_clause
FROM pg_policies
WHERE tablename = 'conversations'
  AND policyname = 'public_sel';
  
-- Also check if there are any other policies on conversations that might interfere
SELECT 
  policyname,
  cmd,
  roles,
  qual AS using_clause
FROM pg_policies
WHERE tablename = 'conversations'
ORDER BY policyname;

-- Check how many conversations are in public folders
SELECT 
  COUNT(*) as total_public_folders,
  COUNT(DISTINCT c.id) as conversations_in_public_folders
FROM public.chat_folders cf
LEFT JOIN public.conversations c ON c.folder_id = cf.id
WHERE cf.is_public = true;

-- Test: Can we actually query a public folder as an unauthenticated user?
-- This will show if RLS is blocking the folder itself
SELECT id, name, is_public 
FROM public.chat_folders 
WHERE is_public = true 
LIMIT 1;

