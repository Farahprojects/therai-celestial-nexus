import { supabase } from '@/integrations/supabase/client';

export type BillingMode = 'SUBSCRIPTION';

export interface UserAccessResult {
  hasAccess: boolean;
  loading: boolean;
  error: string | null;
  subscriptionActive?: boolean;
  subscriptionStatus?: string | null;
  subscriptionPlan?: string | null;
}

/**
 * Get the current billing mode (always SUBSCRIPTION)
 */
export const getBillingMode = (): BillingMode => {
  return 'SUBSCRIPTION';
};

/**
 * Check if user has access based on subscription status
 */
export const checkUserAccess = async (userId: string): Promise<UserAccessResult> => {
  try {
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
 * Get the paywall message
 */
export const getPaywallMessage = (): string => {
  return 'Subscribe to Access';
};

/**
 * Get the upgrade button text
 */
export const getUpgradeButtonText = (): string => {
  return 'View Plans';
};

/**
 * Get the low balance message
 */
export const getLowBalanceMessage = (): string => {
  return 'Subscription inactive';
};

