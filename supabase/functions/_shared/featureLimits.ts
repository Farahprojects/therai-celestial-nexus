// Feature limits configuration by subscription plan
// null = unlimited

export const FEATURE_LIMITS: Record<string, {
  voice_seconds: number | null;
  insights_count: number | null;
}> = {
  '10_monthly': { // Growth plan - $10/month
    voice_seconds: 600, // 10 minutes per month
    insights_count: 3 // 3 per month (not used for image gen - that's in image-generate function)
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

