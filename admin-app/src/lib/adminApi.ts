import { supabase } from './supabase';

// Admin API Response Types
export interface AdminApiSuccessResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  new_credits?: number;
}

export interface AdminApiDataResponse<T> {
  data: T;
}

export interface AdminApiErrorResponse {
  error: string;
  success: false;
}

export type AdminApiResponse<T = unknown> = AdminApiSuccessResponse<T> | AdminApiDataResponse<T> | AdminApiErrorResponse;

/**
 * Call admin operations edge function
 */
export async function callAdminOperation<T = unknown>(
  action: string,
  body: Record<string, unknown> = {}
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
    const errorResponse = data as AdminApiErrorResponse;
    throw new Error(errorResponse.error || 'Unknown error');
  }

  return data as T;
}

