import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Logo from '@/components/Logo';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { safeConsoleError } from '@/utils/safe-logging';
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

  const renderFeature = (feature: string) => {
    const isVoiceFeature = feature.toLowerCase().includes('voice');
    return (
      <span className="inline-flex items-center gap-2 font-light">
        <span>{feature}</span>
        {isVoiceFeature && (
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-900 bg-gray-100 border border-gray-200 rounded-full">
            Beta
          </span>
        )}
      </span>
    );
  };
  
  const isCancelled = searchParams.get('subscription') === 'cancelled';

  // Determine plan tier label (Free, Plus, Growth, or Premium)
  const getPlanTier = (plan: PricingData): 'Free' | 'Plus' | 'Growth' | 'Premium' => {
    const id = plan.id.toLowerCase();
    const name = (plan.name || '').toLowerCase();
    const price = plan.unit_price_usd;

    if (id === 'free' || id.includes('free') || name.includes('free') || price === 0) {
      return 'Free';
    }
    if (id === '8_monthly' || id.includes('plus') || name.includes('plus') || price === 8) {
      return 'Plus';
    }
    if (id === '10_monthly' || id.includes('growth') || id.includes('starter') || name.includes('growth') || price === 10) {
      return 'Growth';
    }
    return 'Premium';
  };

  const getPlanFeatures = (plan: PricingData) => {
    const planId = plan.id;
    const planName = plan.name || '';

    const freeFeatures = [
      '3 chats per day with your astro data',
      'Together Mode (2-person sessions)',
      'Create and organize folders',
      'Upgrade anytime for unlimited voice & images'
    ];

    const plusFeatures = [
      'Unlimited AI conversations',
      'Together Mode (2-person sessions)',
      'Premium HD Voice (5 min/month)',
      'Image generation (1/day)',
      'Unlimited folders & sharing'
    ];
    
    const growthFeatures = [
      'Unlimited AI conversations',
      'Together Mode (2-person sessions)',
      'Premium HD Voice (10 min/month)',
      'Image generation (3/day)',
      'Unlimited folders & sharing'
    ];
    
    const premiumFeatures = [
      'Everything in Growth',
      'Unlimited voice conversations',
      'Unlimited image generation',
      'Priority support',
      'Early access to new features'
    ];

    // Check plan tier
    if (planId === 'free' || planId.includes('free')) {
      return freeFeatures;
    }
    if (planId === '8_monthly' || planId.includes('plus')) {
      return plusFeatures;
    }
    if (planId === '18_monthly' || planId === '25_monthly' || planId === 'subscription_professional' || planName.toLowerCase().includes('premium')) {
      return premiumFeatures;
    }
    
    return growthFeatures;
  };

  const getButtonText = (plan: PricingData): string => {
    const tier = getPlanTier(plan);
    return `Get ${tier}`;
  };

  // Fetch all subscription plans with A/B test logic
  useEffect(() => {
    const fetchPricing = async () => {
      try {
        // First, get user's A/B test group if authenticated
        const { data: { user } } = await supabase.auth.getUser();
        let userAbTestGroup = null;
        
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('ab_test_group')
            .eq('id', user.id)
            .single();
          
          userAbTestGroup = profile?.ab_test_group;
        }

        // Fetch all subscription plans
        const { data, error } = await supabase
          .from('price_list')
          .select('id, name, description, unit_price_usd, product_code')
          .eq('endpoint', 'subscription')
          .order('unit_price_usd', { ascending: true });

        if (error) {
          safeConsoleError('Error fetching pricing:', error);
        } else {
          // Start with clean slate - build exactly what we want to show
          const planMap = new Map<string, PricingData>();
          
          // Add all fetched plans to map
          (data || []).forEach(plan => {
            planMap.set(plan.id, plan);
          });

          // Determine which paid plan to show based on A/B test
          const shouldShowPlus = userAbTestGroup !== 'growth_plan';
          const shouldShowGrowth = userAbTestGroup === 'growth_plan';

          const freePlan = planMap.get('free');
          if (!freePlan) {
            console.error('Missing free plan in price_list response');
            throw new Error('Missing free plan');
          }

          let plusOrGrowthPlan: PricingData | null = null;
          if (shouldShowPlus) {
            plusOrGrowthPlan = planMap.get('8_monthly');
            if (!plusOrGrowthPlan) {
              console.error('Missing plus plan in price_list response');
              throw new Error('Missing plus plan');
            }
          } else if (shouldShowGrowth) {
            plusOrGrowthPlan = planMap.get('10_monthly');
            if (!plusOrGrowthPlan) {
              console.error('Missing growth plan in price_list response');
              throw new Error('Missing growth plan');
            }
          }

          const premiumPlan = planMap.get('18_monthly');
          if (!premiumPlan) {
            console.error('Missing premium plan in price_list response');
            throw new Error('Missing premium plan');
          }

          const finalPlans = [
            freePlan,
            ...(plusOrGrowthPlan ? [plusOrGrowthPlan] : []),
            premiumPlan
          ];

          const nameCounts = new Map<string, number>();
          finalPlans.forEach(plan => {
            if (!plan?.name) return;
            const key = plan.name.toLowerCase();
            nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
          });

          const duplicates: string[] = [];
          nameCounts.forEach((count, name) => {
            if (count > 1) duplicates.push(name);
          });

          if (duplicates.length > 0) {
            console.error('[SubscriptionPaywall] Duplicate plan names detected:', duplicates.length, 'duplicates found');
          }

          setPricingPlans(finalPlans);
        }
      } catch (error) {
        safeConsoleError('Error fetching pricing:', error);
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
      safeConsoleError('Error navigating to checkout:', error);
      toast.error('Something went wrong. Please try again.');
      setLoadingPlanId(null);
    }
  };

  useEffect(() => {
    if (!pricingPlans.length) return;

    // duplicate detection removed now that tier detection is stable
  }, [pricingPlans]);

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
          <div className="flex flex-col lg:flex-row justify-center gap-8 max-w-6xl mx-auto">
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
                    <CardContent className="p-8 text-left space-y-6 h-full flex flex-col">
                      {/* Header - Plan Tier and Price */}
                      <div className="space-y-3">
                        {/* Plan Tier Label (Growth/Premium) */}
                        <div className="text-2xl font-light text-gray-900">
                          {getPlanTier(plan)}
                        </div>

                        {/* Price - Bigger */}
                        <div className="space-y-1">
                          <div className="text-4xl font-light text-gray-900">
                          ${plan.unit_price_usd}
                          </div>
                          {plan.id === 'subscription_onetime' ? '' : 
                           plan.id.includes('yearly') || plan.id.includes('astro') ? (
                            <div className="text-sm font-light text-gray-500">per year</div>
                          ) : (
                            <div className="text-sm font-light text-gray-500">per month</div>
                          )}
                        </div>
                      </div>

                      {/* Features - Bullet Points */}
                      <div className="flex-grow">
                        <ul className="space-y-3">
                          {getPlanFeatures(plan).map((feature, featureIndex) => (
                            <li key={featureIndex} className="flex items-start text-sm text-gray-600">
                              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-3 mt-1.5 flex-shrink-0"></div>
                              {renderFeature(feature)}
                            </li>
                          ))}
                        </ul>
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
                          className="w-full bg-gray-900 hover:bg-gray-800 text-white font-light py-3 rounded-full text-base transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50"
                        >
                          {loadingPlanId === plan.id ? 'Processing...' : getButtonText(plan)}
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