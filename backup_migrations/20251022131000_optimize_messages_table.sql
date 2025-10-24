-- Optimize messages table for faster WebSocket broadcasts
-- Removes unused columns that slow down replication and increase payload size

-- Drop unused columns
ALTER TABLE public.messages 
DROP COLUMN IF EXISTS reply_to_id,
DROP COLUMN IF EXISTS model,
DROP COLUMN IF EXISTS token_count,
DROP COLUMN IF EXISTS latency_ms,
DROP COLUMN IF EXISTS error,
DROP COLUMN IF EXISTS updated_at;

-- Drop the unused trigger (since we removed updated_at)
DROP TRIGGER IF EXISTS set_messages_updated_at ON public.messages;

-- Keep meta for now (used occasionally for context injection metadata)
-- Can be dropped later if proven unnecessary

-- Verify final column list
COMMENT ON TABLE public.messages IS 'Optimized messages table - removed unused columns for faster broadcasts';

