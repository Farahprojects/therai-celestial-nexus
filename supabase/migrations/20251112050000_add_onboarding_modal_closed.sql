-- Add onboarding_modal_closed flag to profiles table
-- This flag tracks when the OnboardingModal has fully closed to orchestrate smooth transition to StarterQuestionsPopup

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS onboarding_modal_closed BOOLEAN DEFAULT FALSE;

-- Add comment for clarity
COMMENT ON COLUMN profiles.onboarding_modal_closed IS 'Tracks when the onboarding modal has fully closed during the onboarding flow';

