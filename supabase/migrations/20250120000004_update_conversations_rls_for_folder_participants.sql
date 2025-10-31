-- Update conversations RLS to allow folder participants to view conversations in shared folders
-- This allows users who are participants in a shared folder to see conversations in that folder

-- Update the authenticated SELECT policy for conversations
DROP POLICY IF EXISTS "usr_sel" ON public.conversations;

CREATE POLICY "usr_sel"
  ON public.conversations
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()                    -- Owner (main column)
    OR owner_user_id = auth.uid()           -- Owner (legacy column)
    OR is_public = true                     -- Public conversations
    OR EXISTS (                             -- Participant in conversation
      SELECT 1 FROM conversations_participants 
      WHERE conversation_id = id AND user_id = auth.uid()
      LIMIT 1
    )
    OR EXISTS (                             -- Participant in folder containing conversation
      SELECT 1
      FROM public.chat_folder_participants
      JOIN public.chat_folders ON chat_folders.id = chat_folder_participants.folder_id
      WHERE chat_folders.id = conversations.folder_id
      AND chat_folder_participants.user_id = auth.uid()
      AND chat_folders.is_public = true
    )
  );

