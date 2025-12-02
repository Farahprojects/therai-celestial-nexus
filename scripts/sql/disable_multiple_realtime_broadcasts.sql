-- Disable realtime broadcasts on multiple tables
-- Run this in your Supabase SQL editor

-- Remove report_logs from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.report_logs;

-- Remove temp_audio from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.temp_audio;

-- Remove user_preferences from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.user_preferences;

-- Verify realtime is disabled for these tables (should return no rows)
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('report_logs', 'temp_audio', 'user_preferences');

-- Check what tables are still in realtime publication
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
