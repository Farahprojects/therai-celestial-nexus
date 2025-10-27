// SECURITY NOTE: Using wildcard CORS for now due to dynamic subdomains
// In production, consider implementing origin validation
// See secureCors.ts for a more restrictive implementation

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// For production: Use this function to validate origins
export function getCorsHeaders(request: Request): Record<string, string> {
  const ALLOWED_ORIGINS = [
    'https://therai.co',
    'https://www.therai.co',
    'https://api.therai.co',
    'http://localhost:5173',
  ];
  
  const origin = request.headers.get('origin') || '';
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || 
                    origin.endsWith('.therai.co') ||
                    origin.endsWith('.supabase.co');
  
  return {
    ...corsHeaders,
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
  };
}
