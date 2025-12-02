-- Show current active RLS policies on messages table
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'messages'
ORDER BY policyname;



