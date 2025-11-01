// src/integrations/supabase/config.ts

// Centralized Supabase configuration
// Direct configuration (VITE_* env vars not supported in Lovable)

// Update these values if you change your custom domain
export const SUPABASE_URL = "https://api.therai.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndydnFxdnF2d3FtZmRxdnFtYWFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU1ODA0NjIsImV4cCI6MjA2MTE1NjQ2Mn0.u9P-SY4kSo7e16I29TXXSOJou5tErfYuldrr_CITWX0";

// Validation helper
export const isSupabaseConfigured = (): boolean =>
  !!(SUPABASE_URL && SUPABASE_ANON_KEY);

// Non-sensitive debug helper
export const debugSupabaseConfig = () => {
  console.log('[Supabase Config] Debug:', {
    hasUrl: !!SUPABASE_URL,
    hasKey: !!SUPABASE_ANON_KEY,
    urlLength: SUPABASE_URL?.length || 0,
    keyLength: SUPABASE_ANON_KEY?.length || 0,
  });
};

// Billing mode configuration
// Toggle between 'CREDIT' (pay-per-use) and 'SUBSCRIPTION' (recurring billing)
// Change this value to switch the entire app's billing behavior
export const BILLING_MODE: 'CREDIT' | 'SUBSCRIPTION' = 'SUBSCRIPTION';