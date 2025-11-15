-- Add has_seen_subscription_page flag to profiles table
-- This flag ensures starter questions only show AFTER the subscription page has been presented

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS has_seen_subscription_page boolean NOT NULL DEFAULT false;
-- Create an index for quick checks
CREATE INDEX IF NOT EXISTS idx_profiles_has_seen_subscription_page 
ON public.profiles(has_seen_subscription_page);
-- Add comment for documentation
COMMENT ON COLUMN public.profiles.has_seen_subscription_page IS 
'Flag set to true after user has seen the subscription page during onboarding. Used to control when starter questions are shown.';
