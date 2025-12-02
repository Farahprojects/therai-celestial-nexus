/**
 * Utility functions for handling authentication redirects
 * Preserves intended destination through the auth flow
 */

/**
 * Encodes a redirect path for use in URL parameters
 */
export function encodeRedirectPath(path: string): string {
  return encodeURIComponent(path);
}

/**
 * Decodes a redirect path from URL parameters
 */
export function decodeRedirectPath(encodedPath: string): string {
  try {
    return decodeURIComponent(encodedPath);
  } catch {
    return '/therai';
  }
}

/**
 * Stores redirect information in both URL params and localStorage for redundancy
 */
export function setRedirectPath(path: string): string {
  // Store in localStorage as fallback
  try {
    localStorage.setItem('pending_redirect_path', path);
  } catch {
    // Ignore localStorage errors
  }
  
  return path;
}

/**
 * Retrieves redirect path from URL params or localStorage (fallback)
 * Priority: URL params > localStorage > default
 */
export function getRedirectPath(searchParams: URLSearchParams): string | null {
  // First check URL params
  const redirectParam = searchParams.get('redirect');
  if (redirectParam) {
    return decodeRedirectPath(redirectParam);
  }
  
  // Fallback to localStorage
  try {
    const storedPath = localStorage.getItem('pending_redirect_path');
    if (storedPath) {
      return storedPath;
    }
  } catch {
    // Ignore localStorage errors
  }
  
  return null;
}

/**
 * Clears redirect information from both URL params and localStorage
 */
export function clearRedirectPath() {
  try {
    localStorage.removeItem('pending_redirect_path');
    localStorage.removeItem('pending_join_folder_id');
    localStorage.removeItem('pending_join_chat_id');
    localStorage.removeItem('pending_join_token');
    localStorage.removeItem('chat_id');
    // Clear any namespaced active chat keys
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('therai_active_chat_auth_')) {
        localStorage.removeItem(key);
      }
    });
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Extracts folder or chat ID from a redirect path
 */
export function extractIdFromPath(path: string): { type: 'folder' | 'chat' | 'unknown', id: string | null } {
  if (!path || typeof path !== 'string') {
    return { type: 'unknown', id: null };
  }
  
  // Match /folder/:id or /folders/:id
  const folderMatch = path.match(/\/folders?\/([^/?]+)/);
  if (folderMatch) {
    return { type: 'folder', id: folderMatch[1] };
  }
  
  // Match /c/:id or /join/:id
  const chatMatch = path.match(/\/(c|join)\/([^/?]+)/);
  if (chatMatch) {
    return { type: 'chat', id: chatMatch[2] };
  }
  
  return { type: 'unknown', id: null };
}

