// src/services/websocket/UnifiedWebSocketService.ts

// Debug flag for production logging
const DEBUG = import.meta.env.DEV;

/**
 * ⚡ OPTIMIZED: UnifiedWebSocketService - Migrated from postgres_changes to broadcast
 * 
 * This service now acts as a lightweight compatibility layer.
 * All message handling is done via unified channel broadcasts in messageStore.
 * 
 * Changes:
 * - Removed postgres_changes subscriptions (was causing 98% of DB time)
 * - No longer creates realtime channels (reduces subscription count by 2 per user)
 * - Maintains API compatibility for ChatController
 * 
 * Message delivery now happens via:
 * 1. Edge functions broadcast to unified channel (user-realtime:{userId})
 * 2. messageStore listens to unified channel broadcasts
 * 3. No postgres_changes RLS evaluation overhead
 */

class UnifiedWebSocketService {
  private wakeListenersAttached: boolean = false;
  
  // Track event listeners for cleanup
  private visibilityListener: (() => void) | null = null;
  private onlineListener: (() => void) | null = null;
  private focusListener: (() => void) | null = null;

  constructor() {
    // Minimal setup - no realtime subscriptions needed
    if (typeof window !== 'undefined' && !this.wakeListenersAttached) {
      this.wakeListenersAttached = true;
      // Note: Wake listeners kept for potential future use, but no reconnection needed
    }
  }

  /**
   * Subscribe to a specific chat - now a no-op for compatibility
   * Messages are handled via unified channel in messageStore
   */
  async subscribe(_chat_id: string) {
    // No realtime subscription needed - messageStore handles everything via unified channel
  }

  /**
   * Pause realtime subscription (stub for compatibility)
   */
  pauseRealtimeSubscription() {
    // No-op: No subscriptions to pause
    if (DEBUG) console.log('[UnifiedWebSocket] pauseRealtimeSubscription: No-op (using unified channel)');
  }

  /**
   * Resume realtime subscription (stub for compatibility)
   */
  resumeRealtimeSubscription() {
    // No-op: No subscriptions to resume
    if (DEBUG) console.log('[UnifiedWebSocket] resumeRealtimeSubscription: No-op (using unified channel)');
  }

  /**
   * Send message directly (stub for compatibility)
   */
  sendMessageDirect() {
    console.warn('[UnifiedWebSocket] sendMessageDirect should be implemented by the actual message sending service');
  }

  /**
   * Set TTS mode (stub for compatibility)
   */
  setTtsMode() {
    // This is a stub - TTS mode handling should be done elsewhere
  }

  /**
   * Cleanup - minimal cleanup needed since no subscriptions
   */
  cleanup() {
    
    // 🔥 CLEANUP: Remove all global event listeners
    if (this.visibilityListener) {
      try {
        document.removeEventListener('visibilitychange', this.visibilityListener);
      } catch {
        // eslint-disable-next-line no-empty
      }
      this.visibilityListener = null;
    }
    if (this.onlineListener) {
      try {
        window.removeEventListener('online', this.onlineListener);
      } catch {
        // eslint-disable-next-line no-empty
      }
      this.onlineListener = null;
    }
    if (this.focusListener) {
      try {
        window.removeEventListener('focus', this.focusListener);
      } catch {
        // eslint-disable-next-line no-empty
      }
      this.focusListener = null;
    }
    
    this.wakeListenersAttached = false;
    
    if (DEBUG) console.log('[UnifiedWebSocket] 🧹 Cleanup complete (no subscriptions to clean)');
  }
}

export const unifiedWebSocketService = new UnifiedWebSocketService();
