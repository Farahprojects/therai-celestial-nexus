-- Create folder_ai_messages table for storing AI conversation history per folder
CREATE TABLE IF NOT EXISTS public.folder_ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID NOT NULL REFERENCES public.chat_folders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_folder_ai_messages_folder_id 
  ON public.folder_ai_messages(folder_id);

CREATE INDEX IF NOT EXISTS idx_folder_ai_messages_user_id 
  ON public.folder_ai_messages(user_id);

CREATE INDEX IF NOT EXISTS idx_folder_ai_messages_created_at 
  ON public.folder_ai_messages(created_at DESC);

-- Combined index for common queries (folder + created_at)
CREATE INDEX IF NOT EXISTS idx_folder_ai_messages_folder_created 
  ON public.folder_ai_messages(folder_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.folder_ai_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only read messages from folders they own
CREATE POLICY "Users can read their folder AI messages"
  ON public.folder_ai_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_folders
      WHERE chat_folders.id = folder_ai_messages.folder_id
      AND chat_folders.user_id = auth.uid()
    )
  );

-- RLS Policy: Users can insert messages to folders they own
CREATE POLICY "Users can insert AI messages to their folders"
  ON public.folder_ai_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_folders
      WHERE chat_folders.id = folder_ai_messages.folder_id
      AND chat_folders.user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

-- RLS Policy: Service role can manage all messages (for edge functions)
CREATE POLICY "Service role can manage all folder AI messages"
  ON public.folder_ai_messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policy: Users can delete their own folder AI messages
CREATE POLICY "Users can delete their folder AI messages"
  ON public.folder_ai_messages
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_folders
      WHERE chat_folders.id = folder_ai_messages.folder_id
      AND chat_folders.user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

