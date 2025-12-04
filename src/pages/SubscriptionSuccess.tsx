import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Logo from '@/components/Logo';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { safeConsoleError } from '@/utils/safe-logging';
const SubscriptionSuccess: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryLoading, setRetryLoading] = useState(false);
  const [planName, setPlanName] = useState<string>('Premium'); // Default fallback

  const sessionId = searchParams.get('session_id');

  // Determine plan tier from plan ID
  const getPlanTier = (planId: string | null): 'Growth' | 'Premium' => {
    if (!planId) return 'Premium';
    if (planId === '10_monthly' || planId === '15_monthly' || planId.includes('growth') || planId.includes('starter')) {
      return 'Growth';
    }
    return 'Premium';
  };

  const checkSubscription = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');

      if (error) {
        throw new Error(error.message);
      }

      if (data?.subscription_active) {
        // Determine plan name from subscription_plan
        const planId = data?.subscription_plan || null;
        const tier = getPlanTier(planId);
        setPlanName(tier);

        // Check if this is part of onboarding flow
        const onboardingChatId = localStorage.getItem('onboarding_chat_id');

        // Success! Redirect after a brief moment
        setTimeout(() => {
          if (onboardingChatId) {
            // Redirect to onboarding chat with starter questions
            navigate(`/ c / ${onboardingChatId}?new= true`, { replace: true });
          } else {
            // Normal subscription success flow
            navigate('/therai?payment_status=success', { replace: true });
          }
        }, 2000);
      } else {
        setError('Subscription verification failed. Please try again.');
      }
    } catch (err) {
      safeConsoleError('Error checking subscription:', err);
      setError(err instanceof Error ? err.message : 'Failed to verify subscription');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const retryVerification = async () => {
    setRetryLoading(true);
    setError(null);
    await checkSubscription();
    setRetryLoading(false);
  };

  const openCustomerPortal = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');

      if (error) {
        toast.error('Failed to open customer portal');
        return;
      }

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch {
      toast.error('Failed to open customer portal');
    }
  };

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <header className="w-full py-8 flex justify-center border-b border-gray-100">
          <Logo size="md" />
        </header>

        <main className="flex-grow flex items-center justify-center px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-md"
          >
            <Card className="border-0 shadow-lg bg-white rounded-3xl overflow-hidden">
              <CardContent className="p-12 text-center space-y-8">
                <div className="flex items-center justify-center h-16 w-16 mx-auto">
                  <Loader2 className="h-8 w-8 text-gray-900 animate-spin" />
                </div>

                <div className="space-y-3">
                  <h1 className="text-2xl font-light text-gray-900">
                    Verifying your subscription...
                  </h1>
                  <p className="text-gray-600 font-light">
                    Please wait while we confirm your payment
                    {sessionId && (
                      <span className="block text-sm text-gray-400 mt-2">
                        Session: {sessionId.slice(-8)}
                      </span>
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <header className="w-full py-8 flex justify-center border-b border-gray-100">
          <Logo size="md" />
        </header>

        <main className="flex-grow flex items-center justify-center px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-md"
          >
            <Card className="border-0 shadow-lg bg-white rounded-3xl overflow-hidden">
              <CardContent className="p-12 text-center space-y-8">
                <div className="flex items-center justify-center h-16 w-16 mx-auto rounded-full bg-red-100">
                  <AlertCircle className="h-8 w-8 text-red-600" />
                </div>

                <div className="space-y-3">
                  <h1 className="text-2xl font-light text-gray-900">
                    Verification Issue
                  </h1>
                  <p className="text-gray-600 font-light">
                    {error}
                  </p>
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={retryVerification}
                    disabled={retryLoading}
                    className="w-full bg-gray-900 hover:bg-gray-800 text-white font-light py-4 rounded-xl"
                  >
                    {retryLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      'Retry Verification'
                    )}
                  </Button>

                  <Button
                    onClick={openCustomerPortal}
                    variant="outline"
                    className="w-full border-gray-200 text-gray-600 font-light py-4 rounded-xl"
                  >
                    Manage Subscription
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </main>
      </div>
    );
  }

  // Success state
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="w-full py-8 flex justify-center border-b border-gray-100">
        <Logo size="md" />
      </header>

      <main className="flex-grow flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          <Card className="border-0 shadow-lg bg-white rounded-3xl overflow-hidden">
            <CardContent className="p-12 text-center space-y-8">
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="flex items-center justify-center h-16 w-16 mx-auto rounded-full bg-green-100"
              >
                <CheckCircle className="h-8 w-8 text-green-600" />
              </motion.div>

              <div className="space-y-3">
                <h1 className="text-2xl font-light text-gray-900">
                  Welcome to <span className="italic">{planName}</span>!
                </h1>
                <p className="text-gray-600 font-light">
                  Your subscription is active. Redirecting you to your dashboard...
                </p>
              </div>

              <div className="pt-4">
                <Button
                  onClick={() => {
                    const onboardingChatId = localStorage.getItem('onboarding_chat_id');
                    if (onboardingChatId) {
                      navigate(`/ c / ${onboardingChatId}?new= true`, { replace: true });
                    } else {
                      navigate('/therai?payment_status=success', { replace: true });
                    }
                  }}
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white font-light py-4 rounded-xl"
                >
                  Continue to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
};

export default SubscriptionSuccess;