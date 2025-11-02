import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

const ConfirmEmail: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email…');

  const navigate = useNavigate();
  const location = useLocation();
  
  const processedRef = useRef(false);

  const finishSuccess = async (kind: 'signup' | 'email_change', token: string, email: string) => {
    console.log(`[EMAIL-VERIFY] ✓ SUCCESS: ${kind} verification completed`);

    setMessage('Finalizing your account...');

    try {
      // Call secure edge function to verify token and update profile
      console.log('[EMAIL-VERIFY] Calling verify-email-token edge function...');

      const { data, error } = await supabase.functions.invoke('verify-email-token', {
        body: {
          token,
          email,
          type: kind
        }
      });

      if (error) {
        console.error('[EMAIL-VERIFY] Edge function error:', error);
        throw new Error(error.message || 'Verification failed');
      }

      if (!data?.success) {
        console.error('[EMAIL-VERIFY] Verification failed:', data?.error);
        throw new Error(data?.error || 'Verification failed');
      }

      console.log('[EMAIL-VERIFY] ✓ Email verification successful:', data.message);

    } catch (error) {
      console.error('[EMAIL-VERIFY] Critical verification error:', error);
      setStatus('error');
      setMessage('Failed to verify your email. Please try again or contact support.');
      showToast({
        variant: 'destructive',
        title: 'Verification Error',
        description: error instanceof Error ? error.message : 'Unable to complete email verification. Please try again.'
      });
      return;
    }

    // Sign out any auto-created session from the magic link
    // This ensures users must sign in manually after verification
    await supabase.auth.signOut();
    console.log('[EMAIL-VERIFY] ✓ Signed out auto-created session');

    setStatus('success');
    const msg = kind === 'signup'
      ? 'Email verified! Please sign in to continue.'
      : 'Email updated! Please sign in to continue.';
    setMessage(msg);
    showToast({ variant: 'success', title: 'Success', description: msg });
  };

  useEffect(() => {
    const verify = async () => {
      if (processedRef.current) return;
      processedRef.current = true;

      // Entry point logging
      const requestId = crypto.randomUUID().substring(0, 8);
      console.log(`[EMAIL-VERIFY:${requestId}] ⚠️ CONFIRMEMAIL COMPONENT - Starting verification process`);
      console.log(`[EMAIL-VERIFY:${requestId}] Full URL:`, window.location.href);
      console.log(`[EMAIL-VERIFY:${requestId}] Hash:`, location.hash);
      console.log(`[EMAIL-VERIFY:${requestId}] Search:`, location.search);

      try {
        const hash = new URLSearchParams(location.hash.slice(1));
        const search = new URLSearchParams(location.search);

        // Parameter extraction logging
        const extractedParams = {
          accessToken: !!hash.get('access_token'),
          refreshToken: !!hash.get('refresh_token'),
          pkceCode: !!hash.get('code'),
          hashType: hash.get('type'),
          token: hash.get('token') || search.get('token'),
          tokenType: hash.get('type') || search.get('type'),
          email: hash.get('email') || search.get('email'),
          newEmail: hash.get('email') || search.get('email'),
        };

        console.log(`[EMAIL-VERIFY:${requestId}] Extracted parameters:`, extractedParams);

        const accessToken = hash.get('access_token');
        const refreshToken = hash.get('refresh_token');
        const pkceCode = hash.get('code');
        const newEmail = hash.get('email') || search.get('email');
        const hashType = hash.get('type');

        // Only support OTP flow (custom email verification)
        // ACCESS_TOKEN and PKCE flows removed for simplicity

        // OTP Flow
        const token = hash.get('token') || search.get('token');
        const tokenType = hash.get('type') || search.get('type');
        const email = hash.get('email') || search.get('email');

        console.log(`[EMAIL-VERIFY:${requestId}] → Flow: OTP method`);
        console.log(`[EMAIL-VERIFY:${requestId}] OTP params - token: ${!!token}, type: ${tokenType}, email: ${email}`);

        if (!token || !tokenType || !email) {
          const missingParams = [];
          if (!token) missingParams.push('token');
          if (!tokenType) missingParams.push('type');
          if (!email) missingParams.push('email');
          
          console.error(`[EMAIL-VERIFY:${requestId}] Missing OTP parameters:`, missingParams);
          throw new Error(`Invalid link – missing: ${missingParams.join(', ')}`);
        }

        // Pre-verification logging
        console.log(`[EMAIL-VERIFY:${requestId}] Starting verification with edge function:`, {
          tokenLength: token.length,
          type: tokenType,
          email: email,
        });

        // Call edge function to verify token and update profile
        finishSuccess(tokenType.startsWith('sign') ? 'signup' : 'email_change', token, email);

      } catch (err: any) {
        console.error(`[EMAIL-VERIFY:${requestId}] ✗ VERIFICATION FAILED:`, {
          message: err?.message,
          status: err?.status,
          code: err?.code,
          details: err,
        });
        
        setStatus('error');
        const msg = err?.message ?? 'Verification failed – link may have expired.';
        setMessage(msg);
        showToast({ variant: 'destructive', title: 'Verification failed', description: msg });
      }
    };
    verify();
  }, [location.hash, location.search]);

  const heading =
    status === 'loading' ? 'Email Verification' : status === 'success' ? 'All Set!' : 'Uh‑oh…';

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
                  ? 'Verifying your email address'
                  : status === 'success'
                  ? 'Your email has been verified'
                  : 'Verification failed'}
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

export default ConfirmEmail;
