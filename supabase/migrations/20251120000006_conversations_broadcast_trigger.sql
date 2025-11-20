-- Phase 2: Conversations Migration to Broadcast
-- Replaces postgres_changes subscriptions with database trigger broadcasts
-- This eliminates 3 subscriptions per folder view

-- ============================================================================
-- STEP 1: Ensure indexes exist for performance
-- ============================================================================

-- Index on conversations.folder_id (for joins and filters)
CREATE INDEX IF NOT EXISTS idx_conversations_folder_id ON public.conversations(folder_id);

-- Index on chat_folder_participants for RLS checks
CREATE INDEX IF NOT EXISTS idx_chat_folder_participants_user_folder 
  ON public.chat_folder_participants(user_id, folder_id);

-- ============================================================================
-- STEP 2: Create trigger function to broadcast per-folder changes
-- ============================================================================

CREATE OR REPLACE FUNCTION public.conversations_broadcast_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_folder_id uuid;
BEGIN
  -- Get folder_id from NEW (INSERT/UPDATE) or OLD (DELETE)
  target_folder_id := COALESCE(NEW.folder_id, OLD.folder_id);
  
  -- Only broadcast if conversation has a folder_id
  IF target_folder_id IS NOT NULL THEN
    -- Broadcast to per-folder private channel
    PERFORM realtime.broadcast_changes(
      'folder:' || target_folder_id::text || ':conversations',
      TG_OP,                -- event name: INSERT / UPDATE / DELETE
      TG_OP,                -- same as above (kept for compatibility)
      TG_TABLE_NAME,        -- table name: 'conversations'
      TG_TABLE_SCHEMA,      -- schema name: 'public'
      NEW,                  -- new row (NULL for DELETE)
      OLD                   -- old row (NULL for INSERT)
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================================================
-- STEP 3: Create trigger on conversations table
-- ============================================================================

DROP TRIGGER IF EXISTS conversations_broadcast_trigger ON public.conversations;

CREATE TRIGGER conversations_broadcast_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.conversations_broadcast_trigger();

-- ============================================================================
-- STEP 4: RLS on realtime.messages for private folder channels
-- ============================================================================

-- Allow authenticated users to receive messages for folders they are members of
-- This includes:
-- 1. Folder owners (via chat_folders.user_id)
-- 2. Folder participants (via chat_folder_participants)
-- 3. Public folders (via chat_folders.is_public)

DROP POLICY IF EXISTS "folder_members_can_receive" ON realtime.messages;

CREATE POLICY "folder_members_can_receive"
ON realtime.messages
FOR SELECT TO authenticated
USING (
  topic LIKE 'folder:%:conversations'
  AND (
    -- User owns the folder
    EXISTS (
      SELECT 1
      FROM public.chat_folders cf
      WHERE cf.id = (SPLIT_PART(topic, ':', 2))::uuid
        AND cf.user_id = auth.uid()
    )
    OR
    -- User is a participant in the folder
    EXISTS (
      SELECT 1
      FROM public.chat_folder_participants cfp
      WHERE cfp.folder_id = (SPLIT_PART(topic, ':', 2))::uuid
        AND cfp.user_id = auth.uid()
    )
    OR
    -- Folder is public
    EXISTS (
      SELECT 1
      FROM public.chat_folders cf
      WHERE cf.id = (SPLIT_PART(topic, ':', 2))::uuid
        AND cf.is_public = true
    )
  )
);

-- Restrict INSERT on realtime.messages to service role only
-- Triggers run as SECURITY DEFINER and bypass RLS for INSERT
REVOKE ALL ON TABLE realtime.messages FROM anon, authenticated;
GRANT SELECT ON TABLE realtime.messages TO authenticated; -- receiving allowed via policy above

-- ============================================================================
-- STEP 5: Remove conversations from realtime publication
-- ============================================================================
-- This prevents postgres_changes subscriptions from working
-- All updates now go through the broadcast trigger above

DO $$ 
BEGIN
  -- Only drop if table exists in publication
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE conversations;
  END IF;
END $$;

-- ============================================================================
-- STEP 6: Add comment for documentation
-- ============================================================================

COMMENT ON FUNCTION public.conversations_broadcast_trigger() IS 
'Broadcasts conversation changes to per-folder private channels (folder:{folder_id}:conversations). 
Replaces postgres_changes subscriptions to reduce database load.';

COMMENT ON TRIGGER conversations_broadcast_trigger ON public.conversations IS 
'Triggers broadcast events for conversation INSERT/UPDATE/DELETE to folder-specific channels.';

