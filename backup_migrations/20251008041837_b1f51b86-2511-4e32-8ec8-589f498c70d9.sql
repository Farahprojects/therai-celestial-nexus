-- Clean up orphaned messages and add CASCADE DELETE

-- Step 1: Find and delete orphaned messages (messages without conversations)
DELETE FROM messages
WHERE chat_id NOT IN (SELECT id FROM conversations);

-- Step 2: Drop existing foreign key if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'messages_chat_id_fkey' 
    AND table_name = 'messages'
  ) THEN
    ALTER TABLE messages DROP CONSTRAINT messages_chat_id_fkey;
  END IF;
END $$;

-- Step 3: Add foreign key with CASCADE DELETE
-- This ensures when a conversation is deleted, all its messages are automatically deleted
ALTER TABLE messages
ADD CONSTRAINT messages_chat_id_fkey 
FOREIGN KEY (chat_id) 
REFERENCES conversations(id) 
ON DELETE CASCADE;

-- Step 4: Update the messages DELETE RLS policy to allow service role
DROP POLICY IF EXISTS "Service role can delete messages" ON messages;
CREATE POLICY "Service role can delete messages"
ON messages
FOR DELETE
TO service_role
USING (true);