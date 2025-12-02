-- Check if realtime is properly configured for messages (replica identity)
SELECT
    oid::regclass AS table_name,
    relreplident,
    CASE relreplident
        WHEN 'd' THEN 'default (primary key)'
        WHEN 'n' THEN 'nothing'
        WHEN 'f' THEN 'full (all columns)'
        WHEN 'i' THEN 'index'
    END AS replica_identity
FROM pg_class
WHERE oid = 'public.messages'::regclass;



