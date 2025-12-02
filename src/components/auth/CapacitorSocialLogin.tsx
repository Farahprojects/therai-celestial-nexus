import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FcGoogle } from 'react-icons/fc';
import { FaApple } from 'react-icons/fa';
import { getAuthManager } from '@/services/authManager';
import { toast } from 'sonner';

interface CapacitorSocialLoginProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function CapacitorSocialLogin({ onSuccess, onError }: CapacitorSocialLoginProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleOAuthSignIn = async (provider: 'google' | 'apple') => {
    try {
      console.log('[CapacitorSocialLogin] Button clicked:', provider);
      setIsLoading(provider);
      
      const authManager = getAuthManager();
      console.log('[CapacitorSocialLogin] AuthManager retrieved:', authManager);
      
      const { error } = await authManager.signInWithOAuth(provider);
      
      if (error) {
        console.error(`${provider} OAuth error:`, error);
        toast.error(`Failed to sign in with ${provider}`);
        onError?.(error as Error);
        setIsLoading(null);
      } else {
        // Success - auth state will update via Supabase listener
        console.log(`${provider} OAuth initiated successfully`);
        setIsLoading(null);
        onSuccess?.();
      }
    } catch (error) {
      console.error(`${provider} sign-in error:`, error);
      toast.error(`Failed to sign in with ${provider}`);
      onError?.(error as Error);
      setIsLoading(null);
    }
  };

  return (
    <div className="space-y-3">
      <Button
        type="button"
        className="w-full h-12 rounded-full bg-white text-black hover:bg-white/90"
        onClick={() => handleOAuthSignIn('google')}
        disabled={isLoading !== null}
      >
        <FcGoogle className="mr-2 h-5 w-5" />
        {isLoading === 'google' ? 'Signing in...' : 'Continue with Google'}
      </Button>

      <Button
        type="button"
        className="w-full h-12 rounded-full bg-white text-black hover:bg-white/90"
        onClick={() => handleOAuthSignIn('apple')}
        disabled={isLoading !== null}
      >
        <FaApple className="mr-2 h-5 w-5" />
        {isLoading === 'apple' ? 'Signing in...' : 'Continue with Apple'}
      </Button>
    </div>
  );
}
