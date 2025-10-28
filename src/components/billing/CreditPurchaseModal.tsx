import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getCheckoutFlowType } from '@/utils/deviceDetection';

interface CreditPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAutoTopup?: boolean;
  onNavigateToCheckout?: () => void;
}

const CREDIT_PRICE = 0.15;
const MIN_PURCHASE = 5;

export const CreditPurchaseModal: React.FC<CreditPurchaseModalProps> = ({
  isOpen,
  onClose,
  isAutoTopup = false,
  onNavigateToCheckout,
}) => {
  const navigate = useNavigate();
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const packages = [
    { amount: 5, credits: Math.floor(5 / CREDIT_PRICE) },
    { amount: 10, credits: Math.floor(10 / CREDIT_PRICE) },
  ];

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
    setSelectedPackage(null);
    setCustomAmount('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCloseModal}>
      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-light text-center">
            {isAutoTopup ? 'Configure Auto Top-Up' : 'Top Up Credits'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          {/* Package Options */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {packages.map((pkg) => (
                <button
                  key={pkg.amount}
                  onClick={() => {
                    setSelectedPackage(pkg.amount);
                    setCustomAmount('');
                  }}
                  className={`
                    relative rounded-xl border px-4 py-4 transition-all text-left
                    ${
                      selectedPackage === pkg.amount
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }
                  `}
                >
                  <div className={`text-2xl font-light ${selectedPackage === pkg.amount ? 'text-white' : 'text-gray-900'}`}>
                    ${pkg.amount}
                  </div>
                  <div className={`text-xs mt-1 ${selectedPackage === pkg.amount ? 'text-gray-300' : 'text-gray-500'}`}>
                    {pkg.credits} credits
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Amount */}
          <div className="space-y-3">
            <h3 className="text-sm font-light text-gray-600 text-center">Or enter custom amount</h3>
            <div className="space-y-2">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">$</span>
                <Input
                  type="number"
                  min={MIN_PURCHASE}
                  step="0.01"
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                    setSelectedPackage(null);
                  }}
                  placeholder="5.00"
                  className="pl-8 rounded-full h-14 text-center text-lg"
                />
              </div>
              {customAmount && parseFloat(customAmount) >= MIN_PURCHASE && (
                <div className="text-sm text-gray-600 text-center">
                  = {calculateCredits(parseFloat(customAmount))} credits
                </div>
              )}
            </div>
          </div>

          {/* Purchase Button */}
          <Button
            onClick={() => {
              if (selectedPackage) {
                const pkg = packages.find((p) => p.amount === selectedPackage);
                if (pkg) handlePurchase(pkg.amount, pkg.credits);
              } else {
                handleCustomPurchase();
              }
            }}
            disabled={isProcessing || (!selectedPackage && !customAmount)}
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

          <p className="text-xs text-gray-500 text-center font-light">
            Minimum $5 • Credits never expire
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
