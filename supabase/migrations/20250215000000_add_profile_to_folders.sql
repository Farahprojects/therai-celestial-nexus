-- Add profile_id to chat_folders table
-- This links each folder to an optional user profile for astro-related activities

-- Add profile_id column
ALTER TABLE public.chat_folders 
ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.user_profile_list(id) ON DELETE SET NULL;

-- Add index for faster profile lookups
CREATE INDEX IF NOT EXISTS idx_chat_folders_profile_id ON public.chat_folders(profile_id);

-- Add comment for documentation
COMMENT ON COLUMN public.chat_folders.profile_id IS 'Optional link to user profile for astro-related activities in this folder';

