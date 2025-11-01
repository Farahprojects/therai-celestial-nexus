import React, { useEffect, useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js';
import { supabase } from '@/integrations/supabase/client';
import Logo from '@/components/Logo';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string;

const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : Promise.resolve(null);

const EmbeddedCheckoutPage: React.FC = () => {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      const planId = searchParams.get('planId');
      if (!planId || !user?.id) return;
      
      // Look up the Stripe price ID from the database
      const { data: priceData, error: priceError } = await supabase
        .from('price_list')
        .select('stripe_price_id')
        .eq('id', planId)
        .single();
      
      if (priceError || !priceData?.stripe_price_id) {
        console.error('Failed to fetch Stripe price ID:', priceError);
        return;
      }
      
      const returnUrl = `${window.location.origin}/success`;
      const { data, error } = await supabase.functions.invoke('create-subscription-checkout', {
        body: {
          priceId: priceData.stripe_price_id,  // Use actual Stripe price ID
          embedded: true,
          returnUrl
        }
      });
      if (error) {
        console.error('Failed to create embedded checkout session:', error);
        return;
      }
      setClientSecret(data?.clientSecret || null);
    })();
  }, [searchParams, user?.id]);

  const options = useMemo(() => (clientSecret ? { clientSecret } : undefined), [clientSecret]);

  if (!STRIPE_PUBLISHABLE_KEY) {
    return <div className="p-8">Missing VITE_STRIPE_PUBLISHABLE_KEY</div>;
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="p-10 flex flex-col justify-between bg-white">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="flex justify-center mb-6">
            <Logo size="lg" asLink={false} />
          </div>
          <h1 className="text-4xl font-light italic">Therai partners with Stripe for simplified billing.</h1>
          <div className="text-xs text-gray-400 mt-6">
            <div>Therai.co is brand by Farah Projects PTY LTD</div>
            <div>ACN 676 280 229</div>
            <div>Australian registered company (fully legit as)</div>
          </div>
        </div>
        <div className="max-w-md w-full space-y-4 text-center text-sm text-gray-500">
          <div className="flex items-center justify-center space-x-2">
            <span>Powered by</span>
            <a href="https://stripe.com" target="_blank" rel="noopener noreferrer" className="text-[#635BFF] hover:text-[#4F46E5] font-medium transition-colors" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>Stripe</a>
          </div>
          <div className="space-x-4">
            <a href="https://stripe.com/billing" target="_blank" rel="noopener noreferrer" className="hover:text-gray-700 underline">Learn more about Stripe Billing</a>
            <a href="https://stripe.com/legal/terms" target="_blank" rel="noopener noreferrer" className="hover:text-gray-700 underline">Terms</a>
            <a href="https://stripe.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-gray-700 underline">Privacy</a>
          </div>
        </div>
      </div>
      <div className="p-10 bg-gray-50 flex items-center justify-center">
        {clientSecret && options && (
          <div className="max-w-md w-full bg-white p-0 rounded-xl shadow-sm overflow-hidden">
            <EmbeddedCheckoutProvider stripe={stripePromise} options={options as any}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmbeddedCheckoutPage;


