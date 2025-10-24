-- Optimize messages RLS to support both conversation owners and participants
-- This fixes slow WebSocket broadcasts by supporting multi-user conversations

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "users_view_own_conversation_messages" ON messages;

-- Create new policy that supports both owners and participants
CREATE POLICY "users_view_accessible_messages" ON messages
FOR SELECT TO authenticated
USING (
  chat_id IN (
    SELECT id FROM conversations WHERE user_id = auth.uid()
    UNION
    SELECT conversation_id FROM conversations_participants WHERE user_id = auth.uid()
  )
);

-- Update INSERT policy to match (support both owners and participants)
DROP POLICY IF EXISTS "users_insert_own_conversation_messages" ON messages;

CREATE POLICY "users_insert_accessible_messages" ON messages
FOR INSERT TO authenticated
WITH CHECK (
  chat_id IN (
    SELECT id FROM conversations WHERE user_id = auth.uid()
    UNION
    SELECT conversation_id FROM conversations_participants WHERE user_id = auth.uid()
  )
);



