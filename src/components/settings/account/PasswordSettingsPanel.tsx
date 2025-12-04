import { useState } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Check, Loader, Eye, EyeOff, CheckCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import PasswordInput from "@/components/auth/PasswordInput";
// Removed usePasswordManagement import - now using edge functions
import { cn } from "@/lib/utils";

type PasswordFormValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export const PasswordSettingsPanel = () => {
  
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordStep, setPasswordStep] = useState<'verify' | 'create' | 'confirm'>('verify');
  const [passwordValid, setPasswordValid] = useState({
    length: false
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [invalidPasswordError, setInvalidPasswordError] = useState(false);
  const [showSuccessButton, setShowSuccessButton] = useState(false);
  // Password management functions using edge functions

  const passwordForm = useForm<PasswordFormValues>({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    }
  });

  const currentPassword = passwordForm.watch("currentPassword");
  const newPassword = passwordForm.watch("newPassword");
  const confirmPassword = passwordForm.watch("confirmPassword");
  
  // Check if passwords match
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  // Check if password requirement is met
  const passwordRequirementMet = passwordValid.length;

  // Check for password validation on change
  const handlePasswordChange = (value: string) => {
    passwordForm.setValue("newPassword", value);
    
    setPasswordValid({
      length: value.length >= 8
    });
  };

  const handleCurrentPasswordVerification = async () => {
    if (!currentPassword) return;
    
    setIsUpdatingPassword(true);
    setInvalidPasswordError(false);
    
    try {
      // Get the current user's email
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;
      
      if (!userEmail) {
        setIsUpdatingPassword(false);
        return;
      }
      
      // Verify current password using Supabase auth
      const { error } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword
      });

      if (error) {
        setInvalidPasswordError(true);
        setIsUpdatingPassword(false);
        return;
      }

      // Password verified, move to next step
      setPasswordStep('create');
      setIsUpdatingPassword(false);
    } catch {
      setIsUpdatingPassword(false);
    }
  };

  const onPasswordSubmit = async (data: PasswordFormValues) => {
    if (data.newPassword !== data.confirmPassword) {
      passwordForm.setError("confirmPassword", { 
        message: "The passwords do not match" 
      });
      return;
    }
    
    setIsUpdatingPassword(true);
    
    try {
      // Get current user ID
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      
      if (!userId) {
        setIsUpdatingPassword(false);
        return;
      }

      // Update password using Supabase auth
      const { error } = await supabase.auth.updateUser({
        password: data.newPassword
      });

      if (error) {
        setIsUpdatingPassword(false);
        return;
      }
      
      // Show success button animation
      setShowSuccessButton(true);
      setIsUpdatingPassword(false);
      
      // Delay form reset and transition back to verify step after showing success animation
      setTimeout(() => {
        setShowSuccessButton(false);
        passwordForm.reset();
        setPasswordStep('verify');
      }, 3000);
      
    } catch {
      setIsUpdatingPassword(false);
    }
  };
  
  const handleResetPassword = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;
      
      if (!userEmail) {
        return;
      }
      
      setResetEmailSent(false);
      
      // Use password_token edge function to reset password
      const { error } = await supabase.functions.invoke('password_token', {
        body: {
          email: userEmail
        }
      });

      if (error) {
        return;
      }
      
      // Show inline success message instead of toast
      setResetEmailSent(true);
    } catch {
      // Error handled silently
    }
  };

  return (
    <div>
      <h3 className="text-lg font-medium mb-4">Change Password</h3>
      
      <Form {...passwordForm}>
        <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4 max-w-md">
          {passwordStep === 'verify' && (
            <>
              <FormField
                control={passwordForm.control}
                name="currentPassword"
                render={({ field }: { field: any }) => (
                  <FormItem>
                    <FormLabel>Current Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          type={showCurrentPassword ? "text" : "password"} 
                          {...field} 
                          placeholder="Enter your current password"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                          tabIndex={-1}
                        >
                          {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </FormControl>
                    {invalidPasswordError && (
                      <div className="text-red-500 text-xs mt-1">Invalid password</div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center space-x-2">
                  <Button 
                    type="button"
                    variant="link"
                    className="text-sm p-0 h-auto"
                    onClick={handleResetPassword}
                  >
                    Forgot password?
                  </Button>
                  
                  {resetEmailSent && (
                    <span className="text-xs text-green-600 flex items-center">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Reset link sent!
                    </span>
                  )}
                </div>
                
                <Button 
                  type="button" 
                  onClick={handleCurrentPasswordVerification}
                  disabled={!currentPassword || isUpdatingPassword}
                >
                  {isUpdatingPassword ? (
                    <>
                      <Loader className="h-4 w-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : "OK"}
                </Button>
              </div>
            </>
          )}
          
          {passwordStep === 'create' && (
            <>
              <div className="space-y-4">
                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }: { field: any }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <PasswordInput
                          password={field.value}
                          isValid={passwordRequirementMet}
                          onChange={handlePasswordChange}
                          showRequirements={false}
                          placeholder="Enter your new password"
                          id="newPassword"
                          label=""
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="mt-2">
                  {!passwordValid.length && newPassword.length > 0 && (
                    <div className="text-xs text-gray-600 flex items-center">
                      <span>At least 8 characters</span>
                    </div>
                  )}
                  {passwordValid.length && (
                    <div className="text-xs text-green-600 flex items-center">
                      <span>At least 8 characters</span>
                      <Check size={16} className="ml-1" />
                    </div>
                  )}
                </div>
                
                {passwordRequirementMet && (
                  <FormField
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field }: { field: any }) => (
                      <FormItem>
                        <FormLabel>Confirm New Password</FormLabel>
                        <FormControl>
                          <PasswordInput
                            password={field.value}
                            isValid={field.value === newPassword && field.value.length > 0}
                            onChange={(value: string) => passwordForm.setValue("confirmPassword", value)}
                            showRequirements={false}
                            placeholder="Confirm your new password"
                            id="confirmPassword"
                            label=""
                          />
                        </FormControl>
                        {confirmPassword.length > 0 && (
                          <div className="text-xs mt-1">
                            {passwordsMatch ? (
                              <span className="text-green-600">Matching</span>
                            ) : (
                              <span className="text-red-500">Not matching</span>
                            )}
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                <div className="flex items-center justify-end">
                  <div className="flex ml-auto space-x-2">
                    <Button 
                      type="button"
                      variant="outline"
                      onClick={() => setPasswordStep('verify')}
                      disabled={isUpdatingPassword}
                    >
                      Cancel
                    </Button>
                    
                    <Button 
                      type="submit" 
                      className={cn(
                        showSuccessButton ? "bg-green-500 hover:bg-green-500" : ""
                      )}
                      disabled={
                        !newPassword || 
                        !passwordRequirementMet || 
                        (passwordRequirementMet && !confirmPassword) ||
                        !passwordsMatch ||
                        isUpdatingPassword
                      }
                    >
                      {isUpdatingPassword ? (
                        <>
                          <Loader className="h-4 w-4 mr-2 animate-spin" />
                          Updating...
                        </>
                      ) : showSuccessButton ? (
                        <Check className="h-5 w-5 animate-pulse" />
                      ) : "Update Password"}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </form>
      </Form>
    </div>
  );
};

export default PasswordSettingsPanel;
