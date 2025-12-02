-- Simple query to list all indexes on messages table
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'messages' 
  AND schemaname = 'public'
ORDER BY indexname;

