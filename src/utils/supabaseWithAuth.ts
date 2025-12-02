
import { supabase } from '@/integrations/supabase/client';
import { authService } from '@/services/authService';


/**
 * Enhanced Supabase client that ensures valid authentication before queries
 */
class SupabaseWithAuth {
  async query<T>(
    tableName: string,
    queryFn: (client: typeof supabase) => unknown
  ): Promise<{ data: T | null; error: unknown }> {
    try {
      // Ensure we have valid authentication
      const session = await authService.ensureValidSession();
      if (!session) {
        return { 
          data: null, 
          error: { message: 'Authentication required', code: 'AUTH_REQUIRED' }
        };
      }

      // Execute the query and await the result
      const result = await queryFn(supabase);
      
      // Handle potential auth-related errors
      if (result.error) {
        const isAuthError = result.error.code === 'PGRST301' || 
                           result.error.message?.includes('JWT') ||
                           result.error.message?.includes('authentication');
        
        if (isAuthError) {
          
          // Try to refresh session and retry once
          const refreshedSession = await authService.refreshSession();
          if (refreshedSession) {
            return await queryFn(supabase);
          }
        }
      }

      return result;
    } catch (error) {
      return { 
        data: null, 
        error: { message: 'Query failed', originalError: error }
      };
    }
  }
}

export const supabaseWithAuth = new SupabaseWithAuth();
