/**
 * One-time cleanup for old storage keys that are no longer used
 * This runs once on app startup to clean up legacy data
 */

export const cleanupOldStorage = (): void => {
  if (typeof window === 'undefined') return;
  
  try {
    // Remove old unused guest ID from localStorage
    const oldGuestId = localStorage.getItem('therai_guest_id');
    if (oldGuestId) {
      localStorage.removeItem('therai_guest_id');
      safeConsoleLog('[CleanupOldStorage] Removed old unused guest ID from localStorage');
    }
    
    // Remove any other legacy keys that might exist
    const legacyKeys = [
      'guestId', 'guest_report_id', 
      'currentGuestReportId',
      'therai_guest_report_id'  // Current active key - clear it too for fresh start
    ];
    
    legacyKeys.forEach(key => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        console.log(`[CleanupOldStorage] Removed legacy localStorage key: ${key}`);
      }
      if (sessionStorage.getItem(key)) {
        sessionStorage.removeItem(key);
        console.log(`[CleanupOldStorage] Removed legacy sessionStorage key: ${key}`);
      }
    });
    
  } catch (error) {
    safeConsoleWarn('[CleanupOldStorage] Error during cleanup:', error);
  }
};
