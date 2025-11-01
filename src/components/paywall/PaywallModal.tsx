import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, Sparkles, MessageCircle, Mic, FileText } from 'lucide-react';
import { CreditPurchaseModal } from '@/components/billing/CreditPurchaseModal';
import SubscriptionCard from '@/components/paywall/SubscriptionCard';
import { supabase } from '@/integrations/supabase/client';
import { getBillingMode } from '@/utils/billingMode';

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface PricingPlan {
  id: string;
  name: string;
  description: string;
  unit_price_usd: number;
  product_code: string;
  stripe_price_id?: string;
}

const PaywallModal: React.FC<PaywallModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [showPurchaseModal, setShowPurchaseModal] = React.useState(false);
  const [subscriptionPlans, setSubscriptionPlans] = React.useState<PricingPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = React.useState(false);
  const [selectedPlanId, setSelectedPlanId] = React.useState<string | null>(null);
  const billingMode = getBillingMode();

  // Fetch subscription plans when modal opens and in subscription mode
  React.useEffect(() => {
    if (isOpen && billingMode === 'SUBSCRIPTION') {
      const fetchPlans = async () => {
        setLoadingPlans(true);
        try {
          const { data, error } = await supabase
            .from('price_list')
            .select('id, name, description, unit_price_usd, product_code, stripe_price_id')
            .eq('endpoint', 'subscription' as any)
            .order('unit_price_usd', { ascending: true });

          if (!error && data) {
            setSubscriptionPlans(data);
          }
        } catch (err) {
          console.error('Error fetching plans:', err);
        } finally {
          setLoadingPlans(false);
        }
      };

      fetchPlans();
    }
  }, [isOpen, billingMode]);

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-white z-50 flex flex-col"
        >
          {/* Header */}
          <header className="w-full py-4 flex justify-end items-center px-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </Button>
          </header>

          {/* Main Content */}
          <main className="flex-grow overflow-y-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="w-full max-w-6xl mx-auto">
              {/* Header Text */}
              <div className="text-center mb-12">
                <h1 className="text-5xl sm:text-6xl font-light text-gray-900 tracking-tight mb-6">
                  Experience The Full App
                </h1>
                <p className="text-xl text-gray-600 font-light max-w-2xl mx-auto">
                  Everything you need to explore your cosmic blueprint
                </p>
              </div>

              {billingMode === 'CREDIT' ? (
                <>
                  {/* Credit Package */}
              <div className="bg-gray-50 rounded-3xl p-10 mb-10 max-w-xl mx-auto">
                <div className="text-center mb-8">
                  <div className="text-6xl font-light text-gray-900 mb-2">$5</div>
                  <div className="text-base text-gray-500">50 credits • Never expires • Top up anytime</div>
                </div>

                <div className="space-y-5">
                  <div className="flex items-start gap-4">
                    <div className="bg-white rounded-full p-2.5 shadow-sm">
                      <FileText className="w-6 h-6 text-gray-700" />
                    </div>
                    <div className="flex-1 pt-1">
                      <div className="text-base font-medium text-gray-900 mb-1">
                        Generate your complete report
                      </div>
                      <div className="text-sm text-gray-600">
                        Full astrological sync and personalized insights
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="bg-white rounded-full p-2.5 shadow-sm">
                      <Mic className="w-6 h-6 text-gray-700" />
                    </div>
                    <div className="flex-1 pt-1">
                      <div className="text-base font-medium text-gray-900 mb-1">
                        20+ voice conversations
                      </div>
                      <div className="text-sm text-gray-600">
                        Natural, flowing dialogue with AI guidance
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="bg-white rounded-full p-2.5 shadow-sm">
                      <MessageCircle className="w-6 h-6 text-gray-700" />
                    </div>
                    <div className="flex-1 pt-1">
                      <div className="text-base font-medium text-gray-900 mb-1">
                        25+ chat messages
                      </div>
                      <div className="text-sm text-gray-600">
                        Deep dive into any aspect of your chart
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="bg-white rounded-full p-2.5 shadow-sm">
                      <Sparkles className="w-6 h-6 text-gray-700" />
                    </div>
                    <div className="flex-1 pt-1">
                      <div className="text-base font-medium text-gray-900 mb-1">
                        AI insights that create momentum
                      </div>
                      <div className="text-sm text-gray-600">
                        Help self-discovery and growth
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div className="text-center">
                <Button
                  onClick={() => setShowPurchaseModal(true)}
                  className="bg-gray-900 text-white hover:bg-gray-800 rounded-full px-16 py-7 text-xl font-light shadow-lg hover:shadow-xl transition-shadow"
                >
                  Get Started - $5
                </Button>
                <p className="text-sm text-gray-500 mt-6 font-light">
                  No subscription • No recurring charges • Just pure exploration
                </p>
              </div>
                </>
              ) : (
                <>
                  {/* Subscription Plans */}
                  {loadingPlans ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
                      {subscriptionPlans.map((plan, index) => (
                        <SubscriptionCard
                          key={plan.id}
                          plan={plan}
                          index={index}
                          isSelected={selectedPlanId === plan.id}
                          onSelect={setSelectedPlanId}
                          loading={false}
                        />
                      ))}
                    </div>
                  )}

                  <div className="text-center">
                    <p className="text-sm text-gray-500 mt-6 font-light">
                      Flexible plans • Cancel anytime • Secure payment via Stripe
                    </p>
                  </div>
                </>
              )}
            </div>
          </main>

          {/* Footer */}
          <footer className="py-4 text-center text-sm text-gray-400 font-light border-t border-gray-100">
            <div className="max-w-4xl mx-auto px-4">
              <p className="text-xs">
                {billingMode === 'CREDIT' 
                  ? 'Secure payment via Stripe • Credits never expire • Top up anytime'
                  : 'Secure payment via Stripe • Cancel anytime • No commitments'}
              </p>
            </div>
          </footer>
        </motion.div>
      </AnimatePresence>

      {billingMode === 'CREDIT' && (
      <CreditPurchaseModal
        isOpen={showPurchaseModal}
        onClose={() => {
          setShowPurchaseModal(false);
          onSuccess?.();
          onClose();
        }}
      />
      )}
    </>
  );
};

export default PaywallModal;
