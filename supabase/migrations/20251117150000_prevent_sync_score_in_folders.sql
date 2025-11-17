-- Migration: Prevent sync_score conversations from being associated with folders
-- sync_score conversations can only be created from the UI left panel (meme button)
-- They should never be part of the folder organization system

-- Add a check constraint to ensure sync_score conversations cannot have a folder_id
ALTER TABLE conversations 
ADD CONSTRAINT sync_score_no_folder_check 
CHECK (
  (mode = 'sync_score' AND folder_id IS NULL) 
  OR 
  mode != 'sync_score'
);

-- Add a comment explaining this constraint
COMMENT ON CONSTRAINT sync_score_no_folder_check ON conversations IS 
'Ensures sync_score conversations cannot be associated with folders. sync_score is only created from the meme button in the left panel.';

