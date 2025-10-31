-- Update folder RLS to use invite-only (participants) instead of public access
-- Remove public folder access, use participants instead

-- Drop the public folder access policy
DROP POLICY IF EXISTS "Public can view shared folders" ON public.chat_folders;

-- Update authenticated users policy to allow viewing:
-- 1. Their own folders
-- 2. Folders where they are a participant (is_public = true means shared via invite link)
DROP POLICY IF EXISTS "Users can view their own folders" ON public.chat_folders;

CREATE POLICY "Users can view their own folders"
ON public.chat_folders
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  -- OR folder is shared (is_public = true) AND user is a participant
  OR (
    is_public = true 
    AND EXISTS (
      SELECT 1
      FROM public.chat_folder_participants
      WHERE chat_folder_participants.folder_id = chat_folders.id
      AND chat_folder_participants.user_id = auth.uid()
    )
  )
);

-- Keep the update policy for owners to manage sharing
DROP POLICY IF EXISTS "Owners can update folder sharing" ON public.chat_folders;

CREATE POLICY "Owners can update folder sharing"
ON public.chat_folders
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Function to automatically add owner as participant when folder is shared
CREATE OR REPLACE FUNCTION public.handle_shared_folder_participant()
RETURNS TRIGGER AS $$
BEGIN
  -- When folder becomes shared (is_public = true), ensure owner is a participant
  IF NEW.is_public = true AND (OLD.is_public IS NULL OR OLD.is_public = false) THEN
    -- Insert owner as participant if not already there
    INSERT INTO public.chat_folder_participants (folder_id, user_id, role, invited_by)
    VALUES (NEW.id, NEW.user_id, 'owner', NEW.user_id)
    ON CONFLICT (folder_id, user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-add owner as participant when sharing
DROP TRIGGER IF EXISTS trg_handle_shared_folder ON public.chat_folders;
CREATE TRIGGER trg_handle_shared_folder
  AFTER INSERT OR UPDATE OF is_public ON public.chat_folders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_shared_folder_participant();

