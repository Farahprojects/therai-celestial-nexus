
/**
 * Generates an absolute URL for the given path using the current origin
 * This ensures consistency when dealing with redirects in auth flows
 */
export function getAbsoluteUrl(path: string): string {
  // For production, always use therai.co domain
  // For development, use the current origin
  const baseUrl = window.location.hostname === 'localhost' || window.location.hostname.includes('lovable.app')
    ? window.location.origin
    : 'https://therai.co';
  
  // Remove trailing slashes from the base and leading slashes from the path
  // to ensure we don't end up with double slashes
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanPath = path.replace(/^\/+/, '');
  return `${cleanBase}/${cleanPath}`;
}

/**
 * Extracts the token from a URL parameter
 * Prioritizes token_hash parameter (full hash for recovery)
 * Falls back to token or otp parameters
 * 
 * @param searchParams - The URLSearchParams object from the URL
 * @returns The token string or null if not found
 */
export function extractTokenFromUrl(searchParams: URLSearchParams): string | null {
  return (
    searchParams.get('token_hash') ?? // Check for token_hash first (proper hash for recovery)
    searchParams.get('token') ??      // Fallback for shorter tokens
    searchParams.get('otp')           // Fallback for older format
  );
}

/**
 * Checks if the given URL is a password reset URL
 * 
 * @param path - The URL path to check
 * @param search - The search params string from the URL
 * @returns Boolean indicating if this is a password reset URL
 */
export function isPasswordResetUrl(path: string, search: string): boolean {
  return path.includes('/auth/password') && 
         (search.includes('token=') || search.includes('otp=') || search.includes('token_hash=')) &&
         search.includes('type=recovery');
}
