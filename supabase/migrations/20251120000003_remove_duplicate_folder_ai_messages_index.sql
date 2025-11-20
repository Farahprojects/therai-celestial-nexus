-- Remove duplicate index on folder_ai_messages.user_id
-- Both idx_folder_ai_messages_user_fk and idx_folder_ai_messages_user_id index the same column
-- The idx_folder_ai_messages_user_fk was auto-created by PostgreSQL from the foreign key constraint
-- Keep the explicitly created index: idx_folder_ai_messages_user_id

DROP INDEX IF EXISTS public.idx_folder_ai_messages_user_fk;

-- Add comment explaining the cleanup
COMMENT ON INDEX public.idx_folder_ai_messages_user_id IS 
  'Index on user_id for folder_ai_messages queries. Replaces duplicate idx_folder_ai_messages_user_fk index (auto-created from FK constraint).';

