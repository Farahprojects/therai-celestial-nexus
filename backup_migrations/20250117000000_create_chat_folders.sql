-- Create chat_folders table
CREATE TABLE IF NOT EXISTS public.chat_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chat_folders_name_length CHECK (char_length(name) > 0 AND char_length(name) <= 100)
);

-- Add folder_id to conversations table
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.chat_folders(id) ON DELETE SET NULL;

-- Create index for faster folder lookups
CREATE INDEX IF NOT EXISTS idx_chat_folders_user_id ON public.chat_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_folder_id ON public.conversations(folder_id);

-- Enable RLS on chat_folders
ALTER TABLE public.chat_folders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_folders
-- Users can only see their own folders
CREATE POLICY "Users can view their own folders"
  ON public.chat_folders
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own folders
CREATE POLICY "Users can create their own folders"
  ON public.chat_folders
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own folders
CREATE POLICY "Users can update their own folders"
  ON public.chat_folders
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own folders
CREATE POLICY "Users can delete their own folders"
  ON public.chat_folders
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_chat_folders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER chat_folders_updated_at
  BEFORE UPDATE ON public.chat_folders
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_folders_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_folders TO authenticated;

