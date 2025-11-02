import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Loader, CheckCircle } from 'lucide-react';
import { showToast } from "@/utils/notifications";
import { supabase } from '@/integrations/supabase/client';
import PasswordInput from './PasswordInput';
import { passwordRequirements } from '@/utils/authValidation';

interface PasswordResetFormProps {
  onSuccess: () => void;
}

const PasswordResetForm: React.FC<PasswordResetFormProps> = ({ onSuccess }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  

  // Check if password meets requirements
  const passwordValid = passwordRequirements.every(req => req.validate(newPassword));
  
  // Check if passwords match
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!passwordValid) {
      showToast({
        variant: 'destructive',
        title: 'Invalid Password',
        description: 'Please ensure your password meets all requirements.'
      });
      return;
    }

    if (!passwordsMatch) {
      showToast({
        variant: 'destructive',
        title: 'Password Mismatch',
        description: 'Passwords do not match.'
      });
      return;
    }

    setIsUpdating(true);

    try {
      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Update password using Supabase auth
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        throw new Error(error.message || 'Failed to update password');
      }


      // Sign out the user after password update to ensure clean state
      await supabase.auth.signOut();

      setShowSuccess(true);
      showToast({
        variant: 'success',
        title: 'Password Updated Successfully!',
        description: 'Please sign in with your new password.'
      });

      // Show success for a moment, then call onSuccess
      setTimeout(() => {
        onSuccess();
      }, 2000);

    } catch (error: any) {
      showToast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'Failed to update password. Please try again.'
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-8 pt-8">
      <div className="text-center space-y-4">
        <h3 className="text-2xl font-light text-gray-900">Set your new <em>password</em></h3>
        <p className="text-gray-600 font-light leading-relaxed">
          Please create a new password for your account
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-6">
          <PasswordInput
            password={newPassword}
            isValid={passwordValid}
            onChange={setNewPassword}
            label="New Password"
            placeholder="Enter your new password"
            id="newPassword"
          />

          {passwordValid && (
            <PasswordInput
              password={confirmPassword}
              isValid={passwordsMatch}
              onChange={setConfirmPassword}
              label="Confirm New Password"
              placeholder="Confirm your new password"
              id="confirmPassword"
              showRequirements={false}
              showMatchError={confirmPassword.length > 0 && !passwordsMatch}
            />
          )}
        </div>

        <div className="space-y-4">
          <Button
            type="submit"
            className="w-full bg-gray-900 text-white hover:bg-gray-800 font-light px-8 py-4 rounded-full text-lg"
            disabled={!passwordValid || !passwordsMatch || isUpdating || showSuccess}
          >
            {isUpdating ? (
              <>
                <Loader className="h-5 w-5 mr-3 animate-spin" />
                Updating Password...
              </>
            ) : showSuccess ? (
              <>
                <CheckCircle className="h-5 w-5 mr-3" />
                Password Updated Successfully!
              </>
            ) : (
              'Update Password'
            )}
          </Button>

          {showSuccess && (
            <div className="text-center text-sm text-green-600 mt-4 font-light">
              Success! Redirecting to login...
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

export default PasswordResetForm;
