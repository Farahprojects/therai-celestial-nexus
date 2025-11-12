import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Logo from '@/components/Logo';
import { supabase } from '@/integrations/supabase/client';
import { SEO } from '@/components/SEO';

interface PricingData {
  id: string;
  name: string;
  description: string;
  unit_price_usd: number;
  product_code: string;
}

const Pricing: React.FC = () => {
  const navigate = useNavigate();
  const [pricingPlans, setPricingPlans] = useState<PricingData[]>([]);
  const [abTestGroup, setAbTestGroup] = useState<string | null>(null);

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

  // Determine plan tier label (Plus, Growth, or Premium)
  const getPlanTier = (planId: string): 'Plus' | 'Growth' | 'Premium' => {
    if (planId === '8_monthly' || planId.includes('plus')) {
      return 'Plus';
    }
    if (planId === '10_monthly' || planId.includes('growth') || planId.includes('starter')) {
      return 'Growth';
    }
    return 'Premium';
  };

  const getPlanFeatures = (planId: string, planName: string) => {
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

    if (planId === '8_monthly' || planId.includes('plus')) {
      return plusFeatures;
    }
    if (planId === '18_monthly' || planId === '25_monthly' || planId === 'subscription_professional' || planName.toLowerCase().includes('premium')) {
      return premiumFeatures;
    }
    
    return growthFeatures;
  };

  const getButtonText = (planId: string): string => {
    const tier = getPlanTier(planId);
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
          setAbTestGroup(userAbTestGroup);
        }

        // Fetch all subscription plans
        const { data, error } = await supabase
          .from('price_list')
          .select('id, name, description, unit_price_usd, product_code')
          .eq('endpoint', 'subscription')
          .order('unit_price_usd', { ascending: true });

        if (error) {
          console.error('Error fetching pricing:', error);
        } else {
          let filteredPlans = data || [];
          
          // A/B Test Logic: Show either Plus OR Growth, never both
          if (userAbTestGroup === 'plus_plan') {
            // Show Plus plan, hide Growth plan
            filteredPlans = filteredPlans.filter(plan => plan.id !== '10_monthly');
          } else if (userAbTestGroup === 'growth_plan') {
            // Show Growth plan, hide Plus plan
            filteredPlans = filteredPlans.filter(plan => plan.id !== '8_monthly');
          } else {
            // No A/B test group assigned - default to Plus + Premium
            filteredPlans = filteredPlans.filter(plan => plan.id !== '10_monthly');
          }

          // Ensure Plus plan card exists locally even if not returned from API
          const hasPlusPlan = filteredPlans.some(plan => plan.id === '8_monthly');
          const shouldShowPlus =
            userAbTestGroup !== 'growth_plan';

          if (!hasPlusPlan && shouldShowPlus) {
            filteredPlans = [
              {
                id: '8_monthly',
                name: 'Plus',
                description: 'Essential features for daily practice',
                unit_price_usd: 8,
                product_code: 'plus_monthly'
              },
              ...filteredPlans
            ];
          }

          setPricingPlans(filteredPlans);
        }
      } catch (error) {
        console.error('Error fetching pricing:', error);
      }
    };

    fetchPricing();
  }, []);

  const handleGetStarted = (planId: string) => {
    // Redirect to login page instead of checkout
    navigate('/login');
  };

  const pricingStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Therai Astrology Subscription',
    description: 'AI-powered astrology reports and insights with multiple subscription tiers',
    url: 'https://therai.co/pricing',
    offers: {
      '@type': 'AggregateOffer',
      offerCount: pricingPlans.length,
      offers: pricingPlans.map(plan => ({
        '@type': 'Offer',
        price: plan.unit_price_usd,
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        url: 'https://therai.co/pricing',
      })),
    },
  };

  return (
    <>
      <SEO
        title="Pricing | AI-Powered Psychological Insights | Therai"
        description="Choose a plan for Therai, an AI webapp that helps create psychological insights into momentum through astrology. Growth and Premium plans available."
        keywords="therai pricing, AI astrology, psychological insights, astrology subscription, AI webapp pricing"
        url="/pricing"
        structuredData={pricingStructuredData}
      />
      <div className="min-h-screen flex flex-col bg-white">
      <header className="w-full py-8 flex justify-center border-b border-gray-100">
        <Logo size="md" />
      </header>

      <main className="flex-grow flex items-center justify-center px-4 sm:px-6 lg:px-8 py-16">
        <div className="w-full max-w-6xl">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-3xl font-light text-gray-900 tracking-tight mb-4">
              Choose Your Plan
            </h1>
            <p className="text-lg text-gray-600 font-light max-w-2xl mx-auto">
              Select the perfect plan for your journey
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="flex justify-center gap-8 max-w-6xl mx-auto">
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
                          {getPlanTier(plan.id)}
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
                          {getPlanFeatures(plan.id, plan.name).map((feature, featureIndex) => (
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
                        {getPlanTier(plan.id) === 'Premium' ? (
                          <Button
                            disabled
                            className="w-full bg-gray-300 text-gray-500 font-light py-3 rounded-full text-base cursor-not-allowed"
                          >
                            Coming Soon
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleGetStarted(plan.id)}
                            className="w-full bg-gray-900 hover:bg-gray-800 text-white font-light py-3 rounded-full text-base transition-all duration-200 shadow-sm hover:shadow-md"
                          >
                            {getButtonText(plan.id)}
                          </Button>
                        )}
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
    </>
  );
};

export default Pricing;
