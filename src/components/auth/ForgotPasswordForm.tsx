import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { showToast } from '@/utils/notifications';
import { supabase } from '@/integrations/supabase/client';
import EmailInput from '@/components/auth/EmailInput';
import { validateEmail } from '@/utils/authValidation';
import { ArrowLeft, CheckCircle } from 'lucide-react';

interface ForgotPasswordFormProps {
  onCancel: () => void;
}

const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({ onCancel }) => {
  
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [resetLinkSent, setResetLinkSent] = useState(false);
  const emailValid = validateEmail(email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailValid || loading) return;

    setLoading(true);
    try {
      // Call the password_token edge function with email as payload
      const { error } = await supabase.functions.invoke('password_token', {
        body: { email }
      });

      if (error) {
        showToast({ 
          title: 'Error', 
          description: error.message,
          variant: 'destructive'
        });
      } else {
        setEmailSent(true);
        setResetLinkSent(true);
      }
    } catch (err) {
      showToast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to send reset email',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="max-w-md mx-auto space-y-8 text-center">
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>
          
          <div className="space-y-3">
            <h3 className="text-2xl font-light text-gray-900">Check your <em>email</em></h3>
            <p className="text-gray-600 font-light leading-relaxed">
              We sent a password reset link to <span className="font-medium text-gray-900">{email}</span>
          </p>
          </div>
        </div>

        <div className="space-y-6">
          <p className="text-sm text-gray-500 font-light">
            Didn't receive the email? Check your spam folder or request another link.
          </p>
          
          <div className="space-y-4">
            <Button 
              onClick={() => setEmailSent(false)}
              className="w-full bg-gray-900 text-white hover:bg-gray-800 font-light px-8 py-4 rounded-full text-lg"
            >
              Try again
            </Button>
            
            <Button 
              variant="outline" 
              onClick={onCancel}
              className="w-full border-gray-900 text-gray-900 hover:bg-gray-50 font-light px-8 py-4 rounded-full text-lg"
            >
              Back to login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-8">
      <div className="text-center space-y-4">
        <h3 className="text-2xl font-light text-gray-900">Reset your <em>password</em></h3>
        <p className="text-gray-600 font-light leading-relaxed">
          Enter your email and we'll send you a link to reset your password
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-6">
          <EmailInput 
            email={email} 
            isValid={emailValid} 
            onChange={setEmail} 
          />
        </div>

        <div className="space-y-4">
          <Button 
            type="submit" 
            className="w-full bg-gray-900 text-white hover:bg-gray-800 font-light px-8 py-4 rounded-full text-lg" 
            disabled={loading || !emailValid}
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </Button>
          
          {resetLinkSent && (
            <div className="flex items-center justify-center text-sm text-green-600 py-3 font-light">
              <CheckCircle className="h-4 w-4 mr-2" />
              Reset link sent! Check your email
            </div>
          )}
          
          <Button 
            type="button" 
            variant="outline"
            onClick={onCancel}
            className="w-full flex items-center justify-center gap-3 border-gray-900 text-gray-900 hover:bg-gray-50 font-light px-8 py-4 rounded-full text-lg"
          >
            <ArrowLeft size={18} /> Back to Login
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ForgotPasswordForm;
