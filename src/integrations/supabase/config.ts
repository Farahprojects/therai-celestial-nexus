// src/integrations/supabase/config.ts

// Centralized Supabase configuration
// Uses environment variables in production (Vercel), fallbacks for development
//
// LOVABLE IDE REQUIREMENT: Fallback credentials must be hardcoded for the IDE to work.
// The anon key is SAFE to expose - it's designed for frontend use and protected by RLS.
//
// SECURITY NOTE:
// - ✅ Anon key is safe to expose (protected by Row Level Security)
// - ✅ Environment variables take precedence when available (production)
// - ❌ NEVER hardcode the service_role_key here (it bypasses RLS)
// - ❌ NEVER commit .env files to git (use .env.example instead)

// Update these fallback values if you change your custom domain
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://api.therai.co";
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndydnFxdnF2d3FtZmRxdnFtYWFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU1ODA0NjIsImV4cCI6MjA2MTE1NjQ2Mn0.u9P-SY4kSo7e16I29TXXSOJou5tErfYuldrr_CITWX0";

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

// Billing mode: SUBSCRIPTION only (credit system removed)
export const BILLING_MODE = 'SUBSCRIPTION' as const;