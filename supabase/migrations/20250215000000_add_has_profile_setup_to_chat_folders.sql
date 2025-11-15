-- Add has_profile_setup column to chat_folders

ALTER TABLE chat_folders
ADD COLUMN has_profile_setup BOOLEAN DEFAULT FALSE;

-- Set to true for folders that already have a profile
UPDATE chat_folders
SET has_profile_setup = TRUE
WHERE profile_id IS NOT NULL;

