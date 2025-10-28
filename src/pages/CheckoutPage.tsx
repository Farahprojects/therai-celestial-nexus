import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string);

interface CheckoutState {
  amount: number;
  credits: number;
  isAutoTopup: boolean;
  clientSecret: string;
  paymentIntentId: string;
}

const CheckoutForm: React.FC<{ state: CheckoutState; currentCredits: number }> = ({ state, currentCredits }) => {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);

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
        // Payment succeeded, navigate to success page
        navigate(`/checkout/success?source=topup&payment_intent=${paymentIntent.id}`, {
          state: {
            credits: state.credits,
            amount: state.amount,
          },
        });
      }
    } catch (err) {
      console.error('Payment error:', err);
      toast.error('An unexpected error occurred');
      setIsProcessing(false);
    }
  };

  const finalCredits = currentCredits + state.credits;

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
          <div className="pt-3 border-t border-gray-200">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Current Balance</span>
              <span className="text-gray-900">{currentCredits} credits</span>
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-gray-600">New Balance</span>
              <span className="text-gray-900 font-medium">{finalCredits} credits</span>
            </div>
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
  const [currentCredits, setCurrentCredits] = useState(0);
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
      {/* Header */}
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

      {/* Checkout Form */}
      <div className="max-w-lg mx-auto px-6 py-12">
        <Elements stripe={stripePromise} options={{ clientSecret: state.clientSecret, appearance }}>
          <CheckoutForm state={state} currentCredits={currentCredits} />
        </Elements>
      </div>
    </div>
  );
};

