import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface StrictAuthGuardProps {
  children: React.ReactNode;
}

export const StrictAuthGuard: React.FC<StrictAuthGuardProps> = ({ children }) => {
  const { user, loading, isValidating, isPendingEmailCheck, pendingEmailAddress } = useAuth();
  const location = useLocation();

  if (loading || isValidating || isPendingEmailCheck) {
    return null;
  }

  if (!user || pendingEmailAddress) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  return <>{children}</>;
};

