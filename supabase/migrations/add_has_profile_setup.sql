-- Add has_profile_setup flag to profiles table (idempotent)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS has_profile_setup boolean NOT NULL DEFAULT false;

-- Optional: create an index for quick checks
CREATE INDEX IF NOT EXISTS idx_profiles_has_profile_setup ON public.profiles(has_profile_setup);

