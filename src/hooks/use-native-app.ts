import { getAuthManager } from '@/services/authManager';

/**
 * Returns true if running in native Capacitor app
 * Uses centralized authManager - single source of truth
 */
export function useIsNativeApp(): boolean {
  return getAuthManager().isNativeApp();
}
