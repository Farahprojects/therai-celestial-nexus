import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { supabase } from '@/integrations/supabase/client';
import Logo from '@/components/Logo';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard, FileText, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { CancelSubscriptionModal } from '@/components/billing/CancelSubscriptionModal';
import { safeConsoleError } from '@/utils/safe-logging';
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string;
const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : Promise.resolve(null);

interface PaymentMethod {
  id: string;
  type: string;
  card: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  } | null;
  billing_details: Record<string, unknown>;
  is_default: boolean;
}

interface Invoice {
  id: string;
  number: string;
  amount_paid: number;
  currency: string;
  status: string;
  created: number;
  hosted_invoice_url: string;
  invoice_pdf: string;
  period_start: number;
  period_end: number;
  description: string;
}

const PaymentMethodForm: React.FC<{
  clientSecret: string;
  onSuccess: () => void;
  onCancel: () => void;
}> = ({ clientSecret, onSuccess, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        toast.error(submitError.message);
        setLoading(false);
        return;
      }

      const { error, setupIntent } = await stripe.confirmSetup({
        elements,
        clientSecret,
        redirect: 'if_required',
      });

      if (error) {
        toast.error(error.message || 'Failed to save payment method');
      } else if (setupIntent && setupIntent.status === 'succeeded') {
        toast.success('Payment method updated successfully');
        onSuccess();
      }
    } catch (err) {
      safeConsoleError('Payment method update error:', err);
      toast.error('Failed to update payment method');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={loading || !stripe}
          className="bg-[#635BFF] hover:bg-[#4F46E5] text-white rounded-full font-light px-6"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Payment Method'
          )}
        </Button>
        <Button
          type="button"
          onClick={onCancel}
          variant="ghost"
          className="font-light"
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
};

const SubscriptionManagementPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [subscriptionData, setSubscriptionData] = useState<{ subscription_status?: string; subscription_next_charge?: string } | null>(null);
  const [showAddPaymentMethod, setShowAddPaymentMethod] = useState(false);
  const [setupIntentClientSecret, setSetupIntentClientSecret] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Fetch subscription data
      const { data: subData } = await supabase
        .from('profiles')
        .select('subscription_active, subscription_status, subscription_plan, subscription_next_charge')
        .eq('id', user.id)
        .single();

      setSubscriptionData(subData);

      // Fetch payment methods
      const { data: pmData, error: pmError } = await supabase.functions.invoke('get-payment-methods');
      if (!pmError && pmData?.paymentMethods) {
        setPaymentMethods(pmData.paymentMethods);
      }

      // Fetch invoices
      const { data: invoiceData, error: invoiceError } = await supabase.functions.invoke('get-invoices');
      if (!invoiceError && invoiceData?.invoices) {
        setInvoices(invoiceData.invoices);
      }
    } catch (err) {
      safeConsoleError('Error fetching data:', err);
      toast.error('Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user, fetchData]);

  const handleAddPaymentMethod = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('create-setup-intent');
      if (error) {
        toast.error('Failed to initialize payment form');
        return;
      }

      if (data?.clientSecret) {
        setSetupIntentClientSecret(data.clientSecret);
        setShowAddPaymentMethod(true);
      }
    } catch (err) {
      safeConsoleError('Error creating setup intent:', err);
      toast.error('Failed to initialize payment form');
    }
  };

  const handlePaymentMethodAdded = async () => {
    setShowAddPaymentMethod(false);
    setSetupIntentClientSecret(null);

    // Wait a moment for webhook to process, then refresh
    setTimeout(() => {
      fetchData();
    }, 1000);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const getCardBrandIcon = (brand: string) => {
    const brandLower = brand.toLowerCase();
    if (brandLower.includes('visa')) return '💳';
    if (brandLower.includes('mastercard')) return '💳';
    if (brandLower.includes('amex')) return '💳';
    return '💳';
  };

  const options = useMemo(
    () => (setupIntentClientSecret ? { clientSecret: setupIntentClientSecret } : undefined),
    [setupIntentClientSecret]
  );

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      {/* Left Sidebar - Same as EmbeddedCheckout */}
      <div className="p-10 flex flex-col justify-between bg-white">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="mb-4">
            <a
              href="https://therai.co/therai"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors"
            >
              ← Return to Therai.co
            </a>
          </div>
          <div className="flex justify-center mb-6">
            <Logo size="lg" asLink={false} />
          </div>
          <h1 className="text-4xl font-light">Therai <span className="italic">Subscription Management</span></h1>
          <div className="text-xs text-gray-400 mt-6">
            <div>Therai</div>
            <div>ACN 676 280 229</div>
          </div>
        </div>
        <div className="max-w-md w-full space-y-4 text-center text-sm text-gray-500">
          <div className="flex items-center justify-center space-x-2">
            <span>Powered by</span>
            <a href="https://stripe.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 font-medium transition-colors">Stripe</a>
          </div>
          <div className="space-x-4">
            <a href="https://stripe.com/billing" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 transition-colors underline">Learn about Stripe Billing</a>
            <a href="https://stripe.com/legal/terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 transition-colors underline">Terms</a>
            <a href="https://stripe.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 transition-colors underline">Privacy</a>
          </div>
        </div>
      </div>

      {/* Right Side - Subscription Management */}
      <div className="p-10 bg-gray-50 flex items-start justify-center overflow-y-auto">
        <div className="max-w-2xl w-full space-y-8">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              {/* Subscription Status */}
              {subscriptionData?.subscription_active && (
                <div className="bg-white rounded-xl p-6 space-y-4">
                  <h2 className="text-xl font-light text-gray-900">Current Subscription</h2>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Status</span>
                      <span className="text-sm font-medium text-gray-900 capitalize">
                        {subscriptionData.subscription_status}
                      </span>
                    </div>
                    {subscriptionData.subscription_next_charge && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Next billing date</span>
                        <span className="text-sm text-gray-900">
                          {formatDate(new Date(subscriptionData.subscription_next_charge).getTime() / 1000)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Payment Methods */}
              <div className="bg-white rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-light text-gray-900 flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Payment Methods
                  </h2>
                  {!showAddPaymentMethod && (
                    <Button
                      onClick={handleAddPaymentMethod}
                      className="bg-[#635BFF] hover:bg-[#4F46E5] text-white rounded-full font-light px-4 text-sm"
                    >
                      Add Payment Method
                    </Button>
                  )}
                </div>

                {showAddPaymentMethod && setupIntentClientSecret ? (
                  <div className="border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-gray-900">Add New Payment Method</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowAddPaymentMethod(false);
                          setSetupIntentClientSecret(null);
                        }}
                        className="h-6 w-6 p-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    {STRIPE_PUBLISHABLE_KEY && stripePromise && (
                      <Elements stripe={stripePromise} options={options as Record<string, unknown>}>
                        <PaymentMethodForm
                          clientSecret={setupIntentClientSecret}
                          onSuccess={handlePaymentMethodAdded}
                          onCancel={() => {
                            setShowAddPaymentMethod(false);
                            setSetupIntentClientSecret(null);
                          }}
                        />
                      </Elements>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {paymentMethods.length === 0 ? (
                      <div className="text-center py-8 text-sm text-gray-500">
                        No payment methods on file
                      </div>
                    ) : (
                      paymentMethods.map((pm) => (
                        <div
                          key={pm.id}
                          className="flex items-center justify-between p-4 border border-gray-200 rounded-xl"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{getCardBrandIcon(pm.card?.brand || '')}</span>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {pm.card?.brand?.toUpperCase() || 'Card'} •••• {pm.card?.last4}
                              </div>
                              <div className="text-xs text-gray-500">
                                Expires {pm.card?.exp_month}/{pm.card?.exp_year}
                              </div>
                            </div>
                          </div>
                          {pm.is_default && (
                            <div className="flex items-center gap-1 text-xs text-gray-600">
                              <Check className="w-4 h-4" />
                              Default
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Invoice History */}
              <div className="bg-white rounded-xl p-6 space-y-4">
                <h2 className="text-xl font-light text-gray-900 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Invoice History
                </h2>
                <div className="space-y-3">
                  {invoices.length === 0 ? (
                    <div className="text-center py-8 text-sm text-gray-500">
                      No invoices yet
                    </div>
                  ) : (
                    invoices.map((invoice) => (
                      <div
                        key={invoice.id}
                        className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-gray-300 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {invoice.description}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {formatDate(invoice.created)} • {invoice.number}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-sm font-medium text-gray-900">
                              {formatAmount(invoice.amount_paid, invoice.currency)}
                            </div>
                            <div className="text-xs text-gray-500 capitalize">{invoice.status}</div>
                          </div>
                          {invoice.hosted_invoice_url && (
                            <a
                              href={invoice.hosted_invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-[#635BFF] hover:text-[#4F46E5] underline"
                            >
                              View
                            </a>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Cancel Subscription */}
              {subscriptionData?.subscription_active && (
                <div className="bg-white rounded-xl p-6">
                  <h2 className="text-xl font-light text-gray-900 mb-4">Subscription Management</h2>
                  <Button
                    onClick={() => setShowCancelModal(true)}
                    variant="ghost"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 font-light"
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
                  fetchData();
                  toast.success('Subscription cancelled');
                }}
                currentPeriodEnd={subscriptionData?.subscription_next_charge}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionManagementPage;

