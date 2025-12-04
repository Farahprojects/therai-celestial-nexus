/**
 * One-time cleanup for old storage keys that are no longer used
 * This runs once on app startup to clean up legacy data
 */

export const cleanupOldStorage = (): void => {
  if (typeof window === 'undefined') return;

  try {
    // Cleanup function is now empty as guest-related keys have been removed
    // This function can be removed in a future cleanup
    console.log('[CleanupOldStorage] No legacy keys to clean');

  } catch (error) {
    console.warn('[CleanupOldStorage] Error during cleanup:', error);
  }
};
