-- Add is_ready boolean column to insights table
-- Run this in your Supabase SQL editor

-- Add the is_ready column with default value false
ALTER TABLE public.insights 
ADD COLUMN is_ready BOOLEAN DEFAULT FALSE;

-- Create an index for better performance when filtering by is_ready
CREATE INDEX IF NOT EXISTS idx_insights_is_ready ON public.insights(is_ready);

-- Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'insights' 
AND column_name = 'is_ready';
