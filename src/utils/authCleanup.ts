import { safeConsoleWarn } from '@/utils/safe-logging';

/**
 * Utility for cleaning up authentication state to prevent limbo states
 */
export const cleanupAuthState = async () => {
  // Clear chat stores first (downstream from auth)
  try {
    // Clear message store using dynamic import (works in browser)
    const { triggerMessageStoreSelfClean } = await import('@/stores/messageStore-utils');
    await triggerMessageStoreSelfClean();
    
    // Clear chat store using dynamic import (works in browser)
    const storeUtils = await import('@/core/store-utils');
    storeUtils.getCurrentChatState().clearAllData();
  } catch (error) {
    safeConsoleWarn('Could not clear chat stores during auth cleanup:', error);
  }
  
  // Clear redirect persistence (shared URL persistence)
  try {
    const { clearRedirectPath } = await import('@/utils/redirectUtils');
    clearRedirectPath();
    // Also clear any additional redirect-related keys
    localStorage.removeItem('pending_join_token');
    localStorage.removeItem('chat_id');
    // Clear any namespaced active chat keys
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('therai_active_chat_auth_')) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    safeConsoleWarn('Could not clear redirect persistence during auth cleanup:', error);
  }
  
  // Clear all Supabase auth keys from localStorage (comprehensive patterns)
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('supabase') || 
        key.includes('sb-') || 
        key.includes('auth') ||
        key.includes('session') ||
        key.includes('token') ||
        key.includes('user')) {
      localStorage.removeItem(key);
    }
  });
  
  // Clear from sessionStorage if present (comprehensive patterns)
  Object.keys(sessionStorage || {}).forEach((key) => {
    if (key.startsWith('supabase') || 
        key.includes('sb-') || 
        key.includes('auth') ||
        key.includes('session') ||
        key.includes('token') ||
        key.includes('user')) {
      sessionStorage.removeItem(key);
    }
  });

  // Clear IndexedDB if present (for Supabase offline storage)
  try {
    if ('indexedDB' in window) {
      const dbNames = ['supabase', 'supabase-auth-token'];
      dbNames.forEach(dbName => {
        const request = indexedDB.deleteDatabase(dbName);
        request.onerror = () => {
          // Expected if database doesn't exist
        };
      });
    }
  } catch {
    // Expected if IndexedDB is not available
  }

  // Clear any cookies that might contain auth data
  if (typeof document !== 'undefined') {
    document.cookie.split(";").forEach((c) => {
      const eqPos = c.indexOf("=");
      const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();
      if (name.includes('supabase') || 
          name.includes('sb-') || 
          name.includes('auth') ||
          name.includes('session') ||
          name.includes('token')) {
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + window.location.hostname;
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=." + window.location.hostname;
      }
    });
  }
};

/**
 * Emergency cleanup for when user data is deleted but session still exists
 */
export const emergencyAuthCleanup = async () => {
  console.log('🚨 Emergency auth cleanup...');
  await cleanupAuthState();
  
  // Force a hard reload to clear any remaining state
  setTimeout(() => {
    window.location.href = '/';
  }, 100);
};