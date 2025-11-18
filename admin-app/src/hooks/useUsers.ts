import { useQuery } from '@tanstack/react-query';
import { callAdminOperation } from '../lib/adminApi';

export interface User {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  profile?: {
    display_name: string | null;
    subscription_plan: string | null;
    subscription_status: string | null;
    subscription_active: boolean;
    credits: number;
  };
  role?: 'admin' | 'user';
}

async function fetchUsers(): Promise<User[]> {
  const response = await callAdminOperation<{ data: User[] }>('list_users');
  return response.data;
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}











