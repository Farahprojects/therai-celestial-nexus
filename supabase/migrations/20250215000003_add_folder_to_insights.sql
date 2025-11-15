-- Add folder_id to insights table
-- This links insights to specific folders

-- Add folder_id column
ALTER TABLE public.insights 
ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.chat_folders(id) ON DELETE CASCADE;

-- Add index for faster folder lookups
CREATE INDEX IF NOT EXISTS idx_insights_folder_id ON public.insights(folder_id);

-- Update RLS policies to allow folder-based access
-- Users can view insights in their own folders
DROP POLICY IF EXISTS "Users can view insights in their folders" ON public.insights;
CREATE POLICY "Users can view insights in their folders"
  ON public.insights
  FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.chat_folders cf
      WHERE cf.id = insights.folder_id
      AND cf.user_id = auth.uid()
    )
  );

-- Add comment for documentation
COMMENT ON COLUMN public.insights.folder_id IS 'Optional link to folder for organizing insights';

