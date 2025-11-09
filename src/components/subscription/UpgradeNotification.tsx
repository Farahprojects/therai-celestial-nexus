import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';

interface UpgradeNotificationProps {
  isVisible: boolean;
  onDismiss: () => void;
  message?: string;
}

const isPremiumPlan = (planId: string | null): boolean => {
  if (!planId) return false;
  return planId === '25_monthly' || 
         planId === 'subscription_professional' || 
         planId.toLowerCase().includes('premium');
};

export const UpgradeNotification: React.FC<UpgradeNotificationProps> = ({ 
  isVisible,
  onDismiss,
  message
}) => {
  const navigate = useNavigate();
  const { isSubscriptionActive, subscriptionPlan } = useSubscription();

  const handleUpgrade = () => {
    navigate('/subscription-paywall');
    onDismiss();
  };

  // Determine message based on subscription status
  const displayMessage = message || (isSubscriptionActive && !isPremiumPlan(subscriptionPlan) 
    ? 'Upgrade to unlock' 
    : 'Subscription required');

  if (!isVisible) {
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
            Upgrade
          </button>
          <button
            onClick={onDismiss}
            className="ml-2 p-1 hover:bg-gray-800 rounded-full transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
};

