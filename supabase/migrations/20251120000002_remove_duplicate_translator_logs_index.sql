-- Remove duplicate index on translator_logs.chat_id
-- Both idx_translator_logs_chat_id and translator_logs_user_id_idx index the same column
-- The translator_logs_user_id_idx name is misleading (suggests user_id but actually indexes chat_id)
-- Keep the clearer named index: idx_translator_logs_chat_id

DROP INDEX IF EXISTS public.translator_logs_user_id_idx;

-- Add comment explaining the cleanup
COMMENT ON INDEX public.idx_translator_logs_chat_id IS 
  'Index on chat_id for translator_logs queries. Replaces duplicate translator_logs_user_id_idx index.';

