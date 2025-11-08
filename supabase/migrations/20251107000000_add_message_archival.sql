-- Message archival system for managing database growth
-- Soft-deletes old messages from inactive conversations
-- Keeps last 100 messages per conversation hot for better performance

-- 1. Add archived_at column to messages table (if not exists)
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- 2. Create index on archived_at for archival queries
CREATE INDEX IF NOT EXISTS idx_messages_archived 
ON messages(archived_at) 
WHERE archived_at IS NOT NULL;

-- 3. Create function to archive old messages
CREATE OR REPLACE FUNCTION archive_old_messages()
RETURNS TABLE(
  archived_count INTEGER,
  conversation_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_archived_count INTEGER := 0;
  v_conversation_count INTEGER := 0;
  v_cutoff_date TIMESTAMPTZ;
BEGIN
  -- Archive messages older than 6 months in inactive conversations
  v_cutoff_date := NOW() - INTERVAL '6 months';
  
  -- Mark messages for archival (soft delete)
  WITH inactive_conversations AS (
    -- Find conversations with no recent activity
    SELECT DISTINCT c.id
    FROM conversations c
    LEFT JOIN messages m ON c.id = m.chat_id
    WHERE c.created_at < v_cutoff_date
      AND c.id NOT IN (
        SELECT chat_id
        FROM messages
        WHERE created_at > v_cutoff_date
      )
  ),
  messages_to_archive AS (
    -- For each inactive conversation, keep last 100 messages
    SELECT m.id
    FROM messages m
    INNER JOIN inactive_conversations ic ON m.chat_id = ic.id
    WHERE m.archived_at IS NULL
      AND m.id NOT IN (
        SELECT id
        FROM (
          SELECT id,
            ROW_NUMBER() OVER (PARTITION BY chat_id ORDER BY created_at DESC) as rn
          FROM messages
          WHERE chat_id IN (SELECT id FROM inactive_conversations)
        ) ranked
        WHERE rn <= 100
      )
  )
  UPDATE messages
  SET archived_at = NOW()
  WHERE id IN (SELECT id FROM messages_to_archive);
  
  GET DIAGNOSTICS v_archived_count = ROW_COUNT;
  
  -- Count affected conversations
  SELECT COUNT(DISTINCT chat_id)
  INTO v_conversation_count
  FROM messages
  WHERE archived_at >= NOW() - INTERVAL '1 hour';
  
  RAISE NOTICE 'Archived % messages from % conversations', v_archived_count, v_conversation_count;
  
  RETURN QUERY SELECT v_archived_count, v_conversation_count;
END;
$$;

-- 4. Create function to permanently delete archived messages (optional, run manually)
CREATE OR REPLACE FUNCTION hard_delete_archived_messages(months_old INTEGER DEFAULT 12)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER := 0;
BEGIN
  -- Permanently delete messages archived more than X months ago
  DELETE FROM messages
  WHERE archived_at < NOW() - (months_old || ' months')::INTERVAL;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RAISE NOTICE 'Permanently deleted % archived messages older than % months', v_deleted_count, months_old;
  
  RETURN v_deleted_count;
END;
$$;

-- 5. Schedule monthly archival job using pg_cron
DO $ARCHIVE$
BEGIN
  -- Schedule archival on the 1st of each month at 4 AM
  PERFORM cron.schedule(
    'archive-old-messages',
    '0 4 1 * *',
    $$SELECT * FROM archive_old_messages();$$
  );
  
  RAISE NOTICE 'Scheduled monthly message archival cron job';
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'pg_cron extension not available, archival function created but not scheduled';
  WHEN OTHERS THEN
    RAISE WARNING 'Error scheduling cron job: %', SQLERRM;
END;
$ARCHIVE$;

-- 6. Create view to monitor archival statistics
CREATE OR REPLACE VIEW message_archival_stats AS
SELECT 
  COUNT(*) FILTER (WHERE archived_at IS NOT NULL) as archived_messages,
  COUNT(*) FILTER (WHERE archived_at IS NULL) as active_messages,
  COUNT(DISTINCT chat_id) FILTER (WHERE archived_at IS NOT NULL) as conversations_with_archived,
  MIN(archived_at) as oldest_archive_date,
  MAX(archived_at) as latest_archive_date
FROM messages;

-- Comments
COMMENT ON FUNCTION archive_old_messages() IS 'Archives messages older than 6 months from inactive conversations, keeping last 100 messages per conversation';
COMMENT ON FUNCTION hard_delete_archived_messages(INTEGER) IS 'Permanently deletes archived messages older than specified months (default 12). Run manually only when needed.';
COMMENT ON VIEW message_archival_stats IS 'Statistics on message archival for monitoring database growth';

-- Usage examples:
-- Manual run: SELECT * FROM archive_old_messages();
-- Check stats: SELECT * FROM message_archival_stats;
-- Hard delete (careful!): SELECT hard_delete_archived_messages(12);

