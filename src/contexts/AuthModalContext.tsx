import React, { createContext, useContext, useState, ReactNode, useCallback, useMemo } from 'react';

interface AuthModalContextType {
  isAuthModalOpen: boolean;
  openAuthModal: (mode?: 'login' | 'signup') => void;
  closeAuthModal: () => void;
  authModalMode: 'login' | 'signup';
}

const AuthModalContext = createContext<AuthModalContextType | null>(null);

interface AuthModalProviderProps {
  children: ReactNode;
}

export const AuthModalProvider = ({ children }: AuthModalProviderProps) => {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');

  const openAuthModal = useCallback((mode: 'login' | 'signup' = 'login') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  const contextValue = useMemo(() => ({
    isAuthModalOpen,
    openAuthModal,
    closeAuthModal,
    authModalMode,
  }), [
    isAuthModalOpen,
    openAuthModal,
    closeAuthModal,
    authModalMode,
  ]);

  return (
    <AuthModalContext.Provider value={contextValue}>
      {children}
    </AuthModalContext.Provider>
  );
};

export const useAuthModal = () => {
  const context = useContext(AuthModalContext);
  if (!context) {
    throw new Error('useAuthModal must be used within an AuthModalProvider');
  }
  return context;
};
