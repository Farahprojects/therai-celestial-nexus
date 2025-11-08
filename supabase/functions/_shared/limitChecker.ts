// ============================================================================
// PRO LIMIT CHECKER - Centralized feature limit checking
// Single function to check any feature limit using database-driven config
// ============================================================================

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface LimitCheckResult {
  allowed: boolean;
  limit?: number | null;
  current_usage?: number;
  remaining?: number;
  is_unlimited?: boolean;
  reason?: string;
  error_code?: string;
}

export type FeatureType = 
  | 'voice_seconds' 
  | 'image_generation' 
  | 'therai_calls' 
  | 'insights';

/**
 * Check if user has access to a feature based on their subscription plan limits.
 * Uses database-driven limits from plan_limits table for flexibility.
 * 
 * @param supabase - Supabase client (preferably service role)
 * @param userId - User ID to check
 * @param featureType - Feature to check ('voice_seconds', 'image_generation', etc.)
 * @param requestedAmount - Amount being requested (default 1)
 * @returns LimitCheckResult with allowed status and usage info
 */
export async function checkLimit(
  supabase: SupabaseClient,
  userId: string,
  featureType: FeatureType,
  requestedAmount: number = 1
): Promise<LimitCheckResult> {
  try {
    // Call centralized database function
    const { data, error } = await supabase.rpc('check_feature_limit', {
      p_user_id: userId,
      p_feature_type: featureType,
      p_requested_amount: requestedAmount,
      p_period: null // Auto-detect period based on feature type
    });

    if (error) {
      console.error('[limitChecker] RPC error:', error);
      return {
        allowed: false,
        reason: 'Failed to check limit',
        error_code: 'RPC_ERROR'
      };
    }

    return data as LimitCheckResult;
  } catch (err) {
    console.error('[limitChecker] Exception:', err);
    return {
      allowed: false,
      reason: 'Exception checking limit',
      error_code: 'EXCEPTION'
    };
  }
}

/**
 * Get all limits and current usage for a user.
 * Useful for displaying limit information in UI.
 */
export async function getUserLimits(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  limits: {
    plan_id: string;
    plan_name: string;
    voice_seconds: number | null;
    image_generation_daily: number | null;
    therai_calls: number | null;
    insights: number | null;
    features: {
      together_mode: boolean;
      voice_mode: boolean;
      image_generation: boolean;
      priority_support: boolean;
      early_access: boolean;
    };
  };
  usage: {
    voice_seconds: number;
    therai_calls: number;
    insights_count: number;
  };
} | null> {
  try {
    const { data, error } = await supabase.rpc('get_user_limits', {
      p_user_id: userId
    });

    if (error) {
      console.error('[limitChecker] Failed to get user limits:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('[limitChecker] Exception getting limits:', err);
    return null;
  }
}

/**
 * Increment usage after successful feature use.
 * Uses existing increment functions with centralized tracking.
 */
export async function incrementUsage(
  supabase: SupabaseClient,
  userId: string,
  featureType: FeatureType,
  amount: number
): Promise<{ success: boolean; reason?: string }> {
  const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM

  try {
    // Map feature type to RPC function
    const rpcMap: Record<FeatureType, string> = {
      'voice_seconds': 'increment_voice_seconds',
      'therai_calls': 'increment_therai_calls',
      'insights': 'increment_insights_count',
      'image_generation': 'log_image_generation' // Special case
    };

    const rpcFunction = rpcMap[featureType];
    
    if (!rpcFunction) {
      return {
        success: false,
        reason: `Unknown feature type: ${featureType}`
      };
    }

    // Image generation uses different pattern (already logged in image-generate function)
    if (featureType === 'image_generation') {
      return { success: true };
    }

    // Standard increment
    const rpcParams: Record<string, any> = {
      p_user_id: userId,
      p_period: currentPeriod
    };

    // Add amount parameter with correct name
    if (featureType === 'voice_seconds') {
      rpcParams.p_seconds = amount;
    } else if (featureType === 'therai_calls') {
      rpcParams.p_calls = amount;
    } else {
      rpcParams.p_count = amount;
    }

    const { error } = await supabase.rpc(rpcFunction, rpcParams);

    if (error) {
      console.error(`[limitChecker] Failed to increment ${featureType}:`, error);
      return {
        success: false,
        reason: error.message
      };
    }

    return { success: true };
  } catch (err) {
    console.error('[limitChecker] Exception incrementing usage:', err);
    return {
      success: false,
      reason: err instanceof Error ? err.message : 'Unknown error'
    };
  }
}

// ============================================================================
// MIGRATION HELPERS - for transitioning from old system
// ============================================================================

/**
 * Backward compatibility: Map old checkFeatureAccess to new checkLimit
 * @deprecated Use checkLimit directly
 */
export async function checkFeatureAccess(
  supabase: SupabaseClient,
  userId: string,
  featureType: 'voice_seconds' | 'insights_count',
  requestedAmount: number = 1
): Promise<{
  allowed: boolean;
  remaining?: number;
  limit?: number | null;
  reason?: string;
}> {
  const featureMap: Record<string, FeatureType> = {
    'insights_count': 'insights'
  };

  const mappedType = featureMap[featureType] || featureType as FeatureType;
  return await checkLimit(supabase, userId, mappedType, requestedAmount);
}

