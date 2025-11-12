import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

type PlanInfo = {
  id: string;
  name: string;
  description: string;
  unit_price_usd: number;
  product_code: string;
  stripe_price_id?: string;
};

interface SubscriptionCardProps {
  plan: PlanInfo;
  index: number;
  isSelected: boolean;
  onSelect: (planId: string) => void;
  loading: boolean;
}

const SubscriptionCard: React.FC<SubscriptionCardProps> = ({
  plan,
  index,
  isSelected,
  onSelect,
  loading
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { user } = useAuth();
  
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  // Determine plan tier label (Free, Plus, Growth, or Premium)
  const getPlanTier = (planInfo: PlanInfo): 'Free' | 'Plus' | 'Growth' | 'Premium' => {
    const normalizedId = planInfo.id.toLowerCase();
    const normalizedName = (planInfo.name || '').toLowerCase();
    const price = planInfo.unit_price_usd;

    if (
      normalizedId === 'free' ||
      normalizedId.includes('free') ||
      normalizedName.includes('free') ||
      price === 0
    ) {
      return 'Free';
    }
    // Plus tier ($8/month)
    if (
      normalizedId === '8_monthly' ||
      normalizedId.includes('plus') ||
      normalizedName.includes('plus') ||
      price === 8
    ) {
      return 'Plus';
    }
    // Growth tier ($10/month)
    if (
      normalizedId === '10_monthly' ||
      normalizedId.includes('growth') ||
      normalizedId.includes('starter') ||
      normalizedName.includes('growth') ||
      price === 10
    ) {
      return 'Growth';
    }
    // Premium tier ($18/month)
    return 'Premium';
  };

  const getPlanFeatures = (planInfo: PlanInfo) => {
    const planId = planInfo.id;
    const planName = planInfo.name || '';

    const freeFeatures = [
      '3 chats per day with your astro data',
      'Together Mode (2-person sessions)',
      'Create and organize folders',
      'Upgrade anytime for unlimited voice & images'
    ];
    
    // Plus plan features ($8/month)
    const plusFeatures = [
      'Unlimited AI conversations',
      'Together Mode (2-person sessions)',
      'Premium HD Voice (5 min/month)',
      'Image generation (1/day)',
      'Unlimited folders & sharing'
    ];
    
    // Growth plan features ($10/month)
    const growthFeatures = [
      'Unlimited AI conversations',
      'Together Mode (2-person sessions)',
      'Premium HD Voice (10 min/month)',
      'Image generation (3/day)',
      'Unlimited folders & sharing'
    ];
    
    // Premium plan features ($18/month)
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

  const getButtonText = (planInfo: PlanInfo): string => {
    const tier = getPlanTier(planInfo);
    if (tier === 'Free') {
      return 'Stay Free';
    }
    return `Get ${tier}`;
  };

  const planTier = getPlanTier(plan);
  const isPopular = plan.id === '25_monthly' || plan.id === 'subscription_professional' || plan.name.toLowerCase().includes('premium');
  const isFreePlan = plan.id === 'free' || planTier === 'Free';
  const isMonthlyPlan =
    (plan.id && plan.id.includes('monthly')) ||
    (plan.product_code && plan.product_code.includes('monthly')) ||
    planTier !== 'Free';

  const handleCheckout = async () => {
    setIsProcessing(true);
    try {
      // Check if it's a one-shot plan
      const isOneShot = plan.id === 'starter-plan';
      
      if (isOneShot) {
        // One-shot embedded checkout: navigate to /stripe with planId
        const url = new URL(window.location.origin + '/stripe');
        url.searchParams.set('planId', plan.id);
        window.location.href = url.toString();
      } else {
        // Subscription embedded checkout: navigate to /stripe with planId
        const url = new URL(window.location.origin + '/stripe');
        url.searchParams.set('planId', plan.id);
        window.location.href = url.toString();
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Failed to start checkout process');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="w-full"
    >
      <Card 
        className={`border-0 shadow-lg bg-white rounded-3xl overflow-hidden h-full cursor-pointer transition-all duration-200 ${
          isSelected ? 'ring-2 ring-gray-900 shadow-xl' : 'hover:shadow-xl'
        } ${isPopular ? 'ring-2 ring-gray-900' : ''}`}
        onClick={() => onSelect(plan.id)}
      >
        <CardContent className="p-8 text-left space-y-6 h-full flex flex-col">
          {/* Header - Plan Tier and Price */}
          <div className="space-y-3">
            {/* Plan Tier Label (Growth/Premium) */}
            <div className="text-2xl font-light text-gray-900">
              {planTier}
            </div>
            
            {/* Price - Bigger */}
            <div className="space-y-1">
              <div className="flex items-start gap-3">
                <div className="text-4xl font-light text-gray-900">
                  {isFreePlan ? '$0' : formatPrice(plan.unit_price_usd)}
                </div>
                {!isFreePlan && (
                  <div className="flex flex-col leading-none text-xs font-light uppercase tracking-wide text-gray-500 pt-1">
                    <span>USD /</span>
                    <span>month</span>
                  </div>
                )}
              </div>
              {isFreePlan && (
                <div className="text-sm font-light text-gray-500">
                  forever free
                </div>
              )}
            </div>
          </div>

          {/* Features - Bullet Points */}
          <div className="flex-grow">
            <ul className="space-y-3">
              {getPlanFeatures(plan).map((feature, featureIndex) => (
                <li key={featureIndex} className="flex items-start text-sm text-gray-600">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-3 mt-1.5 flex-shrink-0"></div>
                  <span className="font-light">{feature}</span>
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
              onClick={(e) => {
                e.stopPropagation();
                if (isFreePlan) {
                  toast.info('You can continue exploring Therai for free anytime.');
                  return;
                }
                handleCheckout();
              }}
              disabled={isFreePlan ? false : loading || isProcessing}
              className={`w-full ${isFreePlan ? 'bg-gray-100 text-gray-500 border border-gray-200 cursor-default' : 'bg-gray-900 hover:bg-gray-800 text-white'} font-light py-3 rounded-full text-base transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50`}
            >
              {isProcessing && !isFreePlan ? 'Processing...' : getButtonText(plan)}
            </Button>
          </motion.div>

          {/* Security note */}
          <p className="text-xs text-gray-500 font-light">
            Secure payment powered by Stripe
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default SubscriptionCard;
