import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CancelSubscriptionModal } from '@/components/billing/CancelSubscriptionModal';
import { useSettingsModal } from '@/contexts/SettingsModalContext';
import type { Tables } from '@/integrations/supabase/types';

interface SubscriptionData {
  subscription_active: boolean;
  subscription_plan: string | null;
  subscription_status: string | null;
  subscription_end_date: string | null;
}

export const BillingPanel = () => {
  const { user } = useAuth();
  const { closeModal } = useSettingsModal();
  const [loading, setLoading] = useState(true);
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);

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
        .select('subscription_active, subscription_plan, subscription_status, subscription_end_date')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      setSubscriptionData({
        subscription_active: data.subscription_active || false,
        subscription_plan: data.subscription_plan || null,
        subscription_status: data.subscription_status || null,
        subscription_end_date: data.subscription_end_date || null,
      });
    } catch (error) {
      console.error('Error fetching billing data:', error);
      toast.error('Failed to load billing information');
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { 
          return_url: window.location.origin + '/settings?tab=billing',
          mode: 'customer_portal' 
        }
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error opening customer portal:', error);
      toast.error('Failed to open billing portal');
    }
  };

  const handleUpgrade = () => {
    closeModal();
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

  return (
    <div className="space-y-6">
      {/* Subscription Status */}
      <div className="border-b pb-6">
        <h3 className="text-lg font-light text-gray-900 mb-4">Subscription</h3>
        
        <div className="bg-gray-50 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500 mb-1">Status</div>
              <div className="text-lg font-medium text-gray-900">
                {isActive ? (
                  <span className="text-green-600">Active</span>
                ) : (
                  <span className="text-gray-400">No active subscription</span>
                )}
              </div>
            </div>
            
            {subscriptionData?.subscription_plan && (
              <div className="text-right">
                <div className="text-sm text-gray-500 mb-1">Plan</div>
                <div className="text-lg font-medium text-gray-900 capitalize">
                  {subscriptionData.subscription_plan === '10_monthly' ? 'Growth' : 
                   subscriptionData.subscription_plan === '18_monthly' ? 'Premium' : 
                   subscriptionData.subscription_plan}
                </div>
              </div>
            )}
          </div>

          {subscriptionData?.subscription_end_date && (
            <div>
              <div className="text-sm text-gray-500 mb-1">
                {subscriptionData.subscription_status === 'active' ? 'Renews on' : 'Ends on'}
              </div>
              <div className="text-sm text-gray-900">
                {new Date(subscriptionData.subscription_end_date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-3">
          {isActive ? (
            <>
              <Button
                onClick={handleManageSubscription}
                variant="outline"
                className="flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Manage Subscription
              </Button>
              {subscriptionData?.subscription_plan === '10_monthly' && (
                <Button
                  onClick={handleUpgrade}
                  className="bg-gray-900 text-white hover:bg-gray-800"
                >
                  Upgrade to Premium
                </Button>
              )}
            </>
          ) : (
            <Button
              onClick={handleUpgrade}
              className="bg-gray-900 text-white hover:bg-gray-800"
            >
              Subscribe Now
            </Button>
          )}
        </div>
      </div>

      {/* Cancel Subscription Modal */}
      <CancelSubscriptionModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onSuccess={fetchBillingData}
      />
    </div>
  );
};
