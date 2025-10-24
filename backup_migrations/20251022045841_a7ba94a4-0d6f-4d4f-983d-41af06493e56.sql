-- Fix cascade deletion for messages and conversations to prevent data bloat
-- CRITICAL: This migration addresses orphaned data issues

-- 1. Add missing foreign key constraint: messages.chat_id -> conversations.id with CASCADE
-- First, clean up any orphaned messages that don't have a valid conversation
DELETE FROM public.messages 
WHERE chat_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM public.conversations WHERE id = messages.chat_id);

-- Add the cascade constraint
ALTER TABLE public.messages 
  DROP CONSTRAINT IF EXISTS messages_chat_id_fkey;

ALTER TABLE public.messages 
  ADD CONSTRAINT messages_chat_id_fkey 
  FOREIGN KEY (chat_id) 
  REFERENCES public.conversations(id) 
  ON DELETE CASCADE;

-- 2. Add cascade constraint for message_block_summaries -> conversations
-- Clean up orphaned summaries first
DELETE FROM public.message_block_summaries 
WHERE chat_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM public.conversations WHERE id = message_block_summaries.chat_id);

ALTER TABLE public.message_block_summaries 
  DROP CONSTRAINT IF EXISTS message_block_summaries_chat_id_fkey;

ALTER TABLE public.message_block_summaries 
  ADD CONSTRAINT message_block_summaries_chat_id_fkey 
  FOREIGN KEY (chat_id) 
  REFERENCES public.conversations(id) 
  ON DELETE CASCADE;

-- 3. Fix conversations.owner_user_id to SET NULL instead of NO ACTION
-- This allows user deletion without blocking on conversation ownership
ALTER TABLE public.conversations 
  DROP CONSTRAINT IF EXISTS conversations_owner_user_id_fkey;

ALTER TABLE public.conversations 
  ADD CONSTRAINT conversations_owner_user_id_fkey 
  FOREIGN KEY (owner_user_id) 
  REFERENCES auth.users(id) 
  ON DELETE SET NULL;

-- 4. Fix conversations_participants.invited_by to SET NULL instead of NO ACTION
ALTER TABLE public.conversations_participants 
  DROP CONSTRAINT IF EXISTS conversations_participants_invited_by_fkey;

ALTER TABLE public.conversations_participants 
  ADD CONSTRAINT conversations_participants_invited_by_fkey 
  FOREIGN KEY (invited_by) 
  REFERENCES auth.users(id) 
  ON DELETE SET NULL;

-- 5. Create trigger to log cascade deletions for monitoring
CREATE TABLE IF NOT EXISTS public.cascade_deletion_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  parent_table text NOT NULL,
  parent_id uuid NOT NULL,
  deleted_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cascade_deletion_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_manage_cascade_log" 
ON public.cascade_deletion_log 
USING (auth.role() = 'service_role');

-- 6. Create function to log message deletions
CREATE OR REPLACE FUNCTION log_message_cascade_deletion()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.cascade_deletion_log (table_name, record_id, parent_table, parent_id)
  VALUES ('messages', OLD.id, 'conversations', OLD.chat_id);
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for message deletions
DROP TRIGGER IF EXISTS log_message_deletions ON public.messages;
CREATE TRIGGER log_message_deletions
  BEFORE DELETE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION log_message_cascade_deletion();

-- 7. Create function to log summary deletions
CREATE OR REPLACE FUNCTION log_summary_cascade_deletion()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.cascade_deletion_log (table_name, record_id, parent_table, parent_id)
  VALUES ('message_block_summaries', OLD.id, 'conversations', OLD.chat_id);
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for summary deletions
DROP TRIGGER IF EXISTS log_summary_deletions ON public.message_block_summaries;
CREATE TRIGGER log_summary_deletions
  BEFORE DELETE ON public.message_block_summaries
  FOR EACH ROW
  EXECUTE FUNCTION log_summary_cascade_deletion();

-- 8. Create maintenance function to identify orphaned data (should return 0 after this migration)
CREATE OR REPLACE FUNCTION check_orphaned_data()
RETURNS TABLE(
  table_name text,
  orphaned_count bigint,
  total_size_estimate text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'messages'::text,
    COUNT(*)::bigint,
    pg_size_pretty(COUNT(*) * 1024)::text -- Rough estimate: 1KB per message
  FROM public.messages m
  WHERE NOT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = m.chat_id)
  
  UNION ALL
  
  SELECT 
    'message_block_summaries'::text,
    COUNT(*)::bigint,
    pg_size_pretty(COUNT(*) * 512)::text -- Rough estimate: 512 bytes per summary
  FROM public.message_block_summaries mbs
  WHERE NOT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = mbs.chat_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify the fix worked
SELECT * FROM check_orphaned_data();