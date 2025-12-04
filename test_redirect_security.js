// Simple test for redirect validation security fix
function decodeRedirectPath(encodedPath) {
  try {
    const decoded = decodeURIComponent(encodedPath);

    // SECURITY: Prevent open redirect attacks by only allowing relative paths
    // Check if the path is relative (starts with /) and doesn't contain dangerous protocols
    if (!decoded.startsWith('/')) {
      console.warn('[SECURITY] Blocked external redirect attempt:', decoded);
      return '/therai';
    }

    // Additional security: prevent protocol-relative URLs that could be exploited
    if (decoded.startsWith('//')) {
      console.warn('[SECURITY] Blocked protocol-relative redirect attempt:', decoded);
      return '/therai';
    }

    // Prevent URL-encoded protocols (e.g., %2F%2F for //)
    const decodedLower = decoded.toLowerCase();
    if (decodedLower.includes('javascript:') ||
        decodedLower.includes('data:') ||
        decodedLower.includes('vbscript:')) {
      console.warn('[SECURITY] Blocked dangerous protocol in redirect:', decoded);
      return '/therai';
    }

    return decoded;
  } catch {
    return '/therai';
  }
}

// Test cases
console.log('Testing redirect validation:');

// Valid internal paths (should work)
console.log('Valid /therai:', decodeRedirectPath(encodeURIComponent('/therai')));
console.log('Valid /folder/123:', decodeRedirectPath(encodeURIComponent('/folder/123')));

// Invalid external URLs (should be blocked)
console.log('Invalid https://evil.com:', decodeRedirectPath(encodeURIComponent('https://evil.com')));
console.log('Invalid //evil.com:', decodeRedirectPath(encodeURIComponent('//evil.com')));
console.log('Invalid javascript:alert(1):', decodeRedirectPath(encodeURIComponent('javascript:alert(1)')));
console.log('Invalid data:text/html:', decodeRedirectPath(encodeURIComponent('data:text/html,<script>alert(1)</script>')));
