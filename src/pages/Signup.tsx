import { useState, useEffect } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import UnifiedNavigation from '@/components/UnifiedNavigation';
import Footer from '@/components/Footer';
import EmailInput from '@/components/auth/EmailInput';
import PasswordInput from '@/components/auth/PasswordInput';
import SocialLogin from '@/components/auth/SocialLogin';
import { validateEmail } from '@/utils/authValidation';
import { Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// Debug utility
const debug = (...args: any[]) => {
  if (process.env.NODE_ENV !== 'production') console.log('[Signup]', ...args);
};

const Signup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signUp, signInWithGoogle, signInWithApple, user } = useAuth();

  // Auto-scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');

  const emailValid = validateEmail(email);
  const passwordValid = password.length >= 8;
  const passwordsMatch = password === confirmPassword;
  const showConfirmPassword = password.length > 0;

  // Redirect if already logged in
  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!emailValid) {
      setErrorMsg('Please enter a valid email address');
      return;
    }
    
    if (!passwordValid) {
      setErrorMsg('Password must be at least 8 characters long');
      return;
    }
    
    if (!passwordsMatch) {
      setErrorMsg('Passwords do not match');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    
    try {
      debug('Attempting signup for:', email);
      
      const { error, user: newUser } = await signUp(email, password);
      
      if (error) {
        debug('Signup error:', error);
        
        if (error.message.includes('User already registered')) {
          setErrorMsg('An account with this email already exists. Try signing in instead.');
        } else if (error.message.includes('Password should be at least')) {
          setErrorMsg('Password must be at least 6 characters long');
        } else if (error.message.includes('Invalid email')) {
          setErrorMsg('Please enter a valid email address');
        } else {
          setErrorMsg(error.message || 'An error occurred during signup');
        }
        
        return;
      }

      if (newUser) {
        debug('Signup successful, user created:', newUser.id);
        
        // Send verification email
        try {
          const { data, error: tokenError } = await supabase.functions.invoke('signup_token', {
            body: { user_id: newUser.id }
          });
          
          if (tokenError) {
            console.error('Error sending verification email:', tokenError);
            toast({
              title: 'Account Created',
              description: 'Your account was created but there was an issue sending the verification email. Please contact support.',
              variant: 'destructive'
            });
          } else {
            debug('Verification email sent successfully');
          }
        } catch (emailError) {
          console.error('Exception sending verification email:', emailError);
        }

        setVerificationEmail(email);
        setCurrentUserId(newUser.id);
        setSignupSuccess(true);
      }
    } catch (err: any) {
      debug('Signup exception:', err);
      setErrorMsg('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      debug('Attempting Google sign in');
      const { error } = await signInWithGoogle();
      
      if (error) {
        debug('Google sign in error:', error);
        setErrorMsg(error.message || 'Google sign in failed');
      }
    } catch (err: any) {
      debug('Google sign in exception:', err);
      setErrorMsg('An error occurred with Google sign in');
    }
  };
  
  const handleAppleSignIn = async () => {
    try {
      debug('Attempting Apple sign in');
      const { error } = await signInWithApple();
      
      if (error) {
        debug('Apple sign in error:', error);
        setErrorMsg(error.message || 'Apple sign in failed');
      }
    } catch (err: any) {
      debug('Apple sign in exception:', err);
      setErrorMsg('An error occurred with Apple sign in');
    }
  };

  const handleResendVerification = async () => {
    if (!currentUserId) {
      toast({
        title: 'Error',
        description: 'Unable to resend verification email. Please try signing up again.',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('signup_token', {
        body: { user_id: currentUserId }
      });
      
      if (error) {
        toast({
          title: 'Error',
          description: 'Failed to resend verification email. Please try again.',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Email Sent',
          description: 'Verification email has been resent. Please check your inbox.',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'An error occurred while resending the email.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const renderSignupForm = () => (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-6">
          <EmailInput 
            email={email}
            isValid={emailValid}
            onChange={setEmail}
            onFocus={() => setErrorMsg('')}
            placeholder="Enter your email"
          />
          
          <PasswordInput
            password={password}
            isValid={passwordValid}
            showRequirements={false}
            onChange={setPassword}
            onFocus={() => setErrorMsg('')}
            placeholder="Create a password"
          />
          
          {passwordValid && (
            <p className="text-sm text-green-600 font-light">✓ Password meets requirements (8+ characters)</p>
          )}
          
          {showConfirmPassword && (
            <PasswordInput
              password={confirmPassword}
              isValid={passwordValid && passwordsMatch}
              showRequirements={false}
              onChange={setConfirmPassword}
              onFocus={() => setErrorMsg('')}
              label="Confirm Password"
              placeholder="Re-enter your password"
              showMatchError={password.length > 0 && confirmPassword.length > 0 && !passwordsMatch}
            />
          )}
        </div>

        {errorMsg && (
          <div className="text-center text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200 font-light">
            {errorMsg}
          </div>
        )}

        <Button 
          type="submit" 
          size="lg"
          className="w-full py-6 text-lg font-light bg-gray-900 text-white hover:bg-gray-800 transition-all duration-300"
          disabled={loading || !emailValid || !passwordValid || !passwordsMatch}
        >
          {loading ? 'Creating account...' : 'Begin'}
        </Button>

        <SocialLogin 
          onGoogleSignIn={handleGoogleSignIn} 
          onAppleSignIn={handleAppleSignIn}
        />

        <p className="text-center text-sm text-gray-600 font-light">
          Already have an account?{' '}
          <Link to="/login" className="text-gray-900 hover:text-gray-700 transition-colors border-b border-gray-300 hover:border-gray-600 pb-1">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );

  const renderSuccessMessage = () => (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center space-y-4">
        <p className="text-lg text-gray-700 font-light">
          A verification email has been sent to <span className="text-gray-900 font-medium">{verificationEmail}</span>. 
          Please check your inbox and click the link to verify your account.
        </p>
      </div>

      <div className="flex flex-col space-y-6 items-center">
        <div className="rounded-full bg-gray-100 p-6 border border-gray-200">
          <Mail className="h-12 w-12 text-gray-700" />
        </div>
        
        <div className="text-center space-y-2">
          <p className="text-gray-600 font-light">
            After verification, you'll be able to sign in to your account.
          </p>
        </div>

        <div className="flex flex-col space-y-4 w-full max-w-md">
          <Button 
            onClick={handleResendVerification} 
            variant="outline" 
            disabled={loading}
            size="lg"
            className="w-full py-4 font-light border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-all duration-300"
          >
            {loading ? 'Sending...' : 'Resend verification email'}
          </Button>
          
          <Link to="/login" className="w-full">
            <Button 
              size="lg"
              className="w-full py-4 font-light bg-gray-900 text-white hover:bg-gray-800 transition-all duration-300"
            >
              Go to Login
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <UnifiedNavigation />

      <main className="flex-grow flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg space-y-12">
          <header className="text-center space-y-4">
            <h1 className="text-5xl md:text-6xl font-light text-gray-900 leading-tight">
              {signupSuccess ? (
                <>
                  Check your
                  <br />
                  <span className="italic font-medium">email</span>
                </>
              ) : (
                <>
                  Join
                  <br />
                  <span className="italic font-medium">Therai</span>
                </>
              )}
            </h1>
            <p className="text-lg text-gray-600 font-light">
              {signupSuccess 
                ? 'One more step to complete your registration' 
                : 'Begin your journey of self-discovery'}
            </p>
          </header>

          {signupSuccess ? renderSuccessMessage() : renderSignupForm()}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Signup;
