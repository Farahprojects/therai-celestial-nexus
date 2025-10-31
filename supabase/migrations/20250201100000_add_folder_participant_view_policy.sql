-- Add policy for participants to view their folders (non-public private folders)
-- NOTE: This policy adds recursion risk with chat_folder_participants lookup
-- but is necessary to allow participants to view private shared folders

CREATE POLICY "Participants can view their folders"
ON public.chat_folders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM chat_folder_participants
    WHERE folder_id = chat_folders.id
    AND user_id = auth.uid()
  )
);
