import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

interface HealthMetrics {
  database: {
    sizeGB: number;
    percentUsed: number;
    status: string;
  };
  storage: {
    sizeGB: number;
    percentUsed: number;
    status: string;
  };
  alerts: string[];
}

interface HealthCheckResult {
  status: 'healthy' | 'warning' | 'critical';
  timestamp: string;
  metrics: HealthMetrics;
}

async function fetchHealthCheck(): Promise<HealthCheckResult> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const healthCheckUrl = `${supabaseUrl}/functions/v1/health-check`;

  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('No active session');
  }

  const response = await fetch(healthCheckUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch health check data');
  }

  return response.json();
}

export function useHealthCheck() {
  return useQuery({
    queryKey: ['health-check'],
    queryFn: fetchHealthCheck,
    refetchInterval: 60 * 60 * 1000, // Refetch every hour
    staleTime: 60 * 60 * 1000, // Consider data stale after 1 hour
  });
}


