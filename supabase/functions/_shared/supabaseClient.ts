// Supabase client with connection pooling
// Uses pooler URL instead of direct connections
// Pro tier: 200 connection pool vs 60 direct connections
// Critical: Prevents "too many connections" errors at scale

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL) throw new Error("Missing env: SUPABASE_URL");
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");

/**
 * Convert direct Supabase URL to pooler URL
 * Example: https://abc.supabase.co -> https://abc.pooler.supabase.com:6543
 */
function getPoolerUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const projectRef = urlObj.hostname.split('.')[0];
    return `https://${projectRef}.pooler.supabase.com:6543`;
  } catch (error) {
    console.warn('Failed to parse pooler URL, using direct connection:', error);
    return url;
  }
}

/**
 * Create Supabase client with connection pooling
 * Use this instead of createClient directly in edge functions
 */
export function createPooledClient(): SupabaseClient {
  const poolerUrl = getPoolerUrl(SUPABASE_URL);
  
  return createClient(poolerUrl, SUPABASE_SERVICE_ROLE_KEY, {
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
 * Create standard client (for auth operations that can't use pooler)
 * Only use when pooler is incompatible (e.g., auth admin operations)
 */
export function createDirectClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { 
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}

// Export for backward compatibility
export { createClient };

