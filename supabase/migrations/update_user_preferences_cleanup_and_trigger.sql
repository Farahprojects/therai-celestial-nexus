-- Step 1: Drop unwanted columns from user_preferences table
ALTER TABLE user_preferences 
DROP COLUMN IF EXISTS password_change_notifications,
DROP COLUMN IF EXISTS email_change_notifications,
DROP COLUMN IF EXISTS security_alert_notifications;

-- Step 2: Add voice preference column
ALTER TABLE user_preferences 
ADD COLUMN IF NOT EXISTS tts_voice TEXT DEFAULT 'Puck';

-- Add a comment to document the column
COMMENT ON COLUMN user_preferences.tts_voice IS 'User selected TTS voice name (e.g., Puck, Achernar, etc.)';

-- Step 3: Update the handle_new_user function to also create user_preferences
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create profiles row (existing logic)
  INSERT INTO public.profiles (
    id,
    email,
    email_verified,
    verification_status,
    created_at,
    updated_at,
    last_seen_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN true ELSE false END,
    CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN 'verified'::verification_status_type ELSE 'pending'::verification_status_type END,
    COALESCE(NEW.created_at, now()),
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    email_verified = EXCLUDED.email_verified,
    verification_status = EXCLUDED.verification_status,
    updated_at = now();

  -- Create user_preferences row (new logic)
  INSERT INTO public.user_preferences (
    user_id,
    email_notifications_enabled,
    client_view_mode,
    tts_voice,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    true, -- Default to enabled
    'grid', -- Default view mode
    'Puck', -- Default voice
    now(),
    now()
  )
  ON CONFLICT (user_id) DO NOTHING; -- Don't update if already exists
  
  RETURN NEW;
END;
$$;

-- Step 4: Ensure the trigger exists (it should already exist from previous migrations)
-- This is just to be safe in case it was dropped
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
