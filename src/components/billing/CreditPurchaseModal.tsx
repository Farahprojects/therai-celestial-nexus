import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Loader2, Sparkles, MessageCircle, Mic, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getCheckoutFlowType } from '@/utils/deviceDetection';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface CreditPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAutoTopup?: boolean;
  onNavigateToCheckout?: () => void;
}

const CREDIT_PRICE = 0.10;
const MIN_PURCHASE = 5;

export const CreditPurchaseModal: React.FC<CreditPurchaseModalProps> = ({
  isOpen,
  onClose,
  isAutoTopup = false,
  onNavigateToCheckout,
}) => {
  const navigate = useNavigate();
  const [showCustom, setShowCustom] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const STARTER_PACKAGE = { amount: 5, credits: Math.floor(5 / CREDIT_PRICE) };

  const calculateCredits = (amount: number) => Math.floor(amount / CREDIT_PRICE);

  const handlePurchase = async (amountUsd: number, credits: number) => {
    setIsProcessing(true);
    try {
      const flowType = getCheckoutFlowType();
      
      const { data, error } = await supabase.functions.invoke('credit-topup', {
        body: {
          amount_usd: amountUsd,
          credits: credits,
          is_auto_topup: isAutoTopup,
          flow_type: flowType,
        },
      });

      if (error) {
        toast.error('Failed to start checkout');
        setIsProcessing(false);
        return;
      }

      // Mobile: Redirect to Stripe hosted checkout
      if (flowType === 'hosted' && data?.url) {
        window.location.href = data.url;
        return;
      }

      // Desktop: Navigate to in-app checkout with client secret
      if (flowType === 'payment_element' && data?.clientSecret) {
        onClose();
        onNavigateToCheckout?.(); // Call callback to close settings modal
        navigate('/checkout', {
          state: {
            amount: amountUsd,
            credits: credits,
            isAutoTopup: isAutoTopup,
            clientSecret: data.clientSecret,
            paymentIntentId: data.paymentIntentId,
          },
        });
      }
    } catch (err) {
      console.error('Purchase error:', err);
      toast.error('Failed to start checkout');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCustomPurchase = () => {
    const amount = parseFloat(customAmount);
    if (isNaN(amount) || amount < MIN_PURCHASE) {
      toast.error(`Minimum purchase is $${MIN_PURCHASE}`);
      return;
    }
    const credits = calculateCredits(amount);
    handlePurchase(amount, credits);
  };

  const handleCloseModal = () => {
    setShowCustom(false);
    setCustomAmount('');
    setShowBreakdown(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCloseModal}>
      <DialogContent className="sm:max-w-lg rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="sticky top-0 bg-white z-10 pb-4">
          <DialogTitle className="text-3xl font-light text-center">
            {isAutoTopup ? 'Configure Auto Top-Up' : 'Experience The Full App'}
          </DialogTitle>
          {!isAutoTopup && (
            <DialogDescription className="text-center text-gray-600 font-light pt-2">
              Everything you need to explore your cosmic blueprint
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-6 mt-4 pb-2">
          {/* Main Experience Package */}
          {!isAutoTopup && !showCustom && (
            <>
              <div className="bg-gray-50 rounded-2xl p-6 space-y-4">
                <div className="text-center">
                  <div className="text-5xl font-light text-gray-900 mb-1">$5</div>
                  <div className="text-sm text-gray-500">50 credits • Never expires</div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-gray-700 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">Generate your complete report</span>
                      <div className="text-gray-500">Full sync & insights</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mic className="w-5 h-5 text-gray-700 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">20+ voice conversations</span>
                      <div className="text-gray-500">Natural, flowing dialogue</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MessageCircle className="w-5 h-5 text-gray-700 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">25+ chat messages</span>
                      <div className="text-gray-500">Deep dive into any topic</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-gray-700 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">AI insights that create momentum</span>
                      <div className="text-gray-500">Help self-discovery and growth</div>
                    </div>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => handlePurchase(STARTER_PACKAGE.amount, STARTER_PACKAGE.credits)}
                disabled={isProcessing}
                className="w-full bg-gray-900 hover:bg-gray-800 text-white rounded-full font-light py-6 text-lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Get Started - $5'
                )}
              </Button>

              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => setShowCustom(true)}
                  className="text-sm text-gray-600 hover:text-gray-900 font-light underline"
                >
                  Need more? Add a custom amount
                </button>
                
                <Collapsible open={showBreakdown} onOpenChange={setShowBreakdown}>
                  <CollapsibleTrigger className="text-sm text-gray-600 hover:text-gray-900 font-light border-b border-gray-200 pb-1">
                    {showBreakdown ? 'Hide' : 'Show'} credit breakdown
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-6">
                    <div className="border-t border-gray-100 pt-6">
                      <h4 className="text-sm font-medium text-gray-900 mb-4">Credit Usage</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-2 border-b border-gray-50">
                          <span className="text-sm text-gray-700">Chat message</span>
                          <span className="text-sm font-medium text-gray-900">1 credit ($0.10)</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-50">
                          <span className="text-sm text-gray-700">Voice conversation</span>
                          <span className="text-sm font-medium text-gray-900">2 credits ($0.20)</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-50">
                          <span className="text-sm text-gray-700">Report generation</span>
                          <span className="text-sm font-medium text-gray-900">2 credits ($0.20)</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                          <span className="text-sm text-gray-700">Full compatibility + report</span>
                          <span className="text-sm font-medium text-gray-900">4 credits ($0.40)</span>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </>
          )}

          {/* Custom Amount (when toggled) */}
          {(showCustom || isAutoTopup) && (
            <>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-light text-gray-600">Enter amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">$</span>
                    <Input
                      type="number"
                      min={MIN_PURCHASE}
                      step="0.01"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      placeholder="5.00"
                      className="pl-8 rounded-full h-14 text-center text-lg"
                      autoFocus
                    />
                  </div>
                  {customAmount && parseFloat(customAmount) >= MIN_PURCHASE && (
                    <div className="text-sm text-gray-600 text-center">
                      = {calculateCredits(parseFloat(customAmount))} credits
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleCustomPurchase}
                  disabled={isProcessing || !customAmount || parseFloat(customAmount) < MIN_PURCHASE}
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white rounded-full font-light py-6 text-base"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Continue to Checkout'
                  )}
                </Button>

                {!isAutoTopup && (
                  <button
                    onClick={() => setShowCustom(false)}
                    className="w-full text-sm text-gray-600 hover:text-gray-900 font-light"
                  >
                    ← Back to $5 package
                  </button>
                )}
              </div>

              <p className="text-xs text-gray-500 text-center font-light">
                Minimum $5 • Credits never expire
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
