import { supabase } from '@/integrations/supabase/client';

export interface EmailVerificationStatus {
  isVerified: boolean;
  needsVerification: boolean;
  email?: string;
  error?: string;
}

/**
 * Check if a user's email is verified using the custom profiles table
 * This replaces the old logic that checked auth.users.email_confirmed_at
 */
export const checkEmailVerificationStatus = async (userId: string): Promise<EmailVerificationStatus> => {
  try {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('email, email_verified')
      .eq('id', userId)
      .single();

    if (profileError || !profileData) {
      return {
        isVerified: false,
        needsVerification: true,
        error: 'Profile not found'
      };
    }

    const isVerified = profileData.email_verified === true;
    
    return {
      isVerified,
      needsVerification: !isVerified,
      email: profileData.email || undefined
    };

  } catch (error) {
    console.error('Error checking email verification status:', error);
    return {
      isVerified: false,
      needsVerification: true,
      error: 'Failed to check verification status'
    };
  }
};

/**
 * Legacy function for checking Supabase's email_confirmed_at field
 * Used for email change verification (when user changes email while signed in)
 */
export const checkLegacyEmailVerification = (user: Record<string, unknown>): EmailVerificationStatus => {
  const isVerified = user?.email_confirmed_at !== null;
  
  return {
    isVerified,
    needsVerification: !isVerified,
    email: user?.email
  };
};

/**
 * Determine which verification check to use based on context
 * - New signups: Use custom profiles.email_verified
 * - Email changes: Use legacy auth.users.email_confirmed_at
 */
export const getEmailVerificationStatus = async (
  user: Record<string, unknown>, 
  context: 'signup' | 'email_change' = 'signup'
): Promise<EmailVerificationStatus> => {
  if (context === 'email_change') {
    // For email changes, use legacy Supabase auth check
    return checkLegacyEmailVerification(user);
  }
  
  // For new signups, use custom profiles table check
  if (user?.id) {
    return await checkEmailVerificationStatus(user.id);
  }
  
  return {
    isVerified: false,
    needsVerification: true,
    error: 'User ID not found'
  };
};
