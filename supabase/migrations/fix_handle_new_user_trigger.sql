-- Fix handle_new_user trigger by removing non-existent column references
-- This removes verification_status column that doesn't exist in your schema

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create profiles row (fixed - removed verification_status)
  INSERT INTO public.profiles (
    id,
    email,
    email_verified,
    created_at,
    updated_at,
    last_seen_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN true ELSE false END,
    COALESCE(NEW.created_at, now()),
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    email_verified = EXCLUDED.email_verified,
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
