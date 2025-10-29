import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Wallet, DollarSign } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettingsModal } from '@/contexts/SettingsModalContext';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string);

interface CheckoutState {
  amount: number;
  credits: number;
  isAutoTopup: boolean;
  clientSecret: string;
  paymentIntentId: string;
}

const CheckoutForm: React.FC<{ 
  state: CheckoutState; 
  currentCredits: number;
  onSuccess: () => void;
  closeSettings: () => void;
}> = ({ state, currentCredits, onSuccess, closeSettings }) => {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/checkout/success?source=topup&payment_intent=${state.paymentIntentId}`,
        },
        redirect: 'if_required',
      });

      if (error) {
        toast.error(error.message || 'Payment failed');
        setIsProcessing(false);
        return;
      }

      if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Payment succeeded - show success animation inline
        setPaymentSuccess(true);
        setIsProcessing(false);
        onSuccess(); // Notify parent component
        
        // Redirect to /therai after animation completes
        setTimeout(() => {
          closeSettings(); // Ensure settings modal is closed
          navigate('/therai', { replace: true });
        }, 2500);
      }
    } catch (err) {
      console.error('Payment error:', err);
      toast.error('An unexpected error occurred');
      setIsProcessing(false);
    }
  };

  const finalCredits = currentCredits + state.credits;

  // Show success animation after payment completes
  if (paymentSuccess) {
    return (
      <div className="space-y-8">
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

        {/* Success Summary */}
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
              <span className="text-gray-900 font-medium">{state.credits} credits</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600 font-light">Amount</span>
              <span className="text-gray-900 font-medium">${state.amount.toFixed(2)} USD</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Show payment form
  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Order Summary */}
      <div className="bg-gray-50 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-normal text-gray-600">Order Summary</h3>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Credits</span>
            <span className="text-gray-900 font-medium">{state.credits} credits</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Amount</span>
            <span className="text-gray-900 font-medium">${state.amount.toFixed(2)} USD</span>
          </div>
        </div>
      </div>

      {/* Payment Element */}
      <div className="space-y-4">
        <h3 className="text-sm font-normal text-gray-600">Payment Details</h3>
        <PaymentElement />
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full bg-gray-900 hover:bg-gray-800 text-white rounded-full font-light py-6 text-base"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          `Pay $${state.amount.toFixed(2)}`
        )}
      </Button>

      <p className="text-xs text-gray-500 text-center font-light">
        Secured by Stripe • Credits never expire
      </p>
    </form>
  );
};

export const CheckoutPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { closeSettings } = useSettingsModal();
  const [currentCredits, setCurrentCredits] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const state = location.state as CheckoutState;

  useEffect(() => {
    // Fetch current credit balance
    const fetchCredits = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('user_credits')
        .select('credits')
        .eq('user_id', user.id)
        .maybeSingle();

      setCurrentCredits(data?.credits || 0);
    };

    fetchCredits();
  }, [user]);

  // Redirect if no state
  useEffect(() => {
    if (!state || !state.clientSecret) {
      navigate('/settings');
    }
  }, [state, navigate]);

  if (!state || !state.clientSecret) {
    return null;
  }

  const appearance = {
    theme: 'flat' as const,
    variables: {
      colorPrimary: '#111827', // gray-900
      colorBackground: '#ffffff',
      colorText: '#111827',
      colorDanger: '#ef4444',
      fontFamily: 'Inter, system-ui, sans-serif',
      spacingUnit: '4px',
      borderRadius: '12px',
    },
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header - hide back button when showing success */}
      {!showSuccess && (
        <div className="border-b border-gray-200">
          <div className="max-w-2xl mx-auto px-6 py-6">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/settings')}
                className="rounded-full"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h1 className="text-2xl font-light text-gray-900">Complete Your Purchase</h1>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Form */}
      <div className="max-w-lg mx-auto px-6 py-12">
        <Elements stripe={stripePromise} options={{ clientSecret: state.clientSecret, appearance }}>
          <CheckoutForm 
            state={state} 
            currentCredits={currentCredits}
            onSuccess={() => setShowSuccess(true)}
            closeSettings={closeSettings}
          />
        </Elements>
      </div>
    </div>
  );
};

