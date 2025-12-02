import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader, CheckCircle, XCircle } from 'lucide-react';
import Logo from '@/components/Logo';
import { showToast } from '@/utils/notifications';
import PasswordResetForm from '@/components/auth/PasswordResetForm';

const ResetPassword: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'update-password'>('loading');
  const [message, setMessage] = useState('Verifying your password reset link…');

  const navigate = useNavigate();
  const location = useLocation();
  
  const processedRef = useRef(false);

  const finishSuccess = async (token: string) => {
    console.log(`[PASSWORD-VERIFY] ✓ SUCCESS: password reset verification completed`);

    setMessage('Setting up password reset...');

    try {
      // Call secure edge function to verify token and get session
      console.log('[PASSWORD-VERIFY] Calling verify-token edge function...');

      const { data, error } = await supabase.functions.invoke('verify-token', {
        body: {
          token
          // Let the edge function determine the type from the token itself
        }
      });

      if (error) {
        console.error('[PASSWORD-VERIFY] Edge function error:', error);
        
        // Handle different types of edge function errors
        if (error.message?.includes('non-2xx status code')) {
          throw new Error('Token verification failed. Please try again or request a new reset link.');
        } else if (error.message?.includes('FunctionsHttpError')) {
          throw new Error('Unable to verify token. Please try again or request a new reset link.');
        } else {
          throw new Error(error.message || 'Token verification failed. Please try again.');
        }
      }

      if (!data?.success) {
        console.error('[PASSWORD-VERIFY] Verification failed:', data?.error);
        throw new Error(data?.error || 'Token verification failed. Please try again.');
      }

      console.log('[PASSWORD-VERIFY] ✓ Token verification successful:', data.message);

      // Set session if provided
      if (data.session) {
        const { error: sessionError } = await supabase.auth.setSession(data.session);
        if (sessionError) {
          console.error('[PASSWORD-VERIFY] Session error:', sessionError);
          throw new Error('Failed to establish session');
        }
      }

    } catch (error) {
      console.error('[PASSWORD-VERIFY] Critical verification error:', error);
      setStatus('error');
      setMessage('Failed to verify your password reset link. Please try again or contact support.');
      showToast({
        variant: 'destructive',
        title: 'Verification Error',
        description: error instanceof Error ? error.message : 'Unable to complete password reset verification. Please try again.'
      });
      return;
    }

    // Show password update form
    setStatus('update-password');
    setMessage('Please set your new password');
  };

  const handlePasswordUpdateSuccess = () => {
    setStatus('success');
    setMessage('Your password has been updated successfully!');
    
    showToast({ 
      variant: 'success', 
      title: 'Password Updated Successfully!', 
      description: 'Please sign in with your new password.' 
    });
    
    // Redirect to login after a short delay
    setTimeout(() => {
      navigate('/login');
    }, 1500);
  };

  useEffect(() => {
    const verify = async () => {
      if (processedRef.current) return;
      processedRef.current = true;

      // Entry point logging
      const requestId = crypto.randomUUID().substring(0, 8);
      console.log(`[PASSWORD-VERIFY:${requestId}] 🚀 PASSWORD COMPONENT - Starting verification process`);
      console.log(`[PASSWORD-VERIFY:${requestId}] Full URL:`, window.location.href);
      console.log(`[PASSWORD-VERIFY:${requestId}] Hash:`, location.hash);
      console.log(`[PASSWORD-VERIFY:${requestId}] Search:`, location.search);

      try {
        const hash = new URLSearchParams(location.hash.slice(1));
        const search = new URLSearchParams(location.search);

        // Parameter extraction logging
        const extractedParams = {
          token: hash.get('token') || search.get('token'),
          tokenType: hash.get('type') || search.get('type'),
          email: hash.get('email') || search.get('email'),
        };

        console.log(`[PASSWORD-VERIFY:${requestId}] Extracted parameters:`, extractedParams);

        const token = hash.get('token') || search.get('token');
        const tokenType = hash.get('type') || search.get('type');
        const email = hash.get('email') || search.get('email');

        console.log(`[PASSWORD-VERIFY:${requestId}] → Flow: OTP method`);
        console.log(`[PASSWORD-VERIFY:${requestId}] OTP params - token: ${!!token}, type: ${tokenType}, email: ${email}`);

        if (!token) {
          throw new Error('Invalid link – missing token');
        }

        // Pre-verification logging
        console.log(`[PASSWORD-VERIFY:${requestId}] Starting verification with edge function:`, {
          tokenLength: token.length,
        });

        // Call edge function to verify token
        finishSuccess(token);

      } catch (err: unknown) {
        const error = err as Error & { status?: number; code?: string };
        console.error(`[PASSWORD-VERIFY:${requestId}] ✗ VERIFICATION FAILED:`, {
          message: error?.message,
          status: error?.status,
          code: error?.code,
          details: error,
        });

        setStatus('error');
        const msg = error?.message ?? 'Verification failed – link may have expired.';
        setMessage(msg);
        showToast({ variant: 'destructive', title: 'Verification failed', description: msg });
      }
    };
    verify();
  }, [location.hash, location.search]);

  const heading =
    status === 'loading' ? 'Password Reset' : 
    status === 'update-password' ? 'Set New Password' :
    status === 'success' ? 'All Set!' : 'Uh‑oh…';

  const iconVariants = {
    loading: {
      rotate: 360,
      transition: { repeat: Infinity, duration: 1.2 },
    },
    error: {
      scale: [1, 1.1, 1],
      rotate: [0, -10, 10, -10, 10, 0],
      transition: { duration: 0.8 },
    },
    success: {},
  };

  const Icon = status === 'loading' ? Loader : status === 'success' ? CheckCircle : XCircle;

  const bgColor =
    status === 'loading'
      ? 'bg-gray-100 text-gray-700'
      : status === 'success'
      ? 'bg-gray-900 text-white'
      : 'bg-red-50 text-red-600';

  // Show password update form when status is 'update-password'
  if (status === 'update-password') {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <header className="w-full py-8 flex justify-center border-b border-gray-100">
          <Logo size="md" />
        </header>

        <main className="flex-grow flex items-center justify-center px-4 sm:px-6 lg:px-8 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="w-full max-w-md"
          >
            <PasswordResetForm onSuccess={handlePasswordUpdateSuccess} />
          </motion.div>
        </main>

        <footer className="py-8 text-center text-sm text-gray-500 font-light">
          © {new Date().getFullYear()} therai. All rights reserved.
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="w-full py-8 flex justify-center border-b border-gray-100">
        <Logo size="md" />
      </header>

      <main className="flex-grow flex items-center justify-center px-4 sm:px-6 lg:px-8 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="w-full max-w-md"
        >
          <Card className="border-0 shadow-none bg-transparent">
            <CardHeader className="text-center pb-8 px-0">
              <CardTitle className="text-4xl font-light text-gray-900 mb-3">
                {heading}
              </CardTitle>
              <CardDescription className="text-gray-600 font-light text-lg">
                {status === 'loading'
                  ? 'Verifying your password reset link'
                  : status === 'success'
                  ? 'Your password has been reset'
                  : 'Password reset failed'}
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col items-center gap-8 px-0">
              <motion.div
                className={`flex items-center justify-center h-16 w-16 rounded-full ${bgColor}`}
                animate={status}
                variants={iconVariants}
              >
                <Icon className="h-8 w-8" />
              </motion.div>
              <p className="text-center text-gray-600 font-light leading-relaxed max-w-sm">
                {message}
              </p>
            </CardContent>

            <CardFooter className="flex flex-col gap-4 justify-center px-0 pt-8">
              {status === 'success' ? (
                <Button
                  onClick={() => navigate('/login')}
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white font-light py-4 rounded-xl"
                >
                  Sign In to Continue
                </Button>
              ) : (
                <div className="flex flex-col gap-3 w-full">
                  <Button 
                    onClick={() => navigate('/login')} 
                    className="w-full bg-gray-900 hover:bg-gray-800 text-white font-light py-4 rounded-xl"
                  >
                    Return to Login
                  </Button>
                  {status === 'error' && (
                    <Button 
                      asChild 
                      variant="outline" 
                      className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 font-light py-4 rounded-xl"
                    >
                      <Link to="/signup">Create New Account</Link>
                    </Button>
                  )}
                </div>
              )}
            </CardFooter>
          </Card>
        </motion.div>
      </main>

      <footer className="py-8 text-center text-sm text-gray-500 font-light">
        © {new Date().getFullYear()} therai. All rights reserved.
      </footer>
    </div>
  );
};

export default ResetPassword;
