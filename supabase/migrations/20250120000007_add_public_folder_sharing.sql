-- Add share_mode column to distinguish between private (invite-only) and public (no sign-in) sharing
-- private = invite-only, requires sign-in (uses participants)
-- public = anyone can view without sign-in

ALTER TABLE public.chat_folders
ADD COLUMN IF NOT EXISTS share_mode TEXT DEFAULT 'private' 
  CHECK (share_mode IN ('private', 'public'));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_chat_folders_share_mode ON public.chat_folders(share_mode) 
  WHERE is_public = true AND share_mode = 'public';

-- Update RLS to allow unauthenticated users to view truly public folders
-- Add policy for public (no sign-in required) folders
CREATE POLICY "Public can view public folders"
  ON public.chat_folders
  FOR SELECT
  TO public  -- unauthenticated users
  USING (
    is_public = true 
    AND share_mode = 'public'
  );

-- Update authenticated users policy to also see public folders
-- (already covered by existing policy that checks is_public = true, but let's be explicit)
DROP POLICY IF EXISTS "Users can view their own folders" ON public.chat_folders;

CREATE POLICY "Users can view their own folders"
ON public.chat_folders
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR is_public = true  -- Can see any shared folder (both private and public)
);

-- Update conversations RLS to allow public viewing of conversations in public folders
DROP POLICY IF EXISTS "public_sel" ON public.conversations;

CREATE POLICY "public_sel"
  ON public.conversations
  AS PERMISSIVE
  FOR SELECT
  TO public  -- unauthenticated users
  USING (
    is_public = true 
    OR EXISTS (
      -- Allow viewing conversations in truly public folders
      SELECT 1 
      FROM public.chat_folders 
      WHERE chat_folders.id = conversations.folder_id 
      AND chat_folders.is_public = true
      AND chat_folders.share_mode = 'public'
    )
  );

-- Update trigger to only add owner as participant for private folders
CREATE OR REPLACE FUNCTION public.handle_shared_folder_participant()
RETURNS TRIGGER AS $$
BEGIN
  -- When folder becomes shared (is_public = true), ensure owner is a participant
  -- But only for private folders (public folders don't need participants)
  IF NEW.is_public = true 
     AND (NEW.share_mode = 'private' OR NEW.share_mode IS NULL) THEN
    -- Check if this is a new share or mode changed from public to private
    IF (OLD.is_public IS NULL OR OLD.is_public = false) 
       OR (OLD.share_mode = 'public' AND NEW.share_mode = 'private') THEN
      -- Insert owner as participant if not already there
      INSERT INTO public.chat_folder_participants (folder_id, user_id, role, invited_by)
      VALUES (NEW.id, NEW.user_id, 'owner', NEW.user_id)
      ON CONFLICT (folder_id, user_id) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update trigger to also fire on share_mode changes
DROP TRIGGER IF EXISTS trg_handle_shared_folder ON public.chat_folders;
CREATE TRIGGER trg_handle_shared_folder
  AFTER INSERT OR UPDATE OF is_public, share_mode ON public.chat_folders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_shared_folder_participant();

