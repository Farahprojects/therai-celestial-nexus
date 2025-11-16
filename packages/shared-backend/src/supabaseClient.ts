import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

let supabaseInstance: SupabaseClient | null = null;
let supabaseAdminInstance: SupabaseClient | null = null;

/**
 * Creates or returns the singleton Supabase client instance
 * @param config Supabase configuration (url and anonKey required)
 * @returns Supabase client instance
 */
export function getSupabaseClient(config?: SupabaseConfig): SupabaseClient {
  if (!supabaseInstance) {
    if (!config) {
      throw new Error('Supabase client not initialized. Provide config on first call.');
    }
    
    const { url, anonKey } = config;
    
    if (!url || !anonKey) {
      throw new Error('Missing Supabase environment variables: url and anonKey are required');
    }
    
    supabaseInstance = createClient(url, anonKey);
  }
  
  return supabaseInstance;
}

/**
 * Creates or returns the singleton Supabase admin client instance with service role key
 * @param config Supabase configuration (url, anonKey, and serviceRoleKey required)
 * @returns Supabase admin client instance or null if service role key not provided
 */
export function getSupabaseAdminClient(config?: SupabaseConfig): SupabaseClient | null {
  if (!supabaseAdminInstance) {
    if (!config) {
      throw new Error('Supabase admin client not initialized. Provide config on first call.');
    }
    
    const { url, serviceRoleKey } = config;
    
    if (!serviceRoleKey) {
      return null;
    }
    
    if (!url) {
      throw new Error('Missing Supabase URL');
    }
    
    supabaseAdminInstance = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  
  return supabaseAdminInstance;
}

/**
 * Reset the Supabase client instances (useful for testing)
 */
export function resetSupabaseClients(): void {
  supabaseInstance = null;
  supabaseAdminInstance = null;
}

