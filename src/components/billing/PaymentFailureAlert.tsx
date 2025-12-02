import React, { useState, useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PaymentFailureAlertProps {
  daysUntilCancellation: number | null;
  isPastDue: boolean;
  lastPaymentStatus: 'succeeded' | 'failed' | null;
}

const ALERT_DISMISS_KEY = 'payment_failure_alert_dismissed';
const ALERT_DISMISS_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export const PaymentFailureAlert: React.FC<PaymentFailureAlertProps> = ({
  daysUntilCancellation,
  isPastDue,
  lastPaymentStatus
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isOpening, setIsOpening] = useState(false);

  useEffect(() => {
    // Check if alert was recently dismissed
    const dismissedAt = localStorage.getItem(ALERT_DISMISS_KEY);
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10);
      const now = Date.now();
      
      // If less than 24 hours have passed, don't show
      if (now - dismissedTime < ALERT_DISMISS_DURATION) {
        return;
      }
      
      // Clear old dismissal
      localStorage.removeItem(ALERT_DISMISS_KEY);
    }

    // Show alert if conditions are met
    if (isPastDue && lastPaymentStatus === 'failed') {
      setIsVisible(true);
    }
  }, [isPastDue, lastPaymentStatus]);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem(ALERT_DISMISS_KEY, Date.now().toString());
  };

  const handleUpdatePayment = async () => {
    setIsOpening(true);
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
      setIsOpening(false);
    }
  };

  if (!isVisible) return null;

  const urgencyLevel = daysUntilCancellation !== null && daysUntilCancellation <= 1 ? 'critical' : 'warning';
  
  return (
    <div className={`fixed top-0 left-0 right-0 z-50 ${
      urgencyLevel === 'critical' ? 'bg-red-600' : 'bg-orange-500'
    } text-white shadow-lg`}>
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-normal">
                Payment failed - update your card to restore access.
                {daysUntilCancellation !== null && (
                  <span className="font-medium ml-1">
                    Subscription will be canceled in {daysUntilCancellation} {daysUntilCancellation === 1 ? 'day' : 'days'}.
                  </span>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              onClick={handleUpdatePayment}
              disabled={isOpening}
              size="sm"
              className="bg-white text-gray-900 hover:bg-gray-100 rounded-full font-normal px-4"
            >
              {isOpening ? 'Opening...' : 'Update Payment Method'}
            </Button>
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              aria-label="Dismiss alert"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

