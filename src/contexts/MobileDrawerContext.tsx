import React, { createContext, useContext, ReactNode } from 'react';

interface MobileDrawerContextType {
  closeDrawer: () => void;
}

const MobileDrawerContext = createContext<MobileDrawerContextType | null>(null);

interface MobileDrawerProviderProps {
  children: ReactNode;
  closeDrawer: () => void;
}

export const MobileDrawerProvider: React.FC<MobileDrawerProviderProps> = ({
  children,
  closeDrawer,
}) => {
  return (
    <MobileDrawerContext.Provider value={{ closeDrawer }}>
      {children}
    </MobileDrawerContext.Provider>
  );
};

export const useMobileDrawer = () => {
  const context = useContext(MobileDrawerContext);
  if (!context) {
    throw new Error('useMobileDrawer must be used within a MobileDrawerProvider');
  }
  return context;
};