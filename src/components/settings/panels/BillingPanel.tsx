import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, Info } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CancelSubscriptionModal } from '@/components/billing/CancelSubscriptionModal';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface SubscriptionData {
  status: string | null;
  plan: string | null;
  nextCharge: string | null;
  active: boolean | null;
  subscriptionId: string | null;
}

interface Plan {
  id: string;
  name: string;
  description: string | null;
  unit_price_usd: number;
  stripe_price_id: string | null;
}

export const BillingPanel: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
  const [updatingPlanId, setUpdatingPlanId] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedPlanForInfo, setSelectedPlanForInfo] = useState<Plan | null>(null);

  const fetchBillingData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch subscription data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('subscription_status, subscription_plan, subscription_next_charge, subscription_active, stripe_subscription_id')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      setSubscription({
        status: profileData?.subscription_status || null,
        plan: profileData?.subscription_plan || null,
        nextCharge: profileData?.subscription_next_charge || null,
        active: profileData?.subscription_active || null,
        subscriptionId: profileData?.stripe_subscription_id || null,
      });

      // Fetch available plans
      const { data: plansData, error: plansError } = await supabase
        .from('price_list')
        .select('*')
        .eq('endpoint', 'subscription');

      if (!plansError && plansData) {
        setAvailablePlans(plansData);
      }
    } catch (error) {
      console.error('Error fetching billing data:', error);
      toast.error('Failed to load billing information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingData();
  }, [user]);

  const handleUpdatePlan = async (plan: Plan) => {
    if (!plan.stripe_price_id) {
      toast.error('Invalid plan configuration');
      return;
    }

    setUpdatingPlanId(plan.id);
    try {
      const { data, error } = await supabase.functions.invoke('update-subscription', {
        body: { newPriceId: plan.stripe_price_id },
      });

      if (error) {
        toast.error('Failed to update subscription');
        return;
      }

      toast.success('Subscription updated successfully');
      await fetchBillingData(); // Refresh billing data
    } catch (err) {
      console.error('Update subscription error:', err);
      toast.error('Failed to update subscription');
    } finally {
      setUpdatingPlanId(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const getPlanDisplayName = (planName: string | null) => {
    if (!planName) return 'No plan';
    // Map plan names to UI-friendly names
    if (planName === 'Growth' || planName.includes('15')) return 'Growth';
    if (planName === 'Premium' || planName.includes('25')) return 'Premium';
    if (planName === 'Test Plan' || planName.includes('Test')) return 'Test';
    if (planName === 'Therai Astro data' || planName.includes('Astro')) return 'Therai Astro data';
    return planName;
  };

  const openCustomerPortal = async () => {
    setUpdatingPlanId('portal');
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      
      if (error) throw error;
      
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error opening customer portal:', error);
      toast.error('Failed to open payment portal');
    } finally {
      setUpdatingPlanId(null);
    }
  };

  const handleResubscribe = async (plan: Plan) => {
    if (!plan.stripe_price_id) {
      toast.error('Invalid plan configuration');
      return;
    }

    setUpdatingPlanId(plan.id);
    try {
      const { data, error } = await supabase.functions.invoke('create-subscription-checkout', {
        body: {
          priceId: plan.id,
          embedded: false,
        },
      });

      if (error) {
        toast.error('Failed to start checkout');
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Resubscribe error:', err);
      toast.error('Failed to start checkout');
    } finally {
      setUpdatingPlanId(null);
    }
  };

  const isSubscriptionActive = subscription?.active && ['active', 'trialing'].includes(subscription?.status || '');
  const canChangePlan = isSubscriptionActive && subscription?.status !== 'past_due';
  const isCanceled = subscription?.status === 'canceled' || !subscription?.active;

  return (
    <div className="space-y-6">
      {/* Payment Failure Alert for Past Due */}
      {subscription?.status === 'past_due' && (
        <div className="border-2 border-red-400 bg-red-50 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-900 mb-1">Payment Failed</h3>
              <p className="text-sm text-gray-700 mb-3">
                Your last payment was declined. Update your payment method to restore access to your subscription.
              </p>
              <Button
                onClick={openCustomerPortal}
                disabled={updatingPlanId === 'portal'}
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white rounded-full font-light px-6"
              >
                {updatingPlanId === 'portal' ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Opening...
                  </>
                ) : (
                  'Update Payment Method'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Current Subscription Info */}
      {isSubscriptionActive && (
        <div className="border-b pb-6">
          <h3 className="text-sm font-normal text-gray-900 mb-4">Current Subscription</h3>
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-gray-800">Plan</span>
            <span className="text-sm text-gray-900">{getPlanDisplayName(subscription?.plan)}</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-gray-800">Next Billing Date</span>
            <span className="text-sm text-gray-900">{formatDate(subscription?.nextCharge)}</span>
          </div>
        </div>
      )}

      {/* Available Plans */}
      <div className="border-b pb-6">
        <h3 className="text-sm font-normal text-gray-900 mb-4">
          {isCanceled ? 'Choose Your Plan' : 'Plans'}
        </h3>
        
        {loading ? (
          <div className="space-y-3">
            <div className="h-12 bg-gray-200 rounded animate-pulse" />
            <div className="h-12 bg-gray-200 rounded animate-pulse" />
          </div>
        ) : (
          <div className="space-y-3">
            {availablePlans
              .filter((plan) => {
                // Hide current plan if user has active subscription
                // Compare by plan ID, not name
                if (isSubscriptionActive && !isCanceled) {
                  const isCurrentPlan = subscription?.plan === plan.id;
                  return !isCurrentPlan;
                }
                return true;
              })
              .map((plan) => {
                const isUpdating = updatingPlanId === plan.id;
                
                // Find current plan to compare prices (by ID)
                const currentPlan = availablePlans.find(
                  p => subscription?.plan === p.id
                );
                const isUpgrade = currentPlan ? plan.unit_price_usd > currentPlan.unit_price_usd : true;
                const buttonText = isSubscriptionActive 
                  ? (isUpgrade ? 'Upgrade' : 'Downgrade')
                  : 'Subscribe';

                return (
                  <div
                    key={plan.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-900">{plan.name}</span>
                      <span className="text-sm text-gray-600">
                        ${plan.unit_price_usd.toFixed(0)}
                        {plan.id.includes('yearly') || plan.id.includes('astro') ? '/year' : '/month'}
                      </span>
                      <button
                        onClick={() => setSelectedPlanForInfo(plan)}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                        title="View plan details"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <Button
                      onClick={() => isSubscriptionActive ? handleUpdatePlan(plan) : handleResubscribe(plan)}
                      disabled={isUpdating}
                      size="sm"
                      className="bg-gray-900 hover:bg-gray-800 text-white rounded-full font-light px-6"
                    >
                      {isUpdating ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        buttonText
                      )}
                    </Button>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Cancel Subscription */}
      {isSubscriptionActive && (
        <div>
          <div className="flex items-center justify-between py-3">
            <h3 className="text-sm font-normal text-gray-900">Cancel Subscription</h3>
            <Button
              onClick={() => setShowCancelModal(true)}
              size="sm"
              variant="outline"
              className="rounded-full border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 font-light px-6"
            >
              Cancel Plan
            </Button>
          </div>
        </div>
      )}

      {/* Cancel Subscription Modal */}
      <CancelSubscriptionModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onSuccess={fetchBillingData}
        currentPeriodEnd={subscription?.nextCharge}
      />

      {/* Plan Details Sheet */}
      <Sheet open={!!selectedPlanForInfo} onOpenChange={(open) => !open && setSelectedPlanForInfo(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="text-xl font-light">
              {selectedPlanForInfo?.name} Plan
            </SheetTitle>
          </SheetHeader>

          {selectedPlanForInfo && (
            <div className="mt-6 space-y-6">
              {/* Price */}
              <div className="text-center py-6 border-b">
                <div className="text-4xl font-light text-gray-900">
                  ${selectedPlanForInfo.unit_price_usd.toFixed(0)}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {selectedPlanForInfo.id.includes('yearly') || selectedPlanForInfo.id.includes('astro') ? 'per year' : 'per month'}
                </div>
              </div>

              {/* Description */}
              {selectedPlanForInfo.description && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-900">What's included</h3>
                  <p className="text-sm text-gray-600">{selectedPlanForInfo.description}</p>
                </div>
              )}

              {/* Features based on plan */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-900">Features</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  {selectedPlanForInfo.id === 'test_50c' && (
                    <>
                      <li>• Test plan for development</li>
                      <li>• Limited features</li>
                    </>
                  )}
                  {selectedPlanForInfo.id === '10_monthly' && (
                    <>
                      <li>• Unlimited text conversations</li>
                      <li>• Unlimited astrology reports</li>
                      <li>• All chart types</li>
                      <li>• Priority support</li>
                    </>
                  )}
                  {selectedPlanForInfo.id === '18_monthly' && (
                    <>
                      <li>• Everything in Growth plan</li>
                      <li>• Voice conversation mode</li>
                      <li>• Advanced AI insights</li>
                      <li>• Access to all features</li>
                      <li>• Premium support</li>
                    </>
                  )}
                </ul>
              </div>

              {/* CTA */}
              <div className="pt-6">
                <Button
                  onClick={() => {
                    setSelectedPlanForInfo(null);
                    if (isSubscriptionActive) {
                      handleUpdatePlan(selectedPlanForInfo);
                    } else {
                      handleResubscribe(selectedPlanForInfo);
                    }
                  }}
                  disabled={updatingPlanId === selectedPlanForInfo.id}
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white rounded-full font-light py-6"
                >
                  {updatingPlanId === selectedPlanForInfo.id ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      {isSubscriptionActive ? 'Switch to this plan' : 'Subscribe now'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

