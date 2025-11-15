-- Automatically share conversations when their folder is shared
-- This ensures conversations in shared folders are also publicly accessible

-- Function to automatically share conversations when folder is shared
CREATE OR REPLACE FUNCTION public.handle_share_folder_conversations()
RETURNS TRIGGER AS $$
BEGIN
  -- When folder becomes shared (is_public = true), share all conversations in that folder
  IF NEW.is_public = true AND (OLD.is_public IS NULL OR OLD.is_public = false) THEN
    -- Update all conversations in this folder to be public
    UPDATE public.conversations
    SET is_public = true,
        updated_at = NOW()
    WHERE folder_id = NEW.id
      AND (is_public IS NULL OR is_public = false);  -- Only update if not already public
    
    -- For private folders, ensure owner is added as participant to conversations
    IF NEW.share_mode = 'private' OR NEW.share_mode IS NULL THEN
      -- Add owner as participant to all conversations in the folder
      INSERT INTO public.conversations_participants (conversation_id, user_id, role, invited_by)
      SELECT id, NEW.user_id, 'owner', NEW.user_id
      FROM public.conversations
      WHERE folder_id = NEW.id
      ON CONFLICT (conversation_id, user_id) DO NOTHING;
    END IF;
  END IF;

  -- When folder is unshared (is_public = false), optionally unshare conversations
  -- Note: We might want to keep conversations public even if folder is unshared
  -- So we'll only update if the conversation's owner matches the folder owner
  IF NEW.is_public = false AND OLD.is_public = true THEN
    -- Unshare conversations that belong to this folder and are owned by the folder owner
    UPDATE public.conversations
    SET is_public = false,
        updated_at = NOW()
    WHERE folder_id = NEW.id
      AND user_id = NEW.user_id  -- Only unshare if conversation owner matches folder owner
      AND is_public = true;
  END IF;

  -- When folder share_mode changes from public to private or vice versa
  IF NEW.is_public = true AND OLD.is_public = true 
     AND (NEW.share_mode != OLD.share_mode OR (NEW.share_mode IS NULL AND OLD.share_mode IS NOT NULL)) THEN
    -- If changing to private, ensure participants are added
    IF (NEW.share_mode = 'private' OR NEW.share_mode IS NULL) 
       AND OLD.share_mode = 'public' THEN
      -- Add owner as participant to all conversations in the folder
      INSERT INTO public.conversations_participants (conversation_id, user_id, role, invited_by)
      SELECT id, NEW.user_id, 'owner', NEW.user_id
      FROM public.conversations
      WHERE folder_id = NEW.id
      ON CONFLICT (conversation_id, user_id) DO NOTHING;
    END IF;
    -- If changing to public, conversations remain public (already handled above)
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Create trigger to auto-share conversations when folder is shared
DROP TRIGGER IF EXISTS trg_share_folder_conversations ON public.chat_folders;
CREATE TRIGGER trg_share_folder_conversations
  AFTER INSERT OR UPDATE OF is_public, share_mode ON public.chat_folders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_share_folder_conversations();
-- Also handle when a conversation is added to a shared folder
CREATE OR REPLACE FUNCTION public.handle_conversation_added_to_shared_folder()
RETURNS TRIGGER AS $$
BEGIN
  -- When a conversation is added to a shared folder, share it automatically
  IF NEW.folder_id IS NOT NULL THEN
    -- Check if the folder is shared
    IF EXISTS (
      SELECT 1 FROM public.chat_folders
      WHERE id = NEW.folder_id AND is_public = true
    ) THEN
      -- Share the conversation
      UPDATE public.conversations
      SET is_public = true,
          updated_at = NOW()
      WHERE id = NEW.id
        AND (is_public IS NULL OR is_public = false);
      
      -- For private folders, add folder owner as participant
      IF EXISTS (
        SELECT 1 FROM public.chat_folders
        WHERE id = NEW.folder_id 
          AND is_public = true
          AND (share_mode = 'private' OR share_mode IS NULL)
      ) THEN
        -- Add folder owner as participant
        INSERT INTO public.conversations_participants (conversation_id, user_id, role, invited_by)
        SELECT NEW.id, user_id, 'owner', user_id
        FROM public.chat_folders
        WHERE id = NEW.folder_id
        ON CONFLICT (conversation_id, user_id) DO NOTHING;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Create trigger for when conversations are added/updated with folder_id
DROP TRIGGER IF EXISTS trg_conversation_folder_share ON public.conversations;
CREATE TRIGGER trg_conversation_folder_share
  AFTER INSERT OR UPDATE OF folder_id ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_conversation_added_to_shared_folder();
