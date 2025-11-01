import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CreditPurchaseModal } from '@/components/billing/CreditPurchaseModal';
import { getBillingMode, getLowBalanceMessage, getUpgradeButtonText } from '@/utils/billingMode';

interface SubscriptionToastProps {
  isVisible: boolean;
  onDismiss: () => void;
  message?: string;
}

export const SubscriptionToast: React.FC<SubscriptionToastProps> = ({ 
  isVisible,
  onDismiss,
  message
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showCreditModal, setShowCreditModal] = useState(false);
  const billingMode = getBillingMode();

  // Use mode-aware message if not provided
  const displayMessage = message || getLowBalanceMessage();

  const handleUpgrade = () => {
    if (billingMode === 'CREDIT') {
    setShowCreditModal(true);
    } else {
      // Navigate to subscription plans
      navigate('/subscription-paywall');
      onDismiss();
    }
  };

  // Only show on /therai route - not on public pages
  const isTheraiRoute = location.pathname.startsWith('/therai');
  const isCheckoutPage = location.pathname.startsWith('/checkout');
  
  if (!isVisible || !isTheraiRoute || isCheckoutPage) {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-2 fade-in duration-300">
        <div className="bg-gray-900 text-white rounded-full px-6 py-3 shadow-lg flex items-center gap-4">
          <span className="text-sm font-light">{displayMessage}</span>
          <button
            onClick={handleUpgrade}
            className="px-4 py-1.5 bg-white text-gray-900 text-sm font-light rounded-full hover:bg-gray-100 transition-colors"
          >
            {getUpgradeButtonText()}
          </button>
        </div>
      </div>

      {billingMode === 'CREDIT' && (
      <CreditPurchaseModal
        isOpen={showCreditModal}
        onClose={() => {
          setShowCreditModal(false);
          onDismiss();
        }}
      />
      )}
    </>
  );
};
