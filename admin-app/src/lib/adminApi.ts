import { supabase } from './supabase';

/**
 * Call admin operations edge function
 */
export async function callAdminOperation<T = any>(
  action: string,
  body: Record<string, any> = {}
): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-operations', {
    body: {
      ...body,
      action, // Include action in body as well for compatibility
    },
  });

  if (error) {
    throw new Error(error.message || 'Failed to call admin operation');
  }

  // Handle both direct response and nested data structure
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error((data as any).error || 'Unknown error');
  }

  return data as T;
}

