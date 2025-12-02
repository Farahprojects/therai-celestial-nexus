-- Add display_name column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Add a comment to document the column
COMMENT ON COLUMN public.profiles.display_name IS 'User-friendly display name for the profile';

-- Update the handle_new_user function to set display_name from email initially
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create profiles row with display_name
  INSERT INTO public.profiles (
    id,
    email,
    email_verified,
    display_name,
    created_at,
    updated_at,
    last_seen_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN true ELSE false END,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)), -- Use display_name from meta or email prefix
    COALESCE(NEW.created_at, now()),
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    email_verified = EXCLUDED.email_verified,
    display_name = COALESCE(profiles.display_name, EXCLUDED.display_name), -- Keep existing display_name if set
    updated_at = now();

  -- Create user_preferences row
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
