import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

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

      const { data, error: invokeError } = await supabase.functions.invoke('get-feature-usage', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });

      if (invokeError) {
        console.error('[useFeatureUsage] Error fetching usage:', invokeError);
        setError(invokeError.message || 'Failed to fetch usage data');
        setUsage(null);
      } else {
        setUsage(data);
      }
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

