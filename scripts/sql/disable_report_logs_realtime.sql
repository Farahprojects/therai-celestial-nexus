-- Disable realtime broadcast on report_logs table
-- Run this in your Supabase SQL editor

-- Remove report_logs from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.report_logs;

-- Verify realtime is disabled (should return no rows)
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'report_logs';

-- Check what tables are still in realtime publication
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';
