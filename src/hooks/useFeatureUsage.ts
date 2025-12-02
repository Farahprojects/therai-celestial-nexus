import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface VoiceUsageData {
  is_unlimited?: boolean;
  limit?: number | null;
  seconds_used?: number;
}

interface LimitsData {
  limits?: Record<string, unknown>;
  usage?: Record<string, unknown>;
}

export interface FeatureUsage {
  voice_seconds: {
    used: number;
    limit: number | null;
    remaining: number | null;
  };
  insights_count: {
    used: number;
    limit: number | null;
    remaining: number | null;
  };
  period: string;
  subscription_active: boolean;
  subscription_plan: string;
}

/**
 * Hook to fetch and monitor feature usage for the current user.
 * Returns current monthly usage for voice seconds and insights count.
 * 
 * @returns {FeatureUsage | null} Current usage data or null if loading/error
 */
export function useFeatureUsage() {
  const { user } = useAuth();
  const [usage, setUsage] = useState<FeatureUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = async () => {
    if (!user) {
      setUsage(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [
        { data: voiceData, error: voiceError },
        { data: limitsData, error: limitsError },
        { data: profileData, error: profileError }
      ] = await Promise.all([
        supabase.rpc('check_voice_limit', {
          p_user_id: user.id,
          p_requested_seconds: 0
        }),
        supabase.rpc('get_user_limits', {
          p_user_id: user.id
        }),
        supabase
          .from('profiles')
          .select('subscription_active, subscription_status, subscription_plan')
          .eq('id', user.id)
          .single()
      ]);

      if (voiceError) {
        console.error('[useFeatureUsage] Error fetching voice usage:', voiceError);
        setError(voiceError.message || 'Failed to fetch voice usage');
        setUsage(null);
        return;
      }

      if (limitsError) {
        console.error('[useFeatureUsage] Error fetching limits:', limitsError);
        setError(limitsError.message || 'Failed to fetch usage data');
        setUsage(null);
        return;
      }

      if (profileError) {
        console.warn('[useFeatureUsage] Profile lookup failed:', profileError);
      }

      const limitsDataTyped = limitsData as LimitsData;
      const limits = limitsDataTyped?.limits || {};
      const usage = limitsDataTyped?.usage || {};
      const currentPeriod = new Date().toISOString().slice(0, 7);

      // Cast voiceData to proper interface
      const voiceDataTyped = voiceData as VoiceUsageData;
      const voiceIsUnlimited = voiceDataTyped?.is_unlimited === true || voiceDataTyped?.limit === null;
      const voiceUsed = voiceDataTyped?.seconds_used ?? 0;
      const voiceLimit = voiceIsUnlimited ? null : voiceDataTyped?.limit ?? null;
      const voiceRemaining = voiceIsUnlimited
        ? null
        : voiceDataTyped?.remaining ?? Math.max(0, (voiceLimit ?? 0) - voiceUsed);

      const insightLimit = (limits?.insights ?? null) as number | null;
      const insightUsed = usage.insights_count || 0;
      const insightRemaining = insightLimit === null
        ? null
        : Math.max(0, insightLimit - insightUsed);

      const transformedData: FeatureUsage = {
        period: currentPeriod,
        subscription_active: profileData?.subscription_active || false,
        subscription_plan: profileData?.subscription_plan || limits.plan_id || 'free',
        voice_seconds: {
          used: voiceUsed,
          limit: voiceLimit,
          remaining: voiceRemaining
        },
        insights_count: {
          used: insightUsed,
          limit: insightLimit,
          remaining: insightRemaining
        }
      };

      setUsage(transformedData);
    } catch (err) {
      console.error('[useFeatureUsage] Exception fetching usage:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setUsage(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsage();

    // Refetch usage every 30 seconds to keep it up-to-date
    const interval = setInterval(fetchUsage, 30000);

    return () => clearInterval(interval);
  }, [user]);

  return {
    usage,
    loading,
    error,
    refetch: fetchUsage
  };
}

/**
 * Helper hook to check if a specific feature is available
 * @param featureType - Type of feature to check
 * @returns {boolean} true if feature is available (has remaining usage or unlimited)
 */
export function useFeatureAvailable(featureType: 'voice_seconds' | 'insights_count') {
  const { usage, loading } = useFeatureUsage();

  if (loading || !usage) return true; // Assume available while loading

  const feature = usage[featureType];
  
  // If limit is null, feature is unlimited
  if (feature.limit === null) return true;

  // If remaining is null or > 0, feature is available
  return feature.remaining === null || feature.remaining > 0;
}

