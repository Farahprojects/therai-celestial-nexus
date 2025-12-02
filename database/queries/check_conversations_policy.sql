-- Check the conversations public_sel policy - THIS IS LIKELY THE ISSUE
SELECT 
  policyname,
  tablename,
  cmd,
  roles,
  qual AS using_clause
FROM pg_policies
WHERE tablename = 'conversations'
  AND policyname = 'public_sel';

