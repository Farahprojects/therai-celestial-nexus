// src/services/websocket/UnifiedWebSocketService.ts
import { supabase } from '@/integrations/supabase/client';
import { Message } from '@/core/types';

// Debug flag for production logging
const DEBUG = import.meta.env.DEV;

// Simplified WebSocket service - only for message fetching

class UnifiedWebSocketService {
  private realtimeChannel: any = null;
  private realtimeStatus: 'SUBSCRIBED' | 'CLOSED' | 'TIMED_OUT' | 'CHANNEL_ERROR' | 'SUBSCRIBING' | null = null;
  private subscriptionRetryCount: number = 0;
  private currentChatId: string | null = null;
  private readonly connectTimeoutMs: number = 2000;
  private connectTimeoutId: number | null = null;
  private isColdReconnecting: boolean = false;
  private coldReconnectAttempts: number = 0;
  private wakeListenersAttached: boolean = false;
  private subscribeToken: number = 0; // Guard against stale subscribe calls

  // No callbacks - just emit events


  constructor() {
    // Attach wake listeners once
    if (!this.wakeListenersAttached) {
      this.wakeListenersAttached = true;
      // ⚡ OPTIMIZED: Use warm check on wake instead of cold reconnect
      const wakeReconnect = this.debounce(() => {
        void this.ensureConnected(); // Warm check - only reconnects if needed
      }, 250);

      try {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            wakeReconnect();
          }
        });
      } catch (_) {}
      try {
        window.addEventListener('online', () => {
          wakeReconnect();
        });
      } catch (_) {}
      try {
        window.addEventListener('focus', () => {
          wakeReconnect();
        });
      } catch (_) {}
    }
  }

  /**
   * Subscribe to a specific chat - just listen, emit events
   */
  async subscribe(chat_id: string) {
    // 🔒 Increment token to invalidate stale subscriptions
    this.subscribeToken++;
    this.currentChatId = chat_id;
    
    // Clean up existing subscription
    if (this.realtimeChannel) {
      supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }

    // Setup realtime subscription for this specific chat
    await this.setupRealtimeSubscription(chat_id);

    // Start connection confirmation timer
    this.startConnectConfirmationTimer();
  }

  /**
   * Pause realtime subscription (stub for compatibility)
   */
  pauseRealtimeSubscription() {
    if (this.realtimeChannel) {
      supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
  }

  /**
   * Resume realtime subscription (stub for compatibility)
   */
  resumeRealtimeSubscription() {
    if (this.currentChatId) {
      // Fire-and-forget; caller doesn't require await
      void this.setupRealtimeSubscription(this.currentChatId);
    }
  }

  /**
   * Send message directly (stub for compatibility)
   */
  sendMessageDirect(text: string, mode?: string) {
    console.warn('[UnifiedWebSocket] sendMessageDirect should be implemented by the actual message sending service');
  }

  /**
   * Set TTS mode (stub for compatibility)
   */
  setTtsMode(enabled: boolean) {
    // This is a stub - TTS mode handling should be done elsewhere
  }



  /**
   * Setup realtime subscription - just listen and emit events
   */
  private async setupRealtimeSubscription(chat_id: string) {
    try {
      this.subscriptionRetryCount = 0;
      // 🔒 Capture token to guard against stale callbacks
      const currentToken = this.subscribeToken;

      this.realtimeChannel = supabase
        .channel(`unified-messages:${chat_id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `chat_id=eq.${chat_id}`
          },
          (payload) => {
            // 🔒 Ignore if subscription is stale
            if (currentToken !== this.subscribeToken) return;
            
            const role = payload.new?.role;
            const messageId = payload.new?.id;
            
            if (DEBUG) {
              console.log(`[UnifiedWebSocket] 📥 ${role} message INSERT:`, { 
                chat_id, 
                message_id: messageId,
                text_preview: payload.new?.text?.substring(0, 50)
              });
            }
            
            // Emit global event with full message data (no DB refetch needed)
            if (DEBUG) console.log(`[UnifiedWebSocket] 🔔 Emitting message event with data`);
            
            window.dispatchEvent(new CustomEvent('assistant-message', { 
              detail: { 
                chat_id, 
                role,
                message: payload.new // ⚡ Pass full message data to avoid refetch
              }
            }));
            
            if (DEBUG) console.log(`[UnifiedWebSocket] ✅ Event dispatched`);
          }
        )
        .subscribe((status) => {
          // 🔒 Ignore stale subscription callbacks
          if (currentToken !== this.subscribeToken) return;
          
          if (DEBUG) console.log(`[UnifiedWebSocket] 🔌 Status changed:`, status);
          this.realtimeStatus = status as any;
          
          if (status === 'SUBSCRIBED') {
            if (DEBUG) console.log(`[UnifiedWebSocket] ✅ CONNECTED & LISTENING`);
            this.subscriptionRetryCount = 0;
            this.coldReconnectAttempts = 0;
            if (this.connectTimeoutId !== null) {
              clearTimeout(this.connectTimeoutId);
              this.connectTimeoutId = null;
            }
          } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
            if (DEBUG) console.warn(`[UnifiedWebSocket] ⚠️ Connection failed:`, status);
            this.coldReconnect();
          }
        });
    } catch (error) {
      if (DEBUG) console.error('[UnifiedWebSocket] Failed to setup subscription:', error);
    }
  }

  /**
   * ⚡ OPTIMIZED: Warm check - only reconnects if actually disconnected
   */
  async ensureConnected() {
    if (!this.currentChatId) {
      if (DEBUG) console.log('[UnifiedWebSocket] ensureConnected: no chat_id, skipping');
      return;
    }
    
    if (this.realtimeStatus !== 'SUBSCRIBED' || !this.realtimeChannel) {
      if (DEBUG) console.log('[UnifiedWebSocket] ⚠️ Not connected (status:', this.realtimeStatus, 'channel:', !!this.realtimeChannel, ') - triggering cold reconnect');
      await this.coldReconnect();
    } else {
      if (DEBUG) console.log('[UnifiedWebSocket] ✓ Already connected');
    }
  }

  /**
   * ⚡ OPTIMIZED: Cold reconnect - teardown + resubscribe
   * Only refreshes auth if we got a CHANNEL_ERROR
   */
  private async coldReconnect() {
    if (this.isColdReconnecting) return;
    this.isColdReconnecting = true;
    try {
      // ⚡ OPTIMIZED: Only refresh auth if we suspect token issues
      if (this.realtimeStatus === 'CHANNEL_ERROR') {
        try {
          const { data, error } = await supabase.auth.refreshSession();
          if (error && DEBUG) {
            console.error('[UnifiedWebSocket] Auth refresh failed:', error);
          }
        } catch (err) {
          if (DEBUG) console.error('[UnifiedWebSocket] Auth refresh error:', err);
        }
      }

      // Hard teardown - remove old channel
      if (this.realtimeChannel) {
        const channelToRemove = this.realtimeChannel;
        this.realtimeChannel = null;
        
        try {
          await supabase.removeChannel(channelToRemove);
        } catch (err) {
          if (DEBUG) console.error('[UnifiedWebSocket] Channel removal error:', err);
        }
        
        // ⚡ OPTIMIZED: Removed artificial 100ms delay
      }

      // Resubscribe if chat is known
      if (this.currentChatId) {
        await this.setupRealtimeSubscription(this.currentChatId);
        this.startConnectConfirmationTimer(() => {
          if (DEBUG) console.warn('[UnifiedWebSocket] ⚠️ Cold reconnect failed');
        });
      }
    } finally {
      this.isColdReconnecting = false;
    }
  }

  /**
   * ⚡ OPTIMIZED: Start confirmation timer - try warm reconnect first
   */
  private startConnectConfirmationTimer(onTimeout?: () => void) {
    if (this.connectTimeoutId !== null) {
      clearTimeout(this.connectTimeoutId);
    }
    
    // First timeout: warm check
    this.connectTimeoutId = window.setTimeout(() => {
      if (this.realtimeStatus !== 'SUBSCRIBED') {
        // Try warm reconnect first
        void this.ensureConnected();
        
        // Second timeout: cold reconnect if still not connected
        this.connectTimeoutId = window.setTimeout(() => {
          this.connectTimeoutId = null;
          if (this.realtimeStatus !== 'SUBSCRIBED') {
            this.coldReconnectAttempts += 1;
            if (this.coldReconnectAttempts <= 1) {
              this.coldReconnect();
            } else if (onTimeout) {
              onTimeout();
            }
          } else {
            this.coldReconnectAttempts = 0;
          }
        }, 600);
      } else {
        this.connectTimeoutId = null;
        this.coldReconnectAttempts = 0;
      }
    }, this.connectTimeoutMs);
  }

  /**
   * Simple debounce helper to avoid repeated reconnects from multiple wake signals
   */
  private debounce<T extends (...args: any[]) => void>(fn: T, wait: number): T {
    let t: number | null = null;
    return ((...args: any[]) => {
      if (t !== null) {
        clearTimeout(t);
      }
      t = window.setTimeout(() => {
        t = null;
        fn(...args);
      }, wait);
    }) as T;
  }

  // WebSocket = notification only, DB = source of truth

  /**
   * Cleanup WebSocket connection
   */
  cleanup() {
    if (this.realtimeChannel) {
      supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
    this.currentChatId = null;
    if (this.connectTimeoutId !== null) {
      clearTimeout(this.connectTimeoutId);
      this.connectTimeoutId = null;
    }
  }
}

export const unifiedWebSocketService = new UnifiedWebSocketService();
