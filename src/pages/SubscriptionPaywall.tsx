import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Logo from '@/components/Logo';
import { Sparkles, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PricingData {
  id: string;
  name: string;
  description: string;
  unit_price_usd: number;
  product_code: string;
}

const SubscriptionPaywall: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [pricingPlans, setPricingPlans] = useState<PricingData[]>([]);
  
  const isCancelled = searchParams.get('subscription') === 'cancelled';

  // Fetch all subscription plans
  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const { data, error } = await supabase
          .from('price_list')
          .select('id, name, description, unit_price_usd, product_code')
          .eq('endpoint', 'subscription')
          .order('unit_price_usd', { ascending: true });

        if (error) {
          console.error('Error fetching pricing:', error);
        } else {
          setPricingPlans(data || []);
        }
      } catch (error) {
        console.error('Error fetching pricing:', error);
      }
    };

    fetchPricing();
  }, []);

  const handleUnlock = async (planId: string) => {
    try {
      setLoadingPlanId(planId);
      
      // Navigate to embedded checkout page
      const url = new URL(window.location.origin + '/stripe');
      url.searchParams.set('planId', planId);
      window.location.href = url.toString();
    } catch (error) {
      console.error('Error navigating to checkout:', error);
      toast.error('Something went wrong. Please try again.');
      setLoadingPlanId(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="w-full py-8 flex justify-center border-b border-gray-100">
        <Logo size="md" />
      </header>

      <main className="flex-grow flex items-center justify-center px-4 sm:px-6 lg:px-8 py-16">
        <div className="w-full max-w-6xl">
          {/* Header */}
          <div className="text-center mb-12">
            {isCancelled ? (
              <>
                <h1 className="text-3xl font-light text-gray-900 tracking-tight mb-4">
                  We'd love you to <span className="italic font-light">stay</span>
                </h1>
                <p className="text-lg text-gray-600 font-light max-w-2xl mx-auto">
                  We spent a lot of time and effort building this and would like you to enjoy this app. 
                  Unfortunately we can't make it free.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-3xl font-light text-gray-900 tracking-tight mb-4">
                  Choose Your Plan
                </h1>
                <p className="text-lg text-gray-600 font-light max-w-2xl mx-auto">
                  Select the perfect plan for your journey
                </p>
              </>
            )}
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {pricingPlans.map((plan, index) => (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="w-full"
                >
                  <Card className={`border-0 shadow-lg bg-white rounded-3xl overflow-hidden h-full ${
                    plan.id === 'subscription_professional' ? 'ring-2 ring-gray-900' : ''
                  }`}>
                    <CardContent className="p-8 text-center space-y-6 h-full flex flex-col">
                      {/* Icon */}
                      <motion.div
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2 + index * 0.1, duration: 0.5 }}
                        className="flex items-center justify-center h-12 w-12 mx-auto rounded-full bg-gray-900"
                      >
                        <Sparkles className="h-6 w-6 text-white" />
                      </motion.div>

                      {/* Header */}
                      <div className="space-y-2">
                        <h3 className="text-xl font-light text-gray-900 leading-tight">
                          {plan.name}
                        </h3>
                        <p className="text-2xl font-light text-gray-600">
                          ${plan.unit_price_usd}
                          {plan.id === 'subscription_onetime' ? '' : 
                           plan.id.includes('yearly') || plan.id.includes('astro') ? '/year' : '/month'}
                        </p>
                      </div>

                      {/* Description */}
                      <div className="flex-grow">
                        <p className="text-sm font-light text-gray-600 leading-relaxed">
                          {plan.description}
                        </p>
                      </div>

                      {/* CTA Button */}
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 + index * 0.1, duration: 0.5 }}
                        className="pt-2"
                      >
                        <Button
                          onClick={() => handleUnlock(plan.id)}
                          disabled={loadingPlanId === plan.id}
                          className={`w-full font-light py-3 rounded-xl text-base transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 ${
                            plan.id === 'subscription_professional' 
                              ? 'bg-gray-900 hover:bg-gray-800 text-white' 
                              : 'bg-white hover:bg-gray-50 text-gray-900 border border-gray-300'
                          }`}
                        >
                          {loadingPlanId === plan.id ? 'Processing...' : isCancelled ? 'Try Again' : 'Get Started'}
                        </Button>
                      </motion.div>

                      {/* Security note */}
                      <p className="text-xs text-gray-400 font-light leading-relaxed">
                        Secure payment processed by Stripe. Cancel anytime.
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
          </div>
        </div>
      </main>

      <footer className="py-8 text-center text-sm text-gray-500 font-light">
        © {new Date().getFullYear()} therai. All rights reserved.
      </footer>
    </div>
  );
};

export default SubscriptionPaywall;