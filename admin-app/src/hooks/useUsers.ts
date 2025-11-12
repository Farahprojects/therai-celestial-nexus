import { useQuery } from '@tanstack/react-query';
import { supabaseAdmin } from '../lib/supabase';

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
  if (!supabaseAdmin) {
    throw new Error('Admin client not configured');
  }

  // Fetch users from auth
  const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
  
  if (authError) {
    throw new Error(`Failed to fetch users: ${authError.message}`);
  }

  // Fetch profiles
  const { data: profiles, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, display_name, subscription_plan, subscription_status, subscription_active, credits');

  if (profileError) {
    console.error('Error fetching profiles:', profileError);
  }

  // Fetch user roles
  const { data: roles, error: rolesError } = await supabaseAdmin
    .from('user_roles')
    .select('user_id, role');

  if (rolesError) {
    console.error('Error fetching roles:', rolesError);
  }

  // Combine data
  const users: User[] = authUsers.users.map(authUser => {
    const profile = profiles?.find(p => p.id === authUser.id);
    const userRole = roles?.find(r => r.user_id === authUser.id);

    return {
      id: authUser.id,
      email: authUser.email ?? '',
      created_at: authUser.created_at,
      last_sign_in_at: authUser.last_sign_in_at ?? null,
      profile: profile ? {
        display_name: profile.display_name,
        subscription_plan: profile.subscription_plan,
        subscription_status: profile.subscription_status,
        subscription_active: profile.subscription_active,
        credits: profile.credits || 0,
      } : undefined,
      role: userRole?.role,
    };
  });

  return users;
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}






