// Supabase client factory for edge functions
// Connection pooling is handled automatically by Supabase infrastructure
// when using service role key in edge functions

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno&deno-std=0.224.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL) throw new Error("Missing env: SUPABASE_URL");
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");

/**
 * Create optimized Supabase client for edge functions
 * - Uses service role key (bypasses RLS for better performance)
 * - Disables unnecessary features (session persistence, auto-refresh)
 * - Connection pooling handled automatically by Supabase infrastructure
 */
export function createPooledClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { 
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    db: {
      schema: 'public'
    }
  });
}

/**
 * Alias for backward compatibility
 */
export function createDirectClient(): SupabaseClient {
  return createPooledClient();
}

// Export for backward compatibility
export { createClient };

