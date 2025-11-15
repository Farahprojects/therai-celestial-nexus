import { useQuery } from '@tanstack/react-query';
import { supabaseAdmin } from '../lib/supabase';

export interface AdminLog {
  id: string;
  created_at: string;
  page: string;
  event_type: string;
  logs: string | null;
  meta: Record<string, unknown> | null;
  user_id: string | null;
}

export interface ApiUsage {
  id: string;
  created_at: string;
  user_id: string;
  endpoint: string;
  report_tier: string | null;
  used_geo_lookup: boolean;
  total_cost_usd: number;
}

async function fetchAdminLogs(): Promise<AdminLog[]> {
  if (!supabaseAdmin) {
    throw new Error('Admin client not configured');
  }

  const { data, error } = await supabaseAdmin
    .from('admin_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(`Failed to fetch admin logs: ${error.message}`);
  }

  return data || [];
}

async function fetchApiUsage(): Promise<ApiUsage[]> {
  if (!supabaseAdmin) {
    throw new Error('Admin client not configured');
  }

  const { data, error } = await supabaseAdmin
    .from('api_usage')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(`Failed to fetch API usage: ${error.message}`);
  }

  return data || [];
}

export function useAdminLogs() {
  return useQuery({
    queryKey: ['admin-logs'],
    queryFn: fetchAdminLogs,
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useApiUsage() {
  return useQuery({
    queryKey: ['api-usage'],
    queryFn: fetchApiUsage,
    staleTime: 60 * 1000, // 1 minute
  });
}








