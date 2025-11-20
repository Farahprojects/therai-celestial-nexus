-- Remove duplicate index on folder_ai_messages.folder_id
-- Both idx_folder_ai_messages_folder_fk and idx_folder_ai_messages_folder_id index the same column
-- The idx_folder_ai_messages_folder_fk was auto-created by PostgreSQL from the foreign key constraint
-- Keep the explicitly created index: idx_folder_ai_messages_folder_id

DROP INDEX IF EXISTS public.idx_folder_ai_messages_folder_fk;

-- Add comment explaining the cleanup
COMMENT ON INDEX public.idx_folder_ai_messages_folder_id IS 
  'Index on folder_id for folder_ai_messages queries. Replaces duplicate idx_folder_ai_messages_folder_fk index (auto-created from FK constraint).';

