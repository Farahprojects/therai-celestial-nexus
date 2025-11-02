import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Fail fast if environment variables are missing
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(`Missing Supabase environment variables:
    VITE_SUPABASE_URL: ${!!supabaseUrl}
    VITE_SUPABASE_PUBLISHABLE_KEY: ${!!supabaseAnonKey}
    
    Please ensure these are set in your Vercel environment variables.`);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'apikey': supabaseAnonKey,
    },
  }
});

export { supabase, supabaseAnonKey };
