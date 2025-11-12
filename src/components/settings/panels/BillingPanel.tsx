import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSettingsModal } from '@/contexts/SettingsModalContext';
import { cn } from '@/lib/utils';

interface SubscriptionData {
  subscription_active: boolean;
  subscription_plan: string | null;
  subscription_status: string | null;
  subscription_next_charge: string | null;
}

const GROWTH_HIGHLIGHTS = [
  'Unlimited AI conversations',
  'Together Mode (2-person sessions)',
  'Premium HD Voice (10 min/month)',
  'Image generation (3/day)',
  'Unlimited folders & sharing'
];

export const BillingPanel = () => {
  const { user } = useAuth();
  const { closeSettings } = useSettingsModal();
  const [loading, setLoading] = useState(true);
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [manageLoading, setManageLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchBillingData();
    }
  }, [user]);

  const fetchBillingData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('subscription_active, subscription_plan, subscription_status, subscription_next_charge')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      console.log('Billing data fetched:', data);

      setSubscriptionData({
        subscription_active: data.subscription_active || false,
        subscription_plan: data.subscription_plan || null,
        subscription_status: data.subscription_status || null,
        subscription_next_charge: data.subscription_next_charge || null,
      });
    } catch (error) {
      console.error('Error fetching billing data:', error);
      toast.error('Failed to load billing information');
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    if (manageLoading) return;
    console.log('handleManageSubscription clicked');
    try {
      setManageLoading(true);

      const { data, error } = await supabase.functions.invoke('customer-portal', {
        body: {}
      });

      console.log('Portal response:', { data, error });

      if (error) {
        console.error('Portal error:', error);
        throw error;
      }

      if (!data?.url) {
        throw new Error('No portal URL received');
      }

      console.log('Redirecting to:', data.url);
      window.location.href = data.url;
    } catch (error) {
      console.error('Error opening customer portal:', error);
      toast.error('Failed to open billing portal');
      setManageLoading(false);
    }
  };

  const handleUpgrade = () => {
    if (upgradeLoading) return;
    setUpgradeLoading(true);
    closeSettings();
    window.location.href = '/subscription-paywall';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const isActive = subscriptionData?.subscription_active && 
                  ['active', 'trialing'].includes(subscriptionData?.subscription_status || '');

  const getPlanName = (planId: string | null) => {
    if (planId === '8_monthly') return 'Plus';
    if (planId === '10_monthly') return 'Growth';
    if (planId === '18_monthly' || planId === '25_monthly') return 'Premium';
    return planId || 'Free';
  };

  return (
    <div className="space-y-8">
      {/* Header with Upgrade Button */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h3 className="text-2xl font-light italic text-gray-900">Billing</h3>
          {!isActive && (
            <p className="text-sm font-light text-gray-600">Upgrade to Therai growth plan</p>
          )}
        </div>
        
        {!isActive && (
          <Button
            onClick={handleUpgrade}
            aria-pressed={upgradeLoading}
            className={cn(
              'bg-gray-900 hover:bg-gray-800 text-white font-light px-6 py-2 rounded-full transition-all duration-200',
              upgradeLoading && 'translate-y-[2px] scale-[0.98] shadow-inner pointer-events-none cursor-wait'
            )}
          >
            Upgrade
          </Button>
        )}
      </div>

      {/* Free Plan - Show Growth Highlights */}
      {!isActive && (
        <div className="space-y-6">
          <div className="space-y-2">
            <h4 className="text-lg font-light text-gray-900">Growth Plan Includes</h4>
            <p className="text-sm font-light text-gray-500">Everything you need to unlock your full potential</p>
          </div>
          
          <ul className="space-y-3">
            {GROWTH_HIGHLIGHTS.map((highlight, index) => (
              <li key={index} className="flex items-start text-sm font-light text-gray-700">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-3 mt-2 flex-shrink-0"></div>
                <span>{highlight}</span>
              </li>
            ))}
          </ul>

          <div className="pt-4">
            <p className="text-sm font-light text-gray-600">Start your subscription and unlock all Growth features</p>
          </div>
        </div>
      )}

      {/* Active Subscription */}
      {isActive && (
        <div className="space-y-8">
          {/* Plan and Billing Info */}
          <div className="space-y-6">
            <div className="flex items-baseline gap-3">
              <span className="text-sm font-light text-gray-500">Current Plan:</span>
              <span className="text-xl font-light text-gray-900">
                {getPlanName(subscriptionData?.subscription_plan)}
              </span>
            </div>

            {subscriptionData?.subscription_next_charge && (
              <div className="flex items-baseline gap-3">
                <span className="text-sm font-light text-gray-500">
                  {subscriptionData.subscription_status === 'active' ? 'Next billing date:' : 'Ends on:'}
                </span>
                <span className="text-base font-light text-gray-900">
                  {new Date(subscriptionData.subscription_next_charge).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons - Stacked with aligned buttons */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-light text-gray-600 flex-1">Update payment method, view invoices, or cancel</p>
              <Button
                onClick={handleManageSubscription}
                aria-pressed={manageLoading}
                className={cn(
                  'bg-gray-900 hover:bg-gray-800 text-white font-light px-6 py-2 rounded-full transition-all duration-200 flex-shrink-0',
                  manageLoading && 'translate-y-[2px] scale-[0.98] shadow-inner pointer-events-none cursor-wait'
                )}
              >
                Manage
              </Button>
            </div>
            
            {subscriptionData?.subscription_plan === '10_monthly' && (
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-light text-gray-600 flex-1">Get unlimited voice and image generation</p>
                <Button
                  onClick={handleUpgrade}
                  aria-pressed={upgradeLoading}
                  className={cn(
                    'bg-gray-900 hover:bg-gray-800 text-white font-light px-6 py-2 rounded-full transition-all duration-200 flex-shrink-0',
                    upgradeLoading && 'translate-y-[2px] scale-[0.98] shadow-inner pointer-events-none cursor-wait'
                  )}
                >
                  Upgrade
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
