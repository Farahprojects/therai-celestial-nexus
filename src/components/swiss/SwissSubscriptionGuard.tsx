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
              <Sparkles className="w-8 h-8 text-gray-600" />
            </div>
            
            <div className="space-y-3">
              <h2 className="text-3xl font-light text-gray-900">Get Started</h2>
              <p className="text-gray-600 font-light">
                Experience the full app — charts, reports, voice conversations, and more
              </p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-8 space-y-3">
              <div className="text-5xl font-light text-gray-900">$5</div>
              <div className="text-sm text-gray-500">
                50 credits • Everything unlocked • Never expires
              </div>
            </div>

            <Button
              onClick={() => setShowCreditModal(true)}
              className="w-full bg-gray-900 text-white hover:bg-gray-800 rounded-full font-light py-6 text-lg shadow-lg"
            >
              Get Started - $5
            </Button>

            <p className="text-xs text-gray-500 font-light">
              No subscription • Top up anytime • Credits never expire
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
