-- Drop share_token and share_mode columns from conversations table
ALTER TABLE conversations 
  DROP COLUMN IF EXISTS share_token,
  DROP COLUMN IF EXISTS share_mode;

-- Create trigger function to manage public conversation participants
CREATE OR REPLACE FUNCTION public.handle_public_conversation_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When conversation becomes public, ensure owner is a participant
  IF NEW.is_public = true AND (OLD.is_public IS NULL OR OLD.is_public = false) THEN
    -- Insert owner as participant if not already there
    INSERT INTO conversations_participants (conversation_id, user_id, role, invited_by)
    VALUES (NEW.id, NEW.owner_user_id, 'owner', NEW.owner_user_id)
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on conversations table
DROP TRIGGER IF EXISTS trg_handle_public_conversation ON conversations;
CREATE TRIGGER trg_handle_public_conversation
  AFTER INSERT OR UPDATE OF is_public ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION handle_public_conversation_participant();