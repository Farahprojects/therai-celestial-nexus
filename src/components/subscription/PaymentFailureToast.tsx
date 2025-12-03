import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { X, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { safeConsoleError } from '@/utils/safe-logging';
interface PaymentFailureToastProps {
  isVisible: boolean;
  onDismiss: () => void;
  daysUntilCancellation: number | null;
}

export const PaymentFailureToast: React.FC<PaymentFailureToastProps> = ({
  isVisible,
  onDismiss,
  daysUntilCancellation
}) => {
  const location = useLocation();
  const [isOpening, setIsOpening] = useState(false);

  // Don't show on checkout pages
  const isCheckoutPage = location.pathname.startsWith('/checkout');
  if (isCheckoutPage) {
    return null;
  }

  const handleUpdatePayment = async () => {
    setIsOpening(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      
      if (error) throw error;
      
      if (data?.url) {
        window.open(data.url, '_blank');
        onDismiss();
      }
    } catch (error) {
      safeConsoleError('Error opening customer portal:', error);
      toast.error('Failed to open payment portal');
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed bottom-24 left-0 right-0 z-50 flex justify-center px-4"
        >
          <div className="bg-white border-2 border-red-400 rounded-full shadow-lg px-6 py-4 flex items-center justify-between gap-4 w-full max-w-md">
            {/* Icon */}
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              
              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-normal text-gray-900">
                  Payment Failed
                </p>
                <p className="text-xs font-light text-gray-600 truncate">
                  {daysUntilCancellation !== null && daysUntilCancellation > 0 ? (
                    <>Cancels in {daysUntilCancellation} {daysUntilCancellation === 1 ? 'day' : 'days'}</>
                  ) : (
                    <>Update payment to restore access</>
                  )}
                </p>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleUpdatePayment}
                disabled={isOpening}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-light rounded-full transition-colors disabled:opacity-50"
              >
                {isOpening ? 'Opening...' : 'Update'}
              </button>
              <button
                onClick={onDismiss}
                className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

