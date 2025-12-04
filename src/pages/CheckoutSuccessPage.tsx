import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Wallet, DollarSign } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { safeConsoleError } from '@/utils/safe-logging';
export const CheckoutSuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  
  const [verifying, setVerifying] = useState(true);
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [purchasedCredits, setPurchasedCredits] = useState<number | null>(null);
  const [amountUsd, setAmountUsd] = useState<number | null>(null);
  const [, setNewBalance] = useState<number | null>(null);

  const sessionId = searchParams.get('session_id');
  const paymentIntentId = searchParams.get('payment_intent');

  useEffect(() => {
    const verifyPayment = async () => {
      if (!user) {
        navigate('/settings');
        return;
      }

      try {
        // Verify payment with backend
        const { data, error } = await supabase.functions.invoke('verify-checkout-session', {
          body: {
            session_id: sessionId,
            payment_intent_id: paymentIntentId,
          },
        });

        if (error) {
          safeConsoleError('Verification error:', error);
          toast.error('Failed to verify payment');
          setVerifying(false);
          return;
        }

        if (data.payment_status === 'paid' || data.payment_status === 'succeeded') {
          setPaymentVerified(true);
          setPurchasedCredits(data.credits);
          setAmountUsd(data.amount_usd);
          
          // Optimistically calculate new balance
          const optimisticBalance = data.current_balance + data.credits;
          setNewBalance(optimisticBalance);

          // Poll for webhook confirmation (fallback)
          let attempts = 0;
          const maxAttempts = 5;
          const pollInterval = setInterval(async () => {
            attempts++;
            
            const { data: creditData } = await supabase
              .from('user_credits')
              .select('credits')
              .eq('user_id', user.id)
              .maybeSingle();

            if (creditData && creditData.credits >= optimisticBalance) {
              // Webhook has confirmed
              setNewBalance(creditData.credits);
              clearInterval(pollInterval);
            }

            if (attempts >= maxAttempts) {
              clearInterval(pollInterval);
            }
          }, 2000);

          // Cleanup interval on unmount
          return () => clearInterval(pollInterval);
        } else {
          toast.error('Payment not completed');
        }
      } catch (err) {
        safeConsoleError('Payment verification error:', err);
        toast.error('Failed to verify payment');
      } finally {
        setVerifying(false);
      }
    };

    verifyPayment();
  }, [user, sessionId, paymentIntentId, navigate]);

  // Auto-redirect after animation completes (2.5 seconds)
  useEffect(() => {
    if (paymentVerified && !verifying) {
      const timer = setTimeout(() => {
        navigate('/therai', { replace: true });
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [paymentVerified, verifying, navigate]);

  if (verifying) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-gray-400 mx-auto" />
          <p className="text-sm font-light text-gray-600">Verifying payment...</p>
        </div>
      </div>
    );
  }

  if (!paymentVerified) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md px-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-2xl">✕</span>
          </div>
          <h1 className="text-2xl font-light text-gray-900">Payment Not Completed</h1>
          <p className="text-sm font-light text-gray-600">
            We couldn't verify your payment. Please try again or contact support.
          </p>
          <button
            onClick={() => navigate('/settings')}
            className="mt-6 px-6 py-3 bg-gray-900 text-white rounded-full font-light hover:bg-gray-800 transition-colors"
          >
            Return to Settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="text-center space-y-8 max-w-md px-6"
      >
        {/* Wallet Animation */}
        <div className="relative h-32 flex items-center justify-center">
          {/* Wallet Icon */}
          <motion.div
            initial={{ scale: 1 }}
            animate={{ 
              scale: [1, 1.1, 1],
              rotate: [0, -5, 5, 0]
            }}
            transition={{ 
              delay: 0.6,
              duration: 0.5,
              ease: "easeInOut"
            }}
          >
            <motion.div
              initial={{ color: '#6B7280' }}
              animate={{ color: '#10B981' }}
              transition={{ delay: 0.8, duration: 0.3 }}
            >
              <Wallet className="w-20 h-20" strokeWidth={1.5} />
            </motion.div>
          </motion.div>

          {/* Dollar Note Animation */}
          <AnimatePresence>
            <motion.div
              initial={{ 
                opacity: 1, 
                x: -80, 
                y: -40,
                rotate: -15,
                scale: 1
              }}
              animate={{ 
                opacity: [1, 1, 0],
                x: [null, 0],
                y: [null, 0],
                rotate: [null, 0],
                scale: [null, 0.3]
              }}
              transition={{ 
                duration: 0.6,
                delay: 0.3,
                ease: "easeInOut"
              }}
              className="absolute"
            >
              <motion.div
                initial={{ color: '#6B7280' }}
                animate={{ color: '#10B981' }}
                transition={{ delay: 0.5, duration: 0.2 }}
              >
                <DollarSign className="w-12 h-12" strokeWidth={2} />
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Order Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="bg-gray-50 rounded-2xl p-6 space-y-4"
        >
          <motion.h3 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.0 }}
            className="text-lg font-light text-green-600"
          >
            Success
          </motion.h3>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600 font-light">Credits</span>
              <span className="text-gray-900 font-medium">{purchasedCredits} credits</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600 font-light">Amount</span>
              <span className="text-gray-900 font-medium">${amountUsd?.toFixed(2) || '0.00'} USD</span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

