-- Check if conversations.user_id has an index
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'conversations'
ORDER BY indexname;



