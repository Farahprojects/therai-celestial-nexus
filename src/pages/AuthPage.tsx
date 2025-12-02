import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getRedirectPath } from '@/utils/redirectUtils';

export const AuthPage = () => {
  const { user, session, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (loading) return;

    // If user is authenticated after email verification, redirect appropriately
    if (user && session) {
      // Check for redirect param
      const redirectPath = getRedirectPath(searchParams);
      const destination = redirectPath || '/therai';
      navigate(destination, { replace: true });
      return;
    }

    // If not authenticated, show message and redirect to signup with redirect param preserved
    const timer = setTimeout(() => {
      const redirectParam = searchParams.get('redirect');
      const signupUrl = redirectParam 
        ? `/signup?redirect=${encodeURIComponent(redirectParam)}`
        : '/signup';
      navigate(signupUrl, { replace: true });
    }, 3000);

    return () => clearTimeout(timer);
  }, [user, session, loading, navigate, searchParams]);

  // Always render the UI with lazy loading - no spinners

  if (user && session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-4">Email Verified!</h1>
          <p className="text-muted-foreground mb-4">Redirecting you to the app...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <h1 className="text-2xl font-semibold mb-4">Please Complete Registration</h1>
        <p className="text-muted-foreground mb-6">
          To continue, please click the verification link in your email, then return here to complete your registration.
        </p>
        <p className="text-sm text-muted-foreground">
          Redirecting you to the signup page in a moment...
        </p>
      </div>
    </div>
  );
};