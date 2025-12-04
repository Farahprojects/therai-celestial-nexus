
/**
 * General URL helper utilities
 */
import { log } from './logUtils';
import { safeConsoleError } from '@/utils/safe-logging';

/**
 * Enhanced comprehensive session clearing with React Query cache and state reset callbacks
 */
export const clearAllSessionData = async (stateResetCallbacks?: (() => void)[], queryClient?: unknown): Promise<void> => {
  try {
    log('debug', 'Starting comprehensive session clearing', null, 'urlHelpers');
    // Execute state reset callbacks first (before clearing storage)
    if (stateResetCallbacks && stateResetCallbacks.length > 0) {
      console.log('🔄 Executing state reset callbacks...');
      stateResetCallbacks.forEach((callback, index) => {
        try {
          callback();
          console.log(`✅ State reset callback ${index + 1} executed`);
        } catch (error) {
          safeConsoleError(`❌ State reset callback ${index + 1} failed:`, error);
        }
      });
    }

    // Clear all storage
    const storageKeys = [
      'last_route',
      'last_route_params',
      'modalState',
      'activeTab',
      'activeTabId', // New tab ID tracking
      'formMemoryData' // New form memory persistence
    ];

    storageKeys.forEach(key => {
      try {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      } catch (error) {
        safeConsoleError(`Error removing ${key}:`, error);
      }
    });

    // Clear React Query cache more comprehensively
    if (queryClient && typeof queryClient === 'object' && 'removeQueries' in queryClient) {
      try {
        // Clear any cached report payloads
        queryClient.removeQueries({ queryKey: ['report-payload'] });
        queryClient.removeQueries({ queryKey: ['temp-report-data'] });
        queryClient.removeQueries({ queryKey: ['report-data'] });
        console.log('✅ React Query cache cleared comprehensively');
      } catch {
        console.log('⚠️ React Query not available for cache clearing');
      }
    }

    // Force garbage collection if available (Chrome only)
    if (typeof window !== 'undefined' && 'gc' in window) {
      try {
        (window as { gc?: () => void }).gc?.();
        console.log('🗑️ Garbage collection triggered');
      } catch {
        console.log('⚠️ Garbage collection not available');
      }
    }

    console.log('✅ Comprehensive session clearing completed');
  } catch (error) {
    safeConsoleError('❌ Error during comprehensive session clearing:', error);
  }
};
