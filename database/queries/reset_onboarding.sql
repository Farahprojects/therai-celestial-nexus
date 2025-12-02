-- Reset onboarding for your user
-- Replace 'your-email@example.com' with your actual email address

UPDATE public.profiles
SET has_profile_setup = false
WHERE email = 'your-email@example.com';

-- Or reset for all users (use with caution!):
-- UPDATE public.profiles SET has_profile_setup = false;

-- Verify it worked:
-- SELECT id, email, has_profile_setup FROM public.profiles WHERE email = 'your-email@example.com';

