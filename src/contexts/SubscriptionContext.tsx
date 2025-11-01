import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { SubscriptionToast } from '@/components/subscription/SubscriptionToast';
import { PaymentFailureToast } from '@/components/subscription/PaymentFailureToast';

interface SubscriptionContextType {
  showToast: boolean;
  dismissToast: () => void;
  isSubscriptionActive: boolean;
  subscriptionPlan: string | null;
  loading: boolean;
  isPastDue: boolean;
  daysUntilCancellation: number | null;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

const TOAST_DISMISS_KEY = 'subscription_toast_dismissed';
const TOAST_DISMISS_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { isActive, plan, loading, refetch, isPastDue, daysUntilCancellation } = useSubscriptionStatus();
  const [showToast, setShowToast] = useState(false);
  const location = useLocation();

  // Check if toast was recently dismissed
  const isToastDismissed = () => {
    const dismissedAt = localStorage.getItem(TOAST_DISMISS_KEY);
    if (!dismissedAt) return false;
    
    const dismissedTime = parseInt(dismissedAt, 10);
    const now = Date.now();
    
    // If more than 24 hours have passed, allow showing toast again
    if (now - dismissedTime > TOAST_DISMISS_DURATION) {
      localStorage.removeItem(TOAST_DISMISS_KEY);
      return false;
    }
    
    return true;
  };

  // Refetch subscription status when returning from successful payment
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const paymentStatus = searchParams.get('payment_status');
    
    if (paymentStatus === 'success' && user) {
      // Refetch subscription status to ensure it's up-to-date
      refetch();
      // Clear dismissal so toast doesn't show after subscribing
      localStorage.removeItem(TOAST_DISMISS_KEY);
    }
  }, [location.search, user, refetch]);

  // Show toast if user is authenticated but doesn't have active subscription
  useEffect(() => {
    const path = location.pathname || '';
    const searchParams = new URLSearchParams(location.search);
    const paymentStatus = searchParams.get('payment_status');
    
    // ONLY show toast on /therai route
    const shouldShowToastOnRoute = path === '/therai' || path.startsWith('/c/');
    
    // Never show on checkout-related pages
    const suppressedPrefixes = ['/stripe', '/subscription', '/subscription-paywall', '/success', '/cancel'];
    const isSuppressedRoute = suppressedPrefixes.some(prefix => path.startsWith(prefix));
    
    // Suppress toast on specific routes or if returning from successful payment
    if (isSuppressedRoute || paymentStatus === 'success' || !shouldShowToastOnRoute) {
      setShowToast(false);
      return;
    }

    if (user && !loading) {
      // Only show toast if user is logged in, doesn't have active subscription, and hasn't dismissed it
      if (!isActive && !isToastDismissed()) {
        // Delay showing toast by 2 seconds after page load for better UX
        const timer = setTimeout(() => setShowToast(true), 2000);
        return () => clearTimeout(timer);
      } else {
        setShowToast(false);
      }
    } else if (!user) {
      // Don't show toast for unauthenticated users
      setShowToast(false);
    }
  }, [user, isActive, loading, location.pathname, location.search]);

  const dismissToast = () => {
    setShowToast(false);
    localStorage.setItem(TOAST_DISMISS_KEY, Date.now().toString());
  };

  return (
    <SubscriptionContext.Provider
      value={{
        showToast,
        dismissToast,
        isSubscriptionActive: isActive, // Use actual subscription status
        subscriptionPlan: plan,
        loading,
        isPastDue,
        daysUntilCancellation
      }}
    >
      {children}
      
      {/* Show different toast based on subscription status */}
      {isPastDue ? (
        <PaymentFailureToast
          isVisible={showToast}
          onDismiss={dismissToast}
          daysUntilCancellation={daysUntilCancellation}
        />
      ) : (
        <SubscriptionToast
          isVisible={showToast}
          onDismiss={dismissToast}
        />
      )}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
