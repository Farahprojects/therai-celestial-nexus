import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { OnboardingModal } from './OnboardingModal';

interface OnboardingGuardProps {
  children: React.ReactNode;
}

export const OnboardingGuard: React.FC<OnboardingGuardProps> = ({ children }) => {
  const { user } = useAuth();
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!user) {
        setNeedsOnboarding(false);
        return;
      }

      try {
        // Check has_profile_setup flag
        const { data, error } = await supabase
          .from('profiles')
          .select('has_profile_setup')
          .eq('id' as never, user.id)
          .maybeSingle();

        if (error) {
          console.error('Error checking onboarding status:', error);
          // On error, assume onboarding not needed to avoid blocking user
          setNeedsOnboarding(false);
          return;
        }

        const hasSetup = data && 'has_profile_setup' in data ? data.has_profile_setup : false;
        const needs = !hasSetup;
        setNeedsOnboarding(needs);
        setShowModal(needs);
      } catch (error) {
        console.error('Error in onboarding check:', error);
        setNeedsOnboarding(false);
      }
    };

    checkOnboardingStatus();
  }, [user]);

  // Loading state - show nothing while checking
  if (needsOnboarding === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-12 h-12 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <AnimatePresence>
        {needsOnboarding && showModal && (
          <OnboardingModal
            isOpen={showModal}
            onComplete={() => {
              setNeedsOnboarding(false);
              setShowModal(false);
            }}
          />
        )}
      </AnimatePresence>
      {children}
    </>
  );
};

