-- Drop existing insight-related tables that might be causing conflicts

-- Drop insight_entries table (if exists)
DROP TABLE IF EXISTS public.insight_entries CASCADE;

-- Drop insight_prompts table (if exists)  
DROP TABLE IF EXISTS public.insight_prompts CASCADE;

-- Also check for and drop any existing insights table to start fresh
DROP TABLE IF EXISTS public.insights CASCADE;

-- Verify tables are dropped
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('insights', 'insight_entries', 'insight_prompts');
