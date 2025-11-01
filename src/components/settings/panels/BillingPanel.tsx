import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Clock, ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CreditPurchaseModal } from '@/components/billing/CreditPurchaseModal';
import { CancelSubscriptionModal } from '@/components/billing/CancelSubscriptionModal';
import { AutoTopUpSettings } from '@/components/billing/AutoTopUpSettings';
import { useSettingsModal } from '@/contexts/SettingsModalContext';
import { getBillingMode } from '@/utils/billingMode';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

const CREDIT_PRICE = 0.10;

interface CreditData {
  credits: number;
  auto_topup_enabled: boolean;
  auto_topup_threshold: number;
  auto_topup_amount: number;
}

interface Transaction {
  id: string;
  type: string;
  credits: number;
  amount_usd: number | null;
  description: string | null;
  created_at: string;
}

interface SubscriptionData {
  subscription_active: boolean;
  subscription_status: string | null;
  subscription_plan: string | null;
  subscription_next_charge: string | null;
}

interface PlanData {
  id: string;
  name: string;
  description: string;
  unit_price_usd: number;
  stripe_price_id: string;
}

export const BillingPanel: React.FC = () => {
  const { user } = useAuth();
  const { closeSettings } = useSettingsModal();
  const billingMode = getBillingMode();
  const [loading, setLoading] = useState(true);
  const [creditData, setCreditData] = useState<CreditData | null>(null);
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [allPlans, setAllPlans] = useState<PlanData[]>([]);
  const [currentPlanData, setCurrentPlanData] = useState<PlanData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [upgradingToPlan, setUpgradingToPlan] = useState<string | null>(null);

  const fetchBillingData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      if (billingMode === 'CREDIT') {
      // Fetch credit balance and auto top-up settings
      const { data: creditsData, error: creditsError } = await supabase
        .from('user_credits')
        .select('credits, auto_topup_enabled, auto_topup_threshold, auto_topup_amount')
        .eq('user_id', user.id as any)
        .maybeSingle();

      if (creditsError && creditsError.code !== 'PGRST116') {
        throw creditsError;
      }

      setCreditData((creditsData as any) || {
        credits: 0,
        auto_topup_enabled: false,
        auto_topup_threshold: 7,
        auto_topup_amount: 34,
      });

      // Fetch transaction history
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', user.id as any)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!transactionsError && transactionsData) {
        setTransactions(transactionsData as any);
        }
      } else {
        // Fetch subscription data
        const { data: subData, error: subError } = await supabase
          .from('profiles')
          .select('subscription_active, subscription_status, subscription_plan, subscription_next_charge')
          .eq('id', user.id as any)
          .single();

        if (subError) {
          throw subError;
        }

        setSubscriptionData((subData || {
          subscription_active: false,
          subscription_status: null,
          subscription_plan: null,
          subscription_next_charge: null,
        }) as SubscriptionData);

        // Fetch all subscription plans
        const { data: plansData, error: plansError } = await supabase
          .from('price_list')
          .select('id, name, description, unit_price_usd, stripe_price_id')
          .eq('endpoint', 'subscription' as any)
          .order('unit_price_usd', { ascending: true });

        if (!plansError && plansData) {
          setAllPlans(plansData as PlanData[]);
          
          // Find current plan details
          if ((subData as any)?.subscription_plan) {
            const currentPlan = (plansData as any[]).find((p: any) => p.id === (subData as any).subscription_plan);
            setCurrentPlanData((currentPlan as any) || null);
          }
        }
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

    // Set up real-time subscription for credit balance updates (credit mode only)
    if (!user || billingMode !== 'CREDIT') return;

    const channel = supabase
      .channel('user_credits_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_credits',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Credit balance updated:', payload);
          // Update credit data with new balance
          if (payload.new && 'credits' in payload.new) {
            setCreditData((prev) => prev ? { ...prev, credits: (payload.new as any).credits } : null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, billingMode]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTransactionLabel = (transaction: Transaction) => {
    switch (transaction.type) {
      case 'purchase':
        return 'Credit Purchase';
      case 'auto_topup':
        return 'Auto Top-Up';
      case 'deduct':
        return transaction.description || 'Credit Used';
      case 'refund':
        return 'Refund';
      default:
        return transaction.type;
    }
  };

  const getTransactionSign = (transaction: Transaction) => {
    return ['purchase', 'auto_topup', 'refund'].includes(transaction.type) ? '+' : '-';
  };

  const handleManageSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      
      if (error) {
        toast.error('Failed to open customer portal');
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Customer portal error:', err);
      toast.error('Failed to open customer portal');
    }
  };

  const handleUpgrade = async (newPlanId: string, newStripePriceId: string) => {
    setUpgradingToPlan(newPlanId);
    try {
      const { data, error } = await supabase.functions.invoke('update-subscription', {
        body: { newPriceId: newStripePriceId }
      });

      if (error) {
        // Handle structured error responses
        const errorMessage = error.error?.message || error.message || 'Failed to upgrade subscription';
        const errorType = error.error?.type || error.type;
        
        if (errorType === 'CurrencyMismatchError') {
          toast.error('Currency mismatch: Cannot upgrade to a plan with a different currency. Please contact support.');
        } else {
          toast.error(errorMessage);
        }
        return;
      }

      toast.success('Subscription upgraded successfully!');
      // Refresh billing data
      await fetchBillingData();
    } catch (err) {
      console.error('Upgrade error:', err);
      toast.error('Failed to upgrade subscription');
    } finally {
      setUpgradingToPlan(null);
    }
  };

  // Get upgrade options (plans more expensive than current)
  const getUpgradeOptions = () => {
    if (!currentPlanData || allPlans.length === 0) return [];
    return allPlans.filter(plan => 
      plan.unit_price_usd > currentPlanData.unit_price_usd
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // Render subscription management UI
  if (billingMode === 'SUBSCRIPTION') {
    const isActive = subscriptionData?.subscription_active && 
                     ['active', 'trialing'].includes(subscriptionData?.subscription_status || '');
    const upgradeOptions = getUpgradeOptions();
    
    return (
      <div className="space-y-8">
        {/* Current Plan */}
        <div className="border-b pb-6">
          <h3 className="text-sm font-normal text-gray-600 mb-4">Current Plan</h3>
          {isActive && currentPlanData ? (
            <div className="bg-gray-50 rounded-xl p-6 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="text-xl font-light text-gray-900 mb-1">
                    {currentPlanData.name}
                  </div>
                  <div className="text-sm text-gray-600 font-light">
                    {currentPlanData.description}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-light text-gray-900">
                    ${currentPlanData.unit_price_usd}
                  </div>
                  <div className="text-xs text-gray-500">per month</div>
                </div>
              </div>
              {subscriptionData?.subscription_next_charge && (
                <div className="text-xs text-gray-500 pt-2 border-t border-gray-200">
                  Next billing: {formatDate(subscriptionData.subscription_next_charge)}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-600 font-light mb-4">No active subscription</div>
              <Button
                onClick={() => window.location.href = '/subscription-paywall'}
                className="bg-gray-900 hover:bg-gray-800 text-white rounded-full font-light px-8"
              >
                View Plans
              </Button>
            </div>
          )}
        </div>

        {/* Upgrade Options */}
        {isActive && upgradeOptions.length > 0 && (
          <div className="border-b pb-6">
            <h3 className="text-sm font-normal text-gray-600 mb-4">Upgrade Your Plan</h3>
            <div className="space-y-3">
              {upgradeOptions.map((plan) => (
                <div
                  key={plan.id}
                  className="border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-base font-medium text-gray-900 mb-1">
                        {plan.name}
                      </div>
                      <div className="text-sm text-gray-600 font-light">
                        {plan.description}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-xl font-light text-gray-900">
                          ${plan.unit_price_usd}
                        </div>
                        <div className="text-xs text-gray-500">per month</div>
                      </div>
                      <Button
                        onClick={() => handleUpgrade(plan.id, plan.stripe_price_id)}
                        disabled={upgradingToPlan === plan.id}
                        className="bg-gray-900 hover:bg-gray-800 text-white rounded-full font-light px-6"
                      >
                        {upgradingToPlan === plan.id ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Upgrading...
                          </>
                        ) : (
                          'Upgrade'
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 font-light mt-4">
              Upgrades are prorated. You'll be charged the difference for the remainder of your billing period.
            </p>
          </div>
        )}

        {/* Management Options */}
        {isActive && (
          <div className="flex items-center justify-between">
            <Button
              onClick={handleManageSubscription}
              variant="ghost"
              className="text-gray-600 hover:text-gray-900 font-light"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Manage Payment Methods
            </Button>
            <Button
              onClick={() => setShowCancelModal(true)}
              variant="ghost"
              className="text-gray-600 hover:text-gray-900 font-light"
            >
              Cancel Subscription
            </Button>
          </div>
        )}

        {/* Cancel Modal */}
        <CancelSubscriptionModal
          isOpen={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          onSuccess={() => {
            fetchBillingData();
            toast.success('Subscription cancelled');
          }}
          currentPeriodEnd={subscriptionData?.subscription_next_charge}
        />
      </div>
    );
  }

  // Render credit-based UI (existing)
  return (
    <div className="space-y-8">
      {/* Credit Balance */}
      <div className="text-center py-8 border-b">
        <h3 className="text-sm font-normal text-gray-600 mb-2">Available Credits</h3>
        <div className="text-5xl font-light text-gray-900 mb-2">
          {creditData?.credits || 0}
        </div>
        <div className="text-sm text-gray-600">
          ${((creditData?.credits || 0) * CREDIT_PRICE).toFixed(2)} USD
        </div>
        <Button
          onClick={() => setShowPurchaseModal(true)}
          className="mt-6 bg-gray-900 hover:bg-gray-800 text-white rounded-full font-light px-8"
        >
          <Plus className="w-4 h-4 mr-2" />
          Purchase Credits
        </Button>
      </div>

      {/* Pricing Info - Collapsible */}
      <div className="border-b pb-6">
        <Collapsible open={showPricing} onOpenChange={setShowPricing}>
          <CollapsibleTrigger className="w-full flex items-center justify-between text-left hover:bg-gray-50 -mx-2 px-2 py-2 rounded-lg transition-colors">
            <h3 className="text-sm font-normal text-gray-900">How Credits Work</h3>
            <span className="text-xs text-gray-500">
              {showPricing ? 'Hide' : 'Show'} breakdown
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-2 text-sm text-gray-600 mt-4">
              <div className="flex justify-between py-2">
                <span>Chat Message</span>
                <span className="text-gray-900">1 credit ($0.10)</span>
              </div>
              <div className="flex justify-between py-2">
                <span>Voice Conversation</span>
                <span className="text-gray-900">2 credits ($0.20)</span>
              </div>
              <div className="flex justify-between py-2">
                <span>Astro Data (Basic)</span>
                <span className="text-gray-900">1 credit ($0.10)</span>
              </div>
              <div className="flex justify-between py-2">
                <span>The Self Chart</span>
                <span className="text-gray-900">1 credit ($0.10)</span>
              </div>
              <div className="flex justify-between py-2">
                <span>Compatibility Chart</span>
                <span className="text-gray-900">2 credits ($0.20)</span>
              </div>
              <div className="flex justify-between py-2">
                <span>Report Generation</span>
                <span className="text-gray-900">2 credits ($0.20)</span>
              </div>
              <div className="flex justify-between py-2">
                <span>Compatibility + Report</span>
                <span className="text-gray-900">4 credits ($0.40)</span>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Auto Top-Up Settings */}
      <div className="border-b pb-6">
        <AutoTopUpSettings onSettingsChange={fetchBillingData} />
      </div>

      {/* Transaction History */}
      <div>
        <Collapsible open={showTransactions} onOpenChange={setShowTransactions}>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-3 hover:bg-gray-50 rounded-xl px-4 transition-colors">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-600" />
              <h3 className="text-sm font-normal text-gray-900">Transaction History</h3>
            </div>
            <span className="text-xs text-gray-600">
              {showTransactions ? 'Hide' : 'Show'} ({transactions.length})
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-4 space-y-2">
              {transactions.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-500">
                  No transactions yet
                </div>
              ) : (
                transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between py-3 px-4 hover:bg-gray-50 rounded-xl transition-colors"
                  >
                    <div className="flex-1">
                      <div className="text-sm text-gray-900">
                        {getTransactionLabel(transaction)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatDate(transaction.created_at)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-sm font-medium ${
                          getTransactionSign(transaction) === '+'
                            ? 'text-green-600'
                            : 'text-gray-900'
                        }`}
                      >
                        {getTransactionSign(transaction)}
                        {transaction.credits} credits
                      </div>
                      {transaction.amount_usd && (
                        <div className="text-xs text-gray-500 mt-1">
                          ${transaction.amount_usd.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Purchase Modal */}
      <CreditPurchaseModal
        isOpen={showPurchaseModal}
        onClose={() => {
          setShowPurchaseModal(false);
          fetchBillingData();
        }}
        onNavigateToCheckout={() => {
          // Close settings modal when navigating to checkout
          closeSettings();
        }}
      />
    </div>
  );
};
