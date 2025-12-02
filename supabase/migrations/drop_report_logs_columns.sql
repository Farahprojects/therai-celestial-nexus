-- Drop unnecessary columns from report_logs table
-- Run this in your Supabase SQL editor

-- Drop the columns
ALTER TABLE public.report_logs 
DROP COLUMN IF EXISTS api_key;

ALTER TABLE public.report_logs 
DROP COLUMN IF EXISTS client_id;

-- Verify columns were dropped
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'report_logs'
ORDER BY ordinal_position;
