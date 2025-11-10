import { supabase } from './supabase';

export async function checkAdminRole(userId: string): Promise<boolean> {
  if (!userId) return false;

  try {
    const { data, error } = await supabase.rpc('check_user_admin_role', {
      user_id_param: userId
    });

    if (error) {
      console.error('Error checking admin role:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Error checking admin role:', error);
    return false;
  }
}



