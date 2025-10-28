import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CreditPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAutoTopup?: boolean;
}

const CREDIT_PRICE = 0.15;
const MIN_PURCHASE = 5;

export const CreditPurchaseModal: React.FC<CreditPurchaseModalProps> = ({
  isOpen,
  onClose,
  isAutoTopup = false,
}) => {
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
      const { data, error } = await supabase.functions.invoke('credit-topup', {
        body: {
          amount_usd: amountUsd,
          credits: credits,
          is_auto_topup: isAutoTopup,
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-light">
            {isAutoTopup ? 'Configure Auto Top-Up' : 'Purchase Credits'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Credit Rate Info */}
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <div className="text-sm text-gray-600">Credit Rate</div>
            <div className="text-2xl font-light text-gray-900 mt-1">
              ${CREDIT_PRICE} <span className="text-sm text-gray-600">per credit</span>
            </div>
          </div>

          {/* Package Options */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-900">Quick Select</h3>
            <div className="grid grid-cols-2 gap-3">
              {packages.map((pkg) => (
                <button
                  key={pkg.amount}
                  onClick={() => {
                    setSelectedPackage(pkg.amount);
                    setCustomAmount('');
                  }}
                  className={`
                    rounded-xl border-2 p-4 transition-all text-center
                    ${
                      selectedPackage === pkg.amount
                        ? 'border-gray-900 bg-gray-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  <div className="text-2xl font-light text-gray-900">${pkg.amount}</div>
                  <div className="text-sm text-gray-600 mt-1">{pkg.credits} credits</div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Amount */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-900">Custom Amount</h3>
            <div className="space-y-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <Input
                  type="number"
                  min={MIN_PURCHASE}
                  step="0.01"
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                    setSelectedPackage(null);
                  }}
                  placeholder={`Min $${MIN_PURCHASE}`}
                  className="pl-7 rounded-xl"
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
            className="w-full bg-gray-900 hover:bg-gray-800 text-white rounded-full font-light py-6"
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

          <p className="text-xs text-gray-500 text-center">
            Minimum purchase: ${MIN_PURCHASE}. Credits never expire.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

