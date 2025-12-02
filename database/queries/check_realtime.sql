-- Check if messages table has realtime enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'messages';

-- Check realtime publication status
SELECT schemaname, tablename, pubname, puballtables, pubinsert, pubupdate, pubdelete
FROM pg_publication_tables 
WHERE tablename = 'messages';

-- Check if realtime extension is installed
SELECT * FROM pg_extension WHERE extname = 'supabase_realtime';

-- Check realtime publication exists
SELECT * FROM pg_publication WHERE pubname = 'supabase_realtime';
