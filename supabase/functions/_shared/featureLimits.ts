// Feature limits configuration by subscription plan
// null = unlimited

export const FEATURE_LIMITS: Record<string, {
  voice_seconds: number | null;
  insights_count: number | null;
}> = {
  '10_monthly': { // Growth plan - $10/month
    voice_seconds: 60,
    insights_count: 3
  },
  '18_monthly': { // Premium plan - $18/month
    voice_seconds: null, // unlimited
    insights_count: null // unlimited
  },
  // Add other plan IDs if needed
  'free': {
    voice_seconds: 0,
    insights_count: 0
  }
};

export interface FeatureCheckResult {
  allowed: boolean;
  remaining?: number;
  limit?: number | null;
  reason?: string;
}

