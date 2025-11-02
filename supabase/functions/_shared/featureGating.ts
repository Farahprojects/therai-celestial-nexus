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

  // 4. Get current usage for this period (modular table: one row per user per period)
  const { data: usageData, error: usageError } = await supabase
    .from('feature_usage')
    .select('voice_seconds, insights_count')
    .eq('user_id', userId)
    .eq('period', currentPeriod)
    .maybeSingle();

  if (usageError) {
    console.error('[featureGating] Failed to fetch usage:', usageError);
    return { allowed: false, reason: 'Unable to verify usage' };
  }

  // Extract usage for the specific feature type from the row
  const currentUsage = featureType === 'voice_seconds' 
    ? (usageData?.voice_seconds || 0)
    : (usageData?.insights_count || 0);
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
 * Check free tier STT access - gives all users 2 minutes free, then blocks
 * Premium users bypass this check (unlimited)
 * 
 * @param supabase - Supabase client (service role)
 * @param userId - User ID to check
 * @param requestedSeconds - Seconds requested (for checking if would exceed limit)
 * @returns Access check result with usage info
 */
export async function checkFreeTierSTTAccess(
  supabase: SupabaseClient<any>,
  userId: string,
  requestedSeconds: number = 0
): Promise<{
  allowed: boolean;
  currentUsage: number;
  remaining: number;
  limit: number;
  isPremium: boolean;
  reason?: string;
}> {
  const FREE_TIER_LIMIT = 120; // 2 minutes free for all users
  
  // 1. Get user's subscription plan
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('subscription_plan, subscription_active, subscription_status')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    console.error('[featureGating] Failed to fetch profile:', profileError);
    return {
      allowed: false,
      currentUsage: 0,
      remaining: 0,
      limit: FREE_TIER_LIMIT,
      isPremium: false,
      reason: 'Unable to verify subscription'
    };
  }

  // 2. Check if user has premium plan (unlimited)
  const plan = profile.subscription_plan || 'free';
  const limits = FEATURE_LIMITS[plan];
  const isPremium = limits?.voice_seconds === null; // Premium plans have null = unlimited

  if (isPremium && profile.subscription_active && 
      ['active', 'trialing'].includes(profile.subscription_status || '')) {
    // Premium user - unlimited access
    return {
      allowed: true,
      currentUsage: 0,
      remaining: Infinity,
      limit: Infinity,
      isPremium: true
    };
  }

  // 3. Free tier users - check usage
  const currentPeriod = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  
  const { data: usageData, error: usageError } = await supabase
    .from('feature_usage')
    .select('voice_seconds')
    .eq('user_id', userId)
    .eq('period', currentPeriod)
    .maybeSingle();

  if (usageError) {
    console.error('[featureGating] Failed to fetch usage:', usageError);
    return {
      allowed: false,
      currentUsage: 0,
      remaining: 0,
      limit: FREE_TIER_LIMIT,
      isPremium: false,
      reason: 'Unable to verify usage'
    };
  }

  const currentUsage = usageData?.voice_seconds || 0;
  const remaining = Math.max(0, FREE_TIER_LIMIT - currentUsage);

  // 4. Check if requested amount would exceed free tier limit
  if (requestedSeconds > 0 && currentUsage + requestedSeconds > FREE_TIER_LIMIT) {
    return {
      allowed: false,
      currentUsage,
      remaining,
      limit: FREE_TIER_LIMIT,
      isPremium: false,
      reason: `Free tier limit reached (${currentUsage}/${FREE_TIER_LIMIT} seconds)`
    };
  }

  // 5. Check if already at or over limit
  if (currentUsage >= FREE_TIER_LIMIT) {
    return {
      allowed: false,
      currentUsage,
      remaining: 0,
      limit: FREE_TIER_LIMIT,
      isPremium: false,
      reason: `Free tier limit reached (${currentUsage}/${FREE_TIER_LIMIT} seconds)`
    };
  }

  // 6. Allow access
  return {
    allowed: true,
    currentUsage,
    remaining: remaining - requestedSeconds,
    limit: FREE_TIER_LIMIT,
    isPremium: false
  };
}

/**
 * PRO-LEVEL: Atomically check limit and increment usage in a single transaction.
 * This prevents race conditions and ensures limits are never exceeded.
 * 
 * @param supabase - Supabase client (service role)
 * @param userId - User ID
 * @param featureType - Type of feature used
 * @param amount - Amount to increment
 * @returns Result with success status and usage details
 */
export async function atomicCheckAndIncrement(
  supabase: SupabaseClient<any>,
  userId: string,
  featureType: 'voice_seconds' | 'insights_count',
  amount: number
): Promise<{
  success: boolean;
  previousUsage?: number;
  newUsage?: number;
  remaining?: number;
  limit?: number;
  reason?: string;
  errorCode?: string;
}> {
  // Input validation
  if (!userId || typeof userId !== 'string') {
    return {
      success: false,
      reason: 'Invalid user ID',
      errorCode: 'INVALID_USER_ID'
    };
  }

  if (!amount || amount <= 0 || !Number.isInteger(amount)) {
    return {
      success: false,
      reason: 'Invalid amount: must be a positive integer',
      errorCode: 'INVALID_AMOUNT'
    };
  }

  // Get user's subscription plan to determine limit
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('subscription_plan, subscription_active, subscription_status')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    console.error('[featureGating] Failed to fetch profile:', profileError);
    return {
      success: false,
      reason: 'Unable to verify subscription',
      errorCode: 'PROFILE_ERROR'
    };
  }

  // Check if user has active subscription
  if (!profile.subscription_active || 
      !['active', 'trialing'].includes(profile.subscription_status || '')) {
    return {
      success: false,
      reason: 'No active subscription',
      errorCode: 'NO_SUBSCRIPTION'
    };
  }

  const plan = profile.subscription_plan;
  const limits = FEATURE_LIMITS[plan];
  
  if (!limits) {
    console.warn(`[featureGating] Unknown plan: ${plan}`);
    return {
      success: false,
      reason: 'Unknown subscription plan',
      errorCode: 'UNKNOWN_PLAN'
    };
  }

  // Check if unlimited
  const limit = limits[featureType];
  if (limit === null) {
    // Unlimited - just increment without checking
    const currentPeriod = new Date().toISOString().slice(0, 7);
    const rpcFunction = featureType === 'voice_seconds' 
      ? 'increment_voice_seconds'
      : 'increment_insights_count';
    const rpcParams = featureType === 'voice_seconds'
      ? { p_user_id: userId, p_seconds: amount, p_period: currentPeriod }
      : { p_user_id: userId, p_count: amount, p_period: currentPeriod };

    const { error } = await supabase.rpc(rpcFunction, rpcParams);
    
    if (error) {
      return {
        success: false,
        reason: `Failed to increment: ${error.message}`,
        errorCode: 'INCREMENT_ERROR'
      };
    }

    return {
      success: true,
      limit: null,
      remaining: null
    };
  }

  // Use atomic check-and-increment function
  const currentPeriod = new Date().toISOString().slice(0, 7);
  const rpcFunction = featureType === 'voice_seconds' 
    ? 'check_and_increment_voice_seconds'
    : 'check_and_increment_insights_count';
  
  const rpcParams = featureType === 'voice_seconds'
    ? { p_user_id: userId, p_seconds: amount, p_period: currentPeriod, p_limit: limit }
    : { p_user_id: userId, p_count: amount, p_period: currentPeriod, p_limit: limit };

  console.log(`[featureGating] Atomic check-and-increment:`, {
    function: rpcFunction,
    params: rpcParams
  });

  const { data, error } = await supabase.rpc(rpcFunction, rpcParams);

  if (error) {
    console.error(`[featureGating] RPC error:`, error);
    return {
      success: false,
      reason: `Database error: ${error.message}`,
      errorCode: 'RPC_ERROR'
    };
  }

  // Parse JSONB response
  const result = data as any;
  
  if (!result.success) {
    console.warn(`[featureGating] Limit check failed:`, result);
    return {
      success: false,
      reason: result.reason || 'Limit exceeded',
      errorCode: result.error_code || 'LIMIT_EXCEEDED',
      limit: result.limit,
      remaining: result.remaining
    };
  }

  console.log(`[featureGating] ✅ Atomic increment successful:`, {
    previousUsage: result.previous_usage,
    incrementedBy: result.incremented_by,
    newUsage: result.new_usage,
    remaining: result.remaining
  });

  return {
    success: true,
    previousUsage: result.previous_usage,
    newUsage: result.new_usage,
    remaining: result.remaining,
    limit: result.limit
  };
}

/**
 * Increment feature usage atomically after successful operation.
 * This should be called AFTER the feature has been successfully used.
 * Uses the modular table structure with specific increment functions.
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
  amount: number,
  retryAttempts: number = 3
): Promise<void> {
  // Input validation
  if (!userId || typeof userId !== 'string') {
    console.error('[featureGating] Invalid user ID');
    return;
  }

  if (!amount || amount <= 0 || !Number.isInteger(amount)) {
    console.error('[featureGating] Invalid amount:', amount);
    return;
  }

  const currentPeriod = new Date().toISOString().slice(0, 7);
  
  console.log(`[featureGating] incrementFeatureUsage called:`, {
    userId,
    featureType,
    amount,
    period: currentPeriod
  });

  // Retry logic for transient failures
  let lastError: any = null;
  for (let attempt = 1; attempt <= retryAttempts; attempt++) {
    try {
      // Call the specific increment function based on feature type
      const rpcFunction = featureType === 'voice_seconds' 
        ? 'increment_voice_seconds'
        : 'increment_insights_count';

      const rpcParams = featureType === 'voice_seconds'
        ? { p_user_id: userId, p_seconds: amount, p_period: currentPeriod }
        : { p_user_id: userId, p_count: amount, p_period: currentPeriod };

      console.log(`[featureGating] Attempt ${attempt}/${retryAttempts}: Calling RPC ${rpcFunction} with params:`, rpcParams);
      
      const { error, data } = await supabase.rpc(rpcFunction, rpcParams);

      if (error) {
        lastError = error;
        
        // Check if it's a retryable error (network/timeout issues)
        const isRetryable = error.code === 'PGRST116' || // Connection error
                           error.message?.includes('timeout') ||
                           error.message?.includes('network');
        
        if (!isRetryable || attempt === retryAttempts) {
          console.error(`[featureGating] ❌ Failed to increment ${featureType}:`, {
            error: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            attempt
          });
          return;
        }
        
        // Wait before retry (exponential backoff)
        const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.warn(`[featureGating] Retryable error, retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }

      // Success!
      console.log(`[featureGating] ✅ Successfully incremented ${featureType} by ${amount} for user ${userId} in period ${currentPeriod}`);
      return;
      
    } catch (err) {
      lastError = err;
      if (attempt === retryAttempts) {
        console.error(`[featureGating] ❌ Exception after ${retryAttempts} attempts:`, err);
        return;
      }
      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  // If we get here, all retries failed
  console.error(`[featureGating] ❌ All ${retryAttempts} attempts failed. Last error:`, lastError);
}

