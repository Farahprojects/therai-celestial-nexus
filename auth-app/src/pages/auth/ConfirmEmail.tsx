import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useLocation } from 'react-router-dom';
import { supabase, supabaseAnonKey } from '../../lib/supabase';
import { Loader, CheckCircle, XCircle } from 'lucide-react';
import Logo from '../../components/Logo';

const ConfirmEmail: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'update-password'>('loading');
  const [message, setMessage] = useState('Verifying your email…');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const location = useLocation();
  const processedRef = useRef(false);

  const finishSuccess = async (kind: 'signup' | 'email_change', token: string, email: string) => {
    setMessage('Finalizing your account...');

    try {
      const { data, error } = await supabase.functions.invoke('verify-email-token', {
        body: {
          token,
          email,
          type: kind
        }
      });

      // Handle already verified case gracefully
      if (error && error.message?.includes('already verified')) {
        // Sign out any auto-created session
        await supabase.auth.signOut();
        setStatus('success');
        setMessage('Email already verified! Please sign in to continue.');
        setTimeout(() => {
          window.location.href = 'https://therai.co/login';
        }, 2000);
        return;
      }

      // Handle other errors
      if (error) {
        throw new Error(error.message || 'Verification failed');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Verification failed');
      }

    } catch (error) {
      // Check if it's a "token already used" error (400 status)
      if (error instanceof Error && error.message.includes('400')) {
        // Sign out any auto-created session
        await supabase.auth.signOut();
        setStatus('success');
        setMessage('Email already verified! Please sign in to continue.');
        setTimeout(() => {
          window.location.href = 'https://therai.co/login';
        }, 2000);
        return;
      }

      // Handle other errors
      setStatus('error');
      setMessage('Failed to verify your email. Please try again or contact support.');
      return;
    }

    // Sign out any auto-created session from the magic link
    // This ensures users must sign in manually after verification
    await supabase.auth.signOut();

    setStatus('success');
    const msg = kind === 'signup'
      ? 'Email verified! Please sign in to continue.'
      : 'Email updated! Please sign in to continue.';
    setMessage(msg);

    // Redirect to main app login after 3 seconds
    setTimeout(() => {
      window.location.href = 'https://therai.co/login';
    }, 3000);
  };

  const finishPasswordSuccess = async (token: string) => {
    setMessage('Setting up password reset...');

    try {
      // Call secure edge function to verify token and get session
      // Include apikey header for unauthenticated requests
      const { data, error } = await supabase.functions.invoke('verify-token', {
        body: {
          token
          // Let the edge function determine the type from the token itself
        },
        headers: {
          'apikey': supabaseAnonKey
        }
      });

      if (error) {
        console.error('[PASSWORD-VERIFY] Edge function error:', error);
        console.error('[PASSWORD-VERIFY] Error details:', {
          message: error.message,
          name: error.name,
          status: (error as any).status,
          statusText: (error as any).statusText
        });
        
        // Handle different types of edge function errors
        if (error.message?.includes('non-2xx status code') || (error as any).status === 401) {
          throw new Error('Token verification failed. Please try again or request a new reset link.');
        } else if (error.message?.includes('FunctionsHttpError')) {
          throw new Error('Unable to verify token. Please try again or request a new reset link.');
        } else {
          throw new Error(error.message || 'Token verification failed. Please try again.');
        }
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Token verification failed. Please try again.');
      }

      // Store the email for later use
      if (data.email) {
        setUserEmail(data.email);
      }

      // Set session if provided
      if (data.session) {
        const { error: sessionError } = await supabase.auth.setSession(data.session);
        if (sessionError) {
          throw new Error('Failed to establish session');
        }
      }

    } catch (error) {
      setStatus('error');
      setMessage('Failed to verify your password reset link. Please try again or contact support.');
      return;
    }

    // Show password reset form instead of redirecting
    setStatus('update-password');
    setMessage('Please set your new password');
  };

  const handlePasswordUpdate = async () => {
    if (newPassword !== confirmPassword) {
      setMessage('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setMessage('Password must be at least 8 characters');
      return;
    }

    setIsUpdating(true);
    setMessage('Updating password...');

    try {
      // Get token from URL
      const hash = new URLSearchParams(location.hash.slice(1));
      const search = new URLSearchParams(location.search);
      const token = hash.get('token') || search.get('token');

      if (!token) {
        throw new Error('Token not found');
      }

      // Use the stored email from token verification
      if (!userEmail) {
        throw new Error('Email not found in token verification');
      }

      // Call update-password edge function
      const { data: updateData, error } = await supabase.functions.invoke('update-password', {
        body: {
          token_hash: token,
          email: userEmail,
          newPassword: newPassword
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to update password');
      }

      if (!updateData?.success) {
        throw new Error(updateData?.error || 'Failed to update password');
      }

      // Success
      setStatus('success');
      setMessage('Password updated successfully! Redirecting to login...');
      
      // Redirect to login after delay
      setTimeout(() => {
        window.location.href = 'https://therai.co/login';
      }, 2000);

    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Failed to update password. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    const verify = async () => {
      if (processedRef.current) return;
      processedRef.current = true;

      try {
        const hash = new URLSearchParams(location.hash.slice(1));
        const search = new URLSearchParams(location.search);

        // OTP Flow
        const token = hash.get('token') || search.get('token');
        const tokenType = hash.get('type') || search.get('type');
        const email = hash.get('email') || search.get('email');

        if (!token) {
          throw new Error('Invalid link – missing token');
        }

        // For recovery type, just pass token to edge function
        if (tokenType === 'recovery') {
          finishPasswordSuccess(token);
        } else if (tokenType) {
          // For other types, still require email
          if (!email) {
            throw new Error('Email is required for this verification type');
          }
          finishSuccess(tokenType.startsWith('sign') ? 'signup' : 'email_change', token, email);
        } else {
          // No token type specified, try to determine from token itself
          finishPasswordSuccess(token);
        }

      } catch (err) {
        setStatus('error');
        const msg = err instanceof Error ? err.message : 'Verification failed – link may have expired.';
        setMessage(msg);
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

  // Show password reset form
  if (status === 'update-password') {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <header className="w-full py-4 flex justify-center border-b border-gray-100">
          <Logo size="sm" className="max-h-8" />
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
                  Set New Password
                </CardTitle>
                <CardDescription className="text-gray-600 font-light text-lg">
                  Please enter your new password
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6 px-0">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-6 py-4 border border-gray-300 rounded-full focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      placeholder="Enter your new password"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-6 py-4 border border-gray-300 rounded-full focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      placeholder="Confirm your new password"
                    />
                  </div>
                </div>

                <Button
                  onClick={handlePasswordUpdate}
                  disabled={isUpdating || !newPassword || !confirmPassword}
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white font-light py-4 rounded-full"
                >
                  {isUpdating ? 'Updating...' : 'Update Password'}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="w-full py-4 flex justify-center border-b border-gray-100">
        <Logo size="sm" className="max-h-8" />
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
                  onClick={() => window.location.href = 'https://therai.co/login'}
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white font-light py-4 rounded-full"
                >
                  Sign In to Continue
                </Button>
              ) : (
                <div className="flex flex-col gap-3 w-full">
                  <Button 
                    onClick={() => window.location.href = 'https://therai.co/login'} 
                    className="w-full bg-gray-900 hover:bg-gray-800 text-white font-light py-4 rounded-full"
                  >
                    Return to Login
                  </Button>
                  {status === 'error' && (
                    <Button 
                      onClick={() => window.location.href = 'https://therai.co/signup'}
                      variant="outline" 
                      className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 font-light py-4 rounded-full"
                    >
                      Create New Account
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
              {/* Force rebuild for pill-shaped buttons */}
            </footer>
    </div>
  );
};

export default ConfirmEmail;
