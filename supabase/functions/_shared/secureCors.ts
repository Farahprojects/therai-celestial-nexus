// Secure CORS configuration for production
// Replace wildcard with specific allowed origins

const ALLOWED_ORIGINS = [
  'https://therai.co',
  'https://www.therai.co',
  'https://api.therai.co',
  'https://wrvqqvqvwqmfdqvqmaar.supabase.co',
  ...(Deno.env.get('NODE_ENV') === 'development'
    ? ['http://localhost:5173', 'http://localhost:3000']
    : []
  )
];

/**
 * Get secure CORS headers for a request
 * Only allows requests from whitelisted origins
 */
export function getSecureCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') || '';

  // Check if origin is allowed
  const isAllowed = ALLOWED_ORIGINS.includes(origin) ||
    origin.endsWith('.therai.co') ||
    origin.endsWith('.supabase.co');

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
