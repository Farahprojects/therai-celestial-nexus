import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, Sparkles, MessageCircle, Mic, FileText } from 'lucide-react';
import SubscriptionCard from '@/components/paywall/SubscriptionCard';
import { supabase } from '@/integrations/supabase/client';

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

const isPricingPlan = (value: unknown): value is PricingPlan => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PricingPlan>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.description === 'string' &&
    typeof candidate.unit_price_usd === 'number' &&
    typeof candidate.product_code === 'string'
  );
};

const PaywallModal: React.FC<PaywallModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [subscriptionPlans, setSubscriptionPlans] = React.useState<PricingPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = React.useState(false);
  const [selectedPlanId, setSelectedPlanId] = React.useState<string | null>(null);

  // Fetch subscription plans when modal opens
  React.useEffect(() => {
    if (isOpen) {
      const fetchPlans = async () => {
        setLoadingPlans(true);
        try {
          const { data, error } = await supabase
            .from('price_list')
            .select('id, name, description, unit_price_usd, product_code, stripe_price_id')
            .eq('endpoint' as never, 'subscription')
            .order('unit_price_usd', { ascending: true });

          if (!error && data) {
            const normalizedPlans: PricingPlan[] = [];

            if (Array.isArray(data)) {
              for (const plan of data) {
                if (isPricingPlan(plan)) {
                  const typedPlan: PricingPlan = plan;
                  normalizedPlans.push(typedPlan);
                }
              }
            }

            setSubscriptionPlans(normalizedPlans);
          }
        } catch (err) {
          console.error('Error fetching plans:', err);
        } finally {
          setLoadingPlans(false);
        }
      };

      fetchPlans();
    }
  }, [isOpen]);

  const handleStarterCheckout = React.useCallback(() => {
    const url = new URL(window.location.origin + '/stripe');
    url.searchParams.set('planId', 'starter-plan');
    window.location.href = url.toString();
  }, []);

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

              {/* Subscription Plans */}
              <div className="max-w-6xl mx-auto px-4 mb-12">
                {loadingPlans ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
                  </div>
                ) : subscriptionPlans.length > 0 ? (
                  <>
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
                    <div className="text-center">
                      <p className="text-sm text-gray-500 mt-6 font-light">
                        Flexible plans • Cancel anytime • Secure payment via Stripe
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-center mb-8">
                      <div className="text-6xl font-light text-gray-900 mb-2">$5</div>
                      <div className="text-base text-gray-500">
                        50 credits • Never expires • Top up anytime
                      </div>
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

                    <div className="text-center mt-10">
                      <Button
                        onClick={handleStarterCheckout}
                        className="bg-gray-900 text-white hover:bg-gray-800 rounded-full px-16 py-7 text-xl font-light shadow-lg hover:shadow-xl transition-shadow"
                      >
                        Get Started - $5
                      </Button>
                      <p className="text-sm text-gray-500 mt-6 font-light">
                        No subscription • No recurring charges • Just pure exploration
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </main>

          {/* Footer */}
          <footer className="py-4 text-center text-sm text-gray-400 font-light border-t border-gray-100">
            <div className="max-w-4xl mx-auto px-4">
              <p className="text-xs">
                Secure payment via Stripe • Cancel anytime • No commitments
              </p>
            </div>
          </footer>
        </motion.div>
      </AnimatePresence>
    </>
  );
};

export default PaywallModal;
