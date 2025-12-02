-- Enable realtime for report_logs table
-- Run this in your Supabase SQL editor

-- Enable realtime on report_logs table
ALTER PUBLICATION supabase_realtime ADD TABLE public.report_logs;

-- Set replica identity for realtime functionality
ALTER TABLE public.report_logs REPLICA IDENTITY FULL;

-- Verify realtime is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'report_logs';
