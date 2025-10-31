-- Create folder_participants table for invite-only folder sharing
-- Similar to conversations_participants

CREATE TABLE IF NOT EXISTS public.chat_folder_participants (
  folder_id uuid NOT NULL REFERENCES public.chat_folders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  invited_by uuid REFERENCES auth.users(id),
  
  PRIMARY KEY (folder_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_folder_participants_user_id ON public.chat_folder_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_folder_participants_folder_id ON public.chat_folder_participants(folder_id);

-- Enable RLS
ALTER TABLE public.chat_folder_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_folder_participants
-- Users can view participants (non-recursive, similar to conversations_participants)
-- Note: Actual folder access is controlled by chat_folders RLS, not here
CREATE POLICY "Users can view folder participants"
ON public.chat_folder_participants
FOR SELECT
TO authenticated
USING (true);

-- Users can join folders (insert their own row)
CREATE POLICY "Users can join folders"
ON public.chat_folder_participants
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can leave folders (delete their own row)
CREATE POLICY "Users can leave folders"
ON public.chat_folder_participants
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Owners can manage participants (update/delete any row in their folders)
CREATE POLICY "Owners can manage folder participants"
ON public.chat_folder_participants
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.chat_folders
    WHERE chat_folders.id = chat_folder_participants.folder_id
    AND chat_folders.user_id = auth.uid()
  )
);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_folder_participants TO authenticated;

