import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { FEATURE_LIMITS, FeatureCheckResult } from "./featureLimits.ts";

/**
 * Check if a user has access to a specific feature based on their subscription plan
 * and current usage. This is the main gating function called before allowing operations.
 * 
 * @param supabase - Supabase client (service role)
 * @param userId - User ID to check
 * @param featureType - Type of feature ('voice_seconds' or 'insights_count')
 * @param requestedAmount - Amount requested (default 1, for voice this is seconds)
 * @returns FeatureCheckResult with allowed status and usage info
 */
export async function checkFeatureAccess(
  supabase: SupabaseClient<any>,
  userId: string,
  featureType: 'voice_seconds' | 'insights_count',
  requestedAmount: number = 1
): Promise<FeatureCheckResult> {
  
  // 1. Get user's subscription plan and status
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('subscription_plan, subscription_active, subscription_status')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    console.error('[featureGating] Failed to fetch profile:', profileError);
    return { allowed: false, reason: 'Unable to verify subscription' };
  }

  // 2. Check if user has active subscription
  if (!profile.subscription_active || 
      !['active', 'trialing'].includes(profile.subscription_status || '')) {
    return { allowed: false, reason: 'No active subscription' };
  }

  const plan = profile.subscription_plan;
  const limits = FEATURE_LIMITS[plan];
  
  // 3. Check if plan has this feature unlimited (null = unlimited)
  if (!limits) {
    console.warn(`[featureGating] Unknown plan: ${plan}, denying access`);
    return { allowed: false, reason: 'Unknown subscription plan' };
  }

  if (limits[featureType] === null) {
    // Unlimited feature for this plan
    return { allowed: true, limit: null };
  }

  const limit = limits[featureType] as number;
  const currentPeriod = new Date().toISOString().slice(0, 7); // 'YYYY-MM'

  // 4. Get current usage for this period
  const { data: usageData, error: usageError } = await supabase
    .from('feature_usage')
    .select('usage_amount')
    .eq('user_id', userId)
    .eq('feature_type', featureType)
    .eq('period', currentPeriod)
    .maybeSingle();

  if (usageError) {
    console.error('[featureGating] Failed to fetch usage:', usageError);
    return { allowed: false, reason: 'Unable to verify usage' };
  }

  const currentUsage = usageData?.usage_amount || 0;
  const remaining = limit - currentUsage;

  // 5. Check if requested amount would exceed limit
  if (currentUsage + requestedAmount > limit) {
    return { 
      allowed: false, 
      remaining: Math.max(0, remaining),
      limit,
      reason: `Monthly limit reached (${currentUsage}/${limit})` 
    };
  }

  // 6. Allow access with remaining amount
  return { 
    allowed: true, 
    remaining: remaining - requestedAmount,
    limit 
  };
}

/**
 * Increment feature usage atomically after successful operation.
 * This should be called AFTER the feature has been successfully used.
 * 
 * @param supabase - Supabase client (service role)
 * @param userId - User ID
 * @param featureType - Type of feature used
 * @param amount - Amount to increment
 */
export async function incrementFeatureUsage(
  supabase: SupabaseClient<any>,
  userId: string,
  featureType: 'voice_seconds' | 'insights_count',
  amount: number
): Promise<void> {
  const currentPeriod = new Date().toISOString().slice(0, 7);

  const { error } = await supabase.rpc('increment_feature_usage', {
    p_user_id: userId,
    p_feature_type: featureType,
    p_amount: amount,
    p_period: currentPeriod
  });

  if (error) {
    console.error('[featureGating] Failed to increment usage:', error);
    // Don't throw - we don't want to fail the operation just because tracking failed
  }
}

