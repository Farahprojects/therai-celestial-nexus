import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Lock, Sparkles } from 'lucide-react';
import { CreditPurchaseModal } from '@/components/billing/CreditPurchaseModal';

interface SwissSubscriptionGuardProps {
  children: React.ReactNode;
}

/**
 * SwissSubscriptionGuard - Protects Swiss data generation features
 * 
 * Checks for sufficient credit balance
 * Shows paywall if user doesn't have credits
 */
export const SwissSubscriptionGuard: React.FC<SwissSubscriptionGuardProps> = ({ children }) => {
  const { user } = useAuth();
  const [credits, setCredits] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [showCreditModal, setShowCreditModal] = useState(false);

  useEffect(() => {
    const fetchCredits = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_credits')
          .select('credits')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!error && data) {
          setCredits(data.credits || 0);
        }
      } catch (error) {
        console.error('Error fetching credits:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCredits();
  }, [user]);

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="text-sm text-gray-600">Checking credits...</p>
        </div>
      </div>
    );
  }

  // Show paywall if insufficient credits
  if (credits < 1) {
    return (
      <>
        <div className="flex items-center justify-center h-full p-6">
          <div className="max-w-md w-full space-y-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100">
              <Lock className="w-8 h-8 text-gray-600" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-light text-gray-900">Astro Generator</h2>
              <p className="text-gray-600">
                Generate and export Astro data for use in your preferred AI tools.
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-center gap-2 text-gray-900">
                <Sparkles className="w-5 h-5" />
                <span className="text-lg font-medium">1-4 credits per generation</span>
              </div>
              <p className="text-sm text-gray-600">
                You currently have <span className="font-medium text-gray-900">{credits} credits</span>
              </p>
              <ul className="text-sm text-gray-600 space-y-2 text-left">
                <li className="flex items-start gap-2">
                  <span className="text-gray-900">•</span>
                  <span>Generate unlimited Astro data</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-900">•</span>
                  <span>Save and organize your datasets</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-900">•</span>
                  <span>Copy and export to any AI tool</span>
                </li>
              </ul>
            </div>

            <Button
              onClick={() => setShowCreditModal(true)}
              className="w-full bg-gray-900 text-white hover:bg-gray-800 rounded-lg py-3"
            >
              Top Up Credits
            </Button>

            <p className="text-xs text-gray-500">
              Credits start at $5 (33 credits). Credits never expire.
            </p>
          </div>
        </div>

        <CreditPurchaseModal
          isOpen={showCreditModal}
          onClose={() => setShowCreditModal(false)}
        />
      </>
    );
  }

  // User has credits, render children
  return <>{children}</>;
};
