-- Add is_public column to chat_folders for sharing
ALTER TABLE public.chat_folders
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
-- Create index for faster public folder lookups
CREATE INDEX IF NOT EXISTS idx_chat_folders_is_public ON public.chat_folders(is_public) WHERE is_public = true;
-- Update RLS policies to allow public access to shared folders
-- Public users can view shared folders
CREATE POLICY "Public can view shared folders"
  ON public.chat_folders
  FOR SELECT
  TO public
  USING (is_public = true);
-- Authenticated users can view their own folders OR public folders
DROP POLICY IF EXISTS "Users can view their own folders" ON public.chat_folders;
CREATE POLICY "Users can view their own folders"
  ON public.chat_folders
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id 
    OR is_public = true
  );
-- Only folder owner can update sharing status
CREATE POLICY "Owners can update folder sharing"
  ON public.chat_folders
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
