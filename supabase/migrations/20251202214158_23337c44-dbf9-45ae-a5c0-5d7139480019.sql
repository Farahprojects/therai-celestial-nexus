-- Drop triggers that write to cascade_deletion_log
DROP TRIGGER IF EXISTS log_message_deletions ON public.messages;

-- Drop functions that write to cascade_deletion_log
DROP FUNCTION IF EXISTS public.log_message_cascade_deletion();
DROP FUNCTION IF EXISTS public.log_summary_cascade_deletion();

-- Drop the cascade_deletion_log table
DROP TABLE IF EXISTS public.cascade_deletion_log;