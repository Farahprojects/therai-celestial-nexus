import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { log } from '@/utils/logUtils';

interface StripeSuccessState {
  showSuccessModal: boolean;
  guestId: string | null;
  sessionId: string | null;
  status: string | null;
  isProcessing: boolean;
  showOriginalSuccessScreen: boolean;
}

interface StripeSuccessContextType {
  stripeSuccess: StripeSuccessState;
  setStripeSuccess: (state: StripeSuccessState) => void;
  clearStripeSuccess: () => void;
  proceedToReport: () => void;
}

const StripeSuccessContext = createContext<StripeSuccessContextType | undefined>(undefined);

export const useStripeSuccess = () => {
  const context = useContext(StripeSuccessContext);
  if (context === undefined) {
    throw new Error('useStripeSuccess must be used within a StripeSuccessProvider');
  }
  return context;
};

interface StripeSuccessProviderProps {
  children: ReactNode;
}

export const StripeSuccessProvider: React.FC<StripeSuccessProviderProps> = ({ children }) => {
  const [stripeSuccess, setStripeSuccess] = useState<StripeSuccessState>({
    showSuccessModal: false,
    guestId: null,
    sessionId: null,
    status: null,
    isProcessing: false,
    showOriginalSuccessScreen: false
  });



  const clearStripeSuccess = useCallback(() => {
    log('info', '🔄 Clearing Stripe success state', null, 'stripeSuccess');
    setStripeSuccess({
      showSuccessModal: false,
      guestId: null,
      sessionId: null,
      status: null,
      isProcessing: false,
      showOriginalSuccessScreen: false
    });
  }, []);

  const proceedToReport = useCallback(() => {
    log('info', '🔄 Proceeding to original success screen', { guestId: stripeSuccess.guestId }, 'stripeSuccess');
    setStripeSuccess(prev => ({
      ...prev,
      showSuccessModal: false,
      isProcessing: false,
      showOriginalSuccessScreen: true
    }));
  }, [stripeSuccess.guestId]);

  const contextValue = useMemo(() => ({
    stripeSuccess,
    setStripeSuccess,
    clearStripeSuccess,
    proceedToReport
  }), [
    stripeSuccess,
    setStripeSuccess,
    clearStripeSuccess,
    proceedToReport
  ]);

  return (
    <StripeSuccessContext.Provider value={contextValue}>
      {children}
    </StripeSuccessContext.Provider>
  );
}; 