// Secure CORS configuration
// Production domains are strictly controlled
// Localhost and loveable.dev are always allowed (inherently safe for development)

const ALLOWED_ORIGINS = [
  // Production domains
  'https://therai.co',
  'https://www.therai.co',
  'https://api.therai.co',
  'https://wrvqqvqvwqmfdqvqmaar.supabase.co',
  // Development origins (safe - localhost is local-only, loveable.dev is dev platform)
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:8080',
  'https://loveable.dev',
  // Additional loveable.dev patterns for different deployments
  'https://app.loveable.dev'
];

/**
 * Get secure CORS headers for a request
 * Allows requests from whitelisted origins + wildcard subdomains
 */
export function getSecureCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') || '';

  // Check if origin is allowed (exact match or wildcard subdomain)
  const isAllowed = ALLOWED_ORIGINS.includes(origin) ||
    origin.endsWith('.therai.co') ||
    origin.endsWith('.supabase.co') ||
    origin.endsWith('.loveable.dev') ||
    origin.endsWith('.lovableproject.com');

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '86400', // 24 hours
  };
}

/**
 * Handle CORS preflight OPTIONS requests
 */
export function handleCorsOptions(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: getSecureCorsHeaders(request),
  });
}
