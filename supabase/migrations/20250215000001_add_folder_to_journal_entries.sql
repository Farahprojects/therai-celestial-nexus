-- Add folder_id to journal_entries table
-- This links journal entries to specific folders

-- Add folder_id column
ALTER TABLE public.journal_entries 
ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.chat_folders(id) ON DELETE CASCADE;

-- Add index for faster folder lookups
CREATE INDEX IF NOT EXISTS idx_journal_entries_folder_id ON public.journal_entries(folder_id);

-- Update RLS policies to allow folder-based access
-- Users can view journal entries in their own folders
DROP POLICY IF EXISTS "Users can view journal entries in their folders" ON public.journal_entries;
CREATE POLICY "Users can view journal entries in their folders"
  ON public.journal_entries
  FOR SELECT
  USING (
    client_id = auth.uid() OR 
    coach_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.chat_folders cf
      WHERE cf.id = journal_entries.folder_id
      AND cf.user_id = auth.uid()
    )
  );

-- Users can insert journal entries into their own folders
DROP POLICY IF EXISTS "Users can insert journal entries into their folders" ON public.journal_entries;
CREATE POLICY "Users can insert journal entries into their folders"
  ON public.journal_entries
  FOR INSERT
  WITH CHECK (
    client_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.chat_folders cf
      WHERE cf.id = journal_entries.folder_id
      AND cf.user_id = auth.uid()
    )
  );

-- Users can update their own journal entries
DROP POLICY IF EXISTS "Users can update their own journal entries" ON public.journal_entries;
CREATE POLICY "Users can update their own journal entries"
  ON public.journal_entries
  FOR UPDATE
  USING (
    client_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.chat_folders cf
      WHERE cf.id = journal_entries.folder_id
      AND cf.user_id = auth.uid()
    )
  );

-- Users can delete their own journal entries
DROP POLICY IF EXISTS "Users can delete their own journal entries" ON public.journal_entries;
CREATE POLICY "Users can delete their own journal entries"
  ON public.journal_entries
  FOR DELETE
  USING (
    client_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.chat_folders cf
      WHERE cf.id = journal_entries.folder_id
      AND cf.user_id = auth.uid()
    )
  );

-- Add comment for documentation
COMMENT ON COLUMN public.journal_entries.folder_id IS 'Optional link to folder for organizing journal entries';

