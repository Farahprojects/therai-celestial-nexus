import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { showToast } from '@/utils/notifications';
import EmailInput from '@/components/auth/EmailInput';
import PasswordInput from '@/components/auth/PasswordInput';
import SocialLogin from '@/components/auth/SocialLogin';
import { CapacitorSocialLogin } from '@/components/auth/CapacitorSocialLogin';
import { validateEmail } from '@/utils/authValidation';
import { FcGoogle } from 'react-icons/fc';
import { FaApple } from 'react-icons/fa';
import { useIsNativeApp } from '@/hooks/use-native-app';
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';
import { supabase } from '@/integrations/supabase/client';

interface LoginModalProps {
  onSuccess?: () => void;
  showAsPage?: boolean;
}

const LoginModal: React.FC<LoginModalProps> = ({ onSuccess, showAsPage = false }) => {
  const isNativeApp = useIsNativeApp();

  // ————————————————————————————————————————————————
  // Auth context
  // ————————————————————————————————————————————————
  const {
    signIn,
    signInWithGoogle,
    signInWithApple,
    user,
    loading: authLoading,
    pendingEmailAddress,
    isPendingEmailCheck,
    clearPendingEmail,
  } = useAuth();

  // ————————————————————————————————————————————————
  // Local UI state
  // ————————————————————————————————————————————————
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resendState, setResendState] = useState<'idle' | 'processing' | 'sent'>('idle');
  const [showVerificationModal, setShowVerificationModal] = useState(false);

  const emailValid = validateEmail(email);
  const passwordValid = password.length >= 6;

  // ————————————————————————————————————————————————
  // Handle successful authentication
  // ————————————————————————————————————————————————
  useEffect(() => {
    if (!authLoading && user && !showVerificationModal && !isPendingEmailCheck) {
      onSuccess?.();
    }
  }, [authLoading, user, isPendingEmailCheck, onSuccess]);

  // ————————————————————————————————————————————————
  // Show verification modal automatically when flagged by AuthContext
  // ————————————————————————————————————————————————
  useEffect(() => {
    if (pendingEmailAddress && !isPendingEmailCheck) {
      setShowVerificationModal(true);
    }
  }, [pendingEmailAddress, isPendingEmailCheck]);

  // ————————————————————————————————————————————————
  // Form submission
  // ————————————————————————————————————————————————
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailValid || !passwordValid) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const result = await signIn(email, password);
      if (result.error) {
        setErrorMsg(result.error.message || 'Sign in failed');
      }
    } catch (error) {
      setErrorMsg('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ————————————————————————————————————————————————
  // Social login handlers
  // ————————————————————————————————————————————————
  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      showToast({
        title: 'Sign in failed',
        description: 'Unable to sign in with Google. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleAppleSignIn = async () => {
    try {
      await signInWithApple();
    } catch (error) {
      showToast({
        title: 'Sign in failed',
        description: 'Unable to sign in with Apple. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // ————————————————————————————————————————————————
  // Verification handlers
  // ————————————————————————————————————————————————
  const handleResendVerification = async () => {
    setResendState('processing');
    
    try {
      // Use the same resend verification function as signup flow
      const { data, error } = await supabase.functions.invoke('resend-verification', {
        body: { email }
      });

      if (error) {
        throw new Error(error.message || 'Failed to send verification email');
      }

      setResendState('sent');
      showToast({
        title: 'Verification email sent',
        description: 'Please check your inbox (and spam folder).',
        variant: 'success',
      });
      
      // Reset to idle after 3 seconds
      setTimeout(() => setResendState('idle'), 3000);
    } catch (error: any) {
      setResendState('idle');
      showToast({
        title: 'Error',
        description: error.message ?? 'Failed to resend verification email. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleVerificationFinished = () => {
    setShowVerificationModal(false);
    onSuccess?.();
  };

  const handleVerificationCancelled = () => {
    setShowVerificationModal(false);
    clearPendingEmail();
  };

  // ————————————————————————————————————————————————
  // Render
  // ————————————————————————————————————————————————
  if (showForgotPassword) {
    return (
      <div className={showAsPage ? "min-h-screen flex items-start justify-center pt-24" : "space-y-6"}>
        <div className={showAsPage ? "w-full max-w-md" : "space-y-6"}>
          <ForgotPasswordForm
            onCancel={() => setShowForgotPassword(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={showAsPage ? "min-h-screen flex items-start justify-center pt-24" : "space-y-6"}>
      <div className={showAsPage ? "w-full max-w-md" : "space-y-6"}>
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-light text-gray-900">Welcome back</h1>
        <p className="text-sm text-gray-600">Sign in to your account</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <EmailInput 
            email={email} 
            isValid={emailValid} 
            onChange={setEmail} 
            onFocus={() => setErrorMsg('')} 
          />
          <PasswordInput
            password={password}
            isValid={passwordValid}
            showRequirements={false}
            onChange={setPassword}
            onFocus={() => setErrorMsg('')}
          />
        </div>

        {errorMsg && (
          <div className="text-center space-y-3">
            <div className="text-red-600 text-sm font-light">{errorMsg}</div>
            {errorMsg.toLowerCase().includes('confirm') || errorMsg.toLowerCase().includes('verification') || errorMsg.toLowerCase().includes('verify') ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleResendVerification()}
                disabled={resendState === 'processing' || resendState === 'sent'}
                className="text-xs border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-800 active:bg-gray-100 active:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resendState === 'processing' ? (
                  <>
                    <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin mr-2" />
                    Processing...
                  </>
                ) : resendState === 'sent' ? (
                  'Email sent!'
                ) : (
                  'Resend verification email'
                )}
              </Button>
            ) : null}
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full py-3 text-base font-light bg-gray-900 text-white hover:bg-gray-800 transition-all duration-300 rounded-full disabled:opacity-100 disabled:cursor-pointer"
          disabled={!emailValid || !passwordValid || loading}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      {/* Extras */}
      <div className="text-center space-y-4">
        <button
          type="button"
          onClick={() => setShowForgotPassword(true)}
          className="text-sm text-gray-600 hover:text-gray-900 transition-colors font-light border-b border-gray-300 hover:border-gray-600 pb-1"
        >
          Forgot your password?
        </button>

        {/* Social Login - Use Capacitor auth on native apps, web OAuth on browsers */}
        {isNativeApp ? (
          <CapacitorSocialLogin onSuccess={onSuccess} />
        ) : (
          <div className="space-y-3">
            <Button
              type="button"
              className="w-full h-12 rounded-full bg-white text-black hover:bg-gray-50 border border-gray-200"
              onClick={handleGoogleSignIn}
            >
              <FcGoogle className="mr-2 h-5 w-5" />
              Continue with Google
            </Button>

            <Button
              type="button"
              className="w-full h-12 rounded-full bg-black text-white hover:bg-gray-900"
              onClick={handleAppleSignIn}
            >
              <FaApple className="mr-2 h-5 w-5" />
              Continue with Apple
            </Button>
          </div>
        )}

        {/* Only show sign up link when shown as a page, not in modal */}
        {showAsPage && (
          <p className="text-center text-sm text-gray-600 font-light">
            Don't have an account?{' '}
            <Link to="/signup" className="text-gray-900 hover:text-gray-700 transition-colors border-b border-gray-300 hover:border-gray-600 pb-1">
              Sign up
            </Link>
          </p>
        )}
      </div>
      </div>
    </div>
  );
};

export default LoginModal;
