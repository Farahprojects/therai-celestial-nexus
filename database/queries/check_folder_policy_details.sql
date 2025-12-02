-- Get the actual USING clause for the "Public can view public folders" policy
-- This will show exactly what the policy is checking

SELECT 
  policyname,
  tablename,
  cmd,
  roles,
  qual AS using_clause
FROM pg_policies
WHERE tablename = 'chat_folders'
  AND policyname = 'Public can view public folders';

-- Also check the authenticated users policy
SELECT 
  policyname,
  tablename,
  cmd,
  roles,
  qual AS using_clause
FROM pg_policies
WHERE tablename = 'chat_folders'
  AND policyname = 'Users can view folders';

-- Check if there are any other policies on chat_folders that might interfere
SELECT 
  policyname,
  cmd,
  roles,
  qual AS using_clause
FROM pg_policies
WHERE tablename = 'chat_folders'
ORDER BY policyname;

