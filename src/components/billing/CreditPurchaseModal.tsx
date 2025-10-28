import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Loader2, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js';

interface CreditPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAutoTopup?: boolean;
}

const CREDIT_PRICE = 0.15;
const MIN_PURCHASE = 5;
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string;

const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : Promise.resolve(null);

export const CreditPurchaseModal: React.FC<CreditPurchaseModalProps> = ({
  isOpen,
  onClose,
  isAutoTopup = false,
}) => {
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

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
          embedded: true,
        },
      });

      if (error) {
        toast.error('Failed to start checkout');
        return;
      }

      if (data?.clientSecret) {
        setClientSecret(data.clientSecret);
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

  const handleBack = () => {
    setClientSecret(null);
    setSelectedPackage(null);
    setCustomAmount('');
  };

  const handleCloseModal = () => {
    setClientSecret(null);
    setSelectedPackage(null);
    setCustomAmount('');
    onClose();
  };

  const options = useMemo(() => (clientSecret ? { clientSecret } : undefined), [clientSecret]);

  // Show embedded checkout
  if (clientSecret && options) {
    return (
      <Dialog open={isOpen} onOpenChange={handleCloseModal}>
        <DialogContent className="sm:max-w-2xl rounded-3xl p-0 overflow-hidden">
          <div className="p-6 border-b flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="rounded-full"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <DialogTitle className="text-xl font-light">Complete Your Purchase</DialogTitle>
          </div>
          <div className="p-6">
            <EmbeddedCheckoutProvider stripe={stripePromise} options={options as any}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Show credit selection
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
                    rounded-full border-2 p-6 transition-all text-center
                    ${
                      selectedPackage === pkg.amount
                        ? 'border-gray-900 bg-gray-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  <div className="text-3xl font-light text-gray-900">${pkg.amount}</div>
                  <div className="text-sm text-gray-600 mt-2">{pkg.credits} credits</div>
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
