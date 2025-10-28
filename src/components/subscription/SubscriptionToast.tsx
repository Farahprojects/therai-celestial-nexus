import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CreditPurchaseModal } from '@/components/billing/CreditPurchaseModal';

interface SubscriptionToastProps {
  onDismiss: () => void;
  message?: string;
}

export const SubscriptionToast: React.FC<SubscriptionToastProps> = ({ 
  onDismiss,
  message = 'Low credit balance'
}) => {
  const location = useLocation();
  const [showCreditModal, setShowCreditModal] = useState(false);

  const handleTopUp = () => {
    setShowCreditModal(true);
  };

  // Don't show on checkout pages - user is already purchasing credits
  const isCheckoutPage = location.pathname.startsWith('/checkout');
  if (isCheckoutPage) {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-2 fade-in duration-300">
        <div className="bg-gray-900 text-white rounded-full px-6 py-3 shadow-lg flex items-center gap-4">
          <span className="text-sm font-light">{message}</span>
          <button
            onClick={handleTopUp}
            className="px-4 py-1.5 bg-white text-gray-900 text-sm font-light rounded-full hover:bg-gray-100 transition-colors"
          >
            Top Up
          </button>
        </div>
      </div>

      <CreditPurchaseModal
        isOpen={showCreditModal}
        onClose={() => {
          setShowCreditModal(false);
          onDismiss();
        }}
      />
    </>
  );
};
