import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { log } from '@/utils/logUtils';
import { AuthModal } from './AuthModal';

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, isValidating, pendingEmailAddress, isPendingEmailCheck } = useAuth();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  // Check for password reset route with more precision
  // This will match both /auth/password and /auth/password?type=recovery
  const isPasswordResetRoute = location.pathname.includes('/auth/password');
  
  // Check specifically for recovery token
  const hasRecoveryToken = searchParams.get('type') === 'recovery';
  
  useEffect(() => {
    // Only log significant auth state changes, not every evaluation
    if (!loading) {
      log('debug', 'AuthGuard auth state settled', {
        path: location.pathname,
        hasUser: !!user,
        isPasswordReset: isPasswordResetRoute,
        hasRecoveryToken,
        pendingEmailAddress: !!pendingEmailAddress
      });
    }
  }, [location.pathname, user, loading, isPasswordResetRoute, hasRecoveryToken, pendingEmailAddress]);
  
  // Open auth modal when user is not authenticated
  useEffect(() => {
    if (!loading && !user && !isPasswordResetRoute && !hasRecoveryToken) {
      setShowAuthModal(true);
    } else {
      setShowAuthModal(false);
    }
  }, [user, loading, isPasswordResetRoute, hasRecoveryToken]);
  
  // If user is on password reset route, don't apply auth guard
  if (isPasswordResetRoute) {
    log('debug', 'Password reset route detected, bypassing auth guard');
    return <>{children}</>;
  }
  
  // If there's a recovery token anywhere, redirect to password reset page
  if (hasRecoveryToken && !isPasswordResetRoute) {
    log('info', 'Recovery token detected on non-password reset route, redirecting');
    return <Navigate to={`/auth/password${location.search}`} replace />;
  }
  
  // Handle loading states without spinners - just return null for lazy loading
  if (loading || isPendingEmailCheck || isValidating) {
    return null; // Lazy loading - no spinner
  }
  
  // Not logged in - show page with auth modal overlay
  if (!user) {
    return (
      <>
        {children}
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          defaultMode="login"
        />
      </>
    );
  }

  // If user has pending email verification, show page with auth modal overlay
  if (pendingEmailAddress) {
    log('info', 'User has pending email verification, showing auth modal');
    return (
      <>
        {children}
        <AuthModal
          isOpen={true}
          onClose={() => {}} // Don't allow closing - must verify
          defaultMode="login"
        />
      </>
    );
  }
  
  // User is logged in and verified, render protected component
  return <>{children}</>;
};
