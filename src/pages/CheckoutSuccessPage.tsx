import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface LocationState {
  credits?: number;
  amount?: number;
}

export const CheckoutSuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  
  const [verifying, setVerifying] = useState(true);
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [newBalance, setNewBalance] = useState<number | null>(null);
  const [purchasedCredits, setPurchasedCredits] = useState<number | null>(null);

  const sessionId = searchParams.get('session_id');
  const paymentIntentId = searchParams.get('payment_intent');
  const source = searchParams.get('source');
  const state = location.state as LocationState;

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
          console.error('Verification error:', error);
          toast.error('Failed to verify payment');
          setVerifying(false);
          return;
        }

        if (data.payment_status === 'paid' || data.payment_status === 'succeeded') {
          setPaymentVerified(true);
          setPurchasedCredits(data.credits);
          
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
        console.error('Payment verification error:', err);
        toast.error('Failed to verify payment');
      } finally {
        setVerifying(false);
      }
    };

    verifyPayment();
  }, [user, sessionId, paymentIntentId, navigate]);

  // Auto-redirect after 3 seconds
  useEffect(() => {
    if (paymentVerified && !verifying) {
      const timer = setTimeout(() => {
        navigate('/settings', { replace: true });
      }, 3000);

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
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="text-center space-y-6 max-w-md px-6"
      >
        {/* Success Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
        >
          <CheckCircle2 className="w-20 h-20 text-green-600 mx-auto" />
        </motion.div>

        {/* Success Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-2"
        >
          <h1 className="text-3xl font-light text-gray-900">Payment Successful</h1>
          <p className="text-sm font-light text-gray-600">
            Your credits have been added to your account
          </p>
        </motion.div>

        {/* Credit Information */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gray-50 rounded-2xl p-6 space-y-4"
        >
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-light text-gray-600">Credits Added</span>
              <span className="text-2xl font-light text-green-600">+{purchasedCredits}</span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-gray-200">
              <span className="text-sm font-light text-gray-600">New Balance</span>
              <span className="text-2xl font-light text-gray-900">{newBalance}</span>
            </div>
          </div>
        </motion.div>

        {/* Redirect Message */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-xs font-light text-gray-500"
        >
          Redirecting you back in a moment...
        </motion.p>

        {/* Manual Return Button */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          onClick={() => navigate('/settings', { replace: true })}
          className="mt-4 px-6 py-3 bg-gray-900 text-white rounded-full font-light hover:bg-gray-800 transition-colors"
        >
          Return to Settings Now
        </motion.button>
      </motion.div>
    </div>
  );
};

