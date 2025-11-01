import { supabase } from '@/integrations/supabase/client';
import { BILLING_MODE } from '@/integrations/supabase/config';

export type BillingMode = 'CREDIT' | 'SUBSCRIPTION';

export interface UserAccessResult {
  hasAccess: boolean;
  loading: boolean;
  error: string | null;
  // Credit mode specific
  credits?: number;
  // Subscription mode specific
  subscriptionActive?: boolean;
  subscriptionStatus?: string | null;
  subscriptionPlan?: string | null;
}

/**
 * Get the current billing mode
 */
export const getBillingMode = (): BillingMode => {
  return BILLING_MODE;
};

/**
 * Check if user has access based on current billing mode
 * - CREDIT mode: Checks if user has credits > 0
 * - SUBSCRIPTION mode: Checks if subscription is active
 */
export const checkUserAccess = async (userId: string): Promise<UserAccessResult> => {
  try {
    if (BILLING_MODE === 'CREDIT') {
      // Credit mode: Check credit balance
      const { data, error } = await supabase
        .from('user_credits')
        .select('credits')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching credits:', error);
        return {
          hasAccess: false,
          loading: false,
          error: error.message,
          credits: 0,
        };
      }

      const credits = data?.credits || 0;
      return {
        hasAccess: credits > 0,
        loading: false,
        error: null,
        credits,
      };
    } else {
      // Subscription mode: Check subscription status
      const { data, error } = await supabase
        .from('profiles')
        .select('subscription_active, subscription_status, subscription_plan')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching subscription status:', error);
        return {
          hasAccess: false,
          loading: false,
          error: error.message,
          subscriptionActive: false,
        };
      }

      const isActive = data?.subscription_active && 
                      ['active', 'trialing'].includes(data?.subscription_status || '');

      return {
        hasAccess: isActive,
        loading: false,
        error: null,
        subscriptionActive: data?.subscription_active || false,
        subscriptionStatus: data?.subscription_status || null,
        subscriptionPlan: data?.subscription_plan || null,
      };
    }
  } catch (err) {
    console.error('Exception in checkUserAccess:', err);
    return {
      hasAccess: false,
      loading: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
};

/**
 * Get the appropriate paywall message based on billing mode
 */
export const getPaywallMessage = (): string => {
  if (BILLING_MODE === 'CREDIT') {
    return 'Get Started';
  } else {
    return 'Subscribe to Access';
  }
};

/**
 * Get the appropriate upgrade button text based on billing mode
 */
export const getUpgradeButtonText = (): string => {
  if (BILLING_MODE === 'CREDIT') {
    return 'Purchase Credits';
  } else {
    return 'View Plans';
  }
};

/**
 * Get the appropriate low balance message based on billing mode
 */
export const getLowBalanceMessage = (): string => {
  if (BILLING_MODE === 'CREDIT') {
    return 'Low credit balance';
  } else {
    return 'Subscription inactive';
  }
};

