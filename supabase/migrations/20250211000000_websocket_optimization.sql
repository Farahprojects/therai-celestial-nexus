-- WebSocket Optimization Migration
-- Disables postgres_changes realtime for messages table
-- We now use broadcast events from edge functions instead
-- This reduces RLS evaluation overhead on every INSERT/UPDATE

-- Note: This migration is OPTIONAL and can be applied after testing
-- The new unified channel system works with or without this change

-- Disable realtime publication for messages table
-- Messages will now be delivered via broadcast events from chat-send edge function
DO $$ 
BEGIN
  -- Only drop if table exists in publication
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE messages;
  END IF;
END $$;
-- Keep realtime for conversations if you want to re-enable it later
-- For now, conversation updates are handled via broadcast as well
-- Uncomment the block below to also disable conversations realtime:
/*
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE conversations;
  END IF;
END $$;
*/

-- Add comment for future reference
COMMENT ON TABLE messages IS 'Messages table - realtime disabled, using broadcast events via unified channel for WebSocket optimization';
-- This migration is safe to rollback - just re-add the tables to publication:
-- To rollback: ALTER PUBLICATION supabase_realtime ADD TABLE messages;;
