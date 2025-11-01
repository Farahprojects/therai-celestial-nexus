import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface SubscriptionCardProps {
  plan: {
    id: string;
    name: string;
    description: string;
    unit_price_usd: number;
    product_code: string;
    stripe_price_id?: string;
  };
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

  // Determine plan tier label (Growth or Premium)
  const getPlanTier = (planId: string): 'Growth' | 'Premium' => {
    // Lower tier plans = Growth, Higher tier plans = Premium
    if (planId === '10_monthly' || planId.includes('growth') || planId.includes('starter')) {
      return 'Growth';
    }
    return 'Premium'; // Default to Premium for higher tier plans
  };

  const getPlanFeatures = (planId: string, planName: string) => {
    // Default features based on plan tier
    const growthFeatures = [
        'Unlimited messages per thread',
        'Priority support',
      'Advanced chart features',
      'AI insights and guidance'
    ];
    
    const premiumFeatures = [
      'Everything in Growth',
      '25+ threads per month',
      'Early access to new features',
      'Premium support',
      'Advanced analytics'
    ];

    // Check if it's a premium plan
    if (planId === '25_monthly' || planId === 'subscription_professional' || planName.toLowerCase().includes('premium')) {
      return premiumFeatures;
    }
    
    return growthFeatures;
  };

  const getButtonText = (planId: string): string => {
    const tier = getPlanTier(planId);
    return `Get ${tier}`;
  };

  const planTier = getPlanTier(plan.id);
  const isPopular = plan.id === '25_monthly' || plan.id === 'subscription_professional' || plan.name.toLowerCase().includes('premium');

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
              <div className="text-4xl font-light text-gray-900">
              {formatPrice(plan.unit_price_usd)}
              </div>
              {plan.product_code === 'subscription' && (
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
                handleCheckout();
              }}
              disabled={loading || isProcessing}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white font-light py-3 rounded-full text-base transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50"
            >
              {isProcessing ? 'Processing...' : getButtonText(plan.id)}
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
