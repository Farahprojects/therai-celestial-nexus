import { useQuery } from '@tanstack/react-query';
import { callAdminOperation } from '../lib/adminApi';

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
  const response = await callAdminOperation<{ data: AdminLog[] }>('get_admin_logs', { limit: 100 });
  return response.data;
}

async function fetchApiUsage(): Promise<ApiUsage[]> {
  const response = await callAdminOperation<{ data: ApiUsage[] }>('get_api_usage', { limit: 100 });
  return response.data;
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











