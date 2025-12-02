// UnifiedChannelService - Single WebSocket channel per user with event multiplexing
// Replaces per-chat and per-feature channels with one unified channel

import { supabase } from '@/integrations/supabase/client';

const DEBUG = import.meta.env.DEV;

export type EventType = 
  | 'message-insert'
  | 'message-update'
  | 'conversation-update' 
  | 'voice-tts-ready'
  | 'voice-thinking'
  | 'image-update'
  | 'image-insert'
  | 'assistant-thinking';

export interface UnifiedEvent {
  type: EventType;
  payload: Record<string, unknown>;
  chat_id?: string;
  conversation_id?: string;
}

type EventCallback = (payload: Record<string, unknown>) => void;

class UnifiedChannelService {
  private channel: unknown = null;
  private userId: string | null = null;
  private listeners: Map<EventType, Set<EventCallback>> = new Map();
  private isActive: boolean = false;
  private idleTimeout: number | null = null;
  private visibilityHandlersSetup: boolean = false;
  private visibilityChangeHandler: (() => void) | null = null;

  constructor() {
    this.setupVisibilityHandlers();
  }

  async subscribe(userId: string) {
    if (this.channel && this.userId === userId && this.isActive) {
      if (DEBUG) console.log('[UnifiedChannel] Already subscribed for user:', userId);
      return;
    }
    
    // Clean up any existing channel first
    if (this.channel && this.userId !== userId) {
      if (DEBUG) console.log('[UnifiedChannel] Switching user, cleaning up old channel');
      this.cleanup();
    }
    
    this.userId = userId;
    
    if (DEBUG) console.log('[UnifiedChannel] 📡 Subscribing to unified channel for user:', userId);
    
    this.channel = supabase
      .channel(`user-realtime:${userId}`)
      .on('broadcast', { event: '*' }, this.handleEvent.bind(this))
      .subscribe((status) => {
        this.isActive = status === 'SUBSCRIBED';
        if (DEBUG) console.log('[UnifiedChannel] Status:', status);
        
        if (status === 'SUBSCRIBED') {
          if (DEBUG) console.log('[UnifiedChannel] ✅ Connected and listening');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (DEBUG) console.warn('[UnifiedChannel] ⚠️ Connection error:', status);
          // Attempt reconnection
          setTimeout(() => this.reconnect(), 1000);
        }
      });
  }

  private handleEvent({ event, payload }: { event: string; payload: UnifiedEvent }) {
    const eventType = event as EventType;
    const listeners = this.listeners.get(eventType);
    
    if (DEBUG) {
      console.log('[UnifiedChannel] 📥 Event received:', {
        type: eventType,
        hasListeners: !!listeners && listeners.size > 0,
        listenerCount: listeners?.size || 0
      });
    }
    
    if (!listeners || listeners.size === 0) {
      if (DEBUG) console.log('[UnifiedChannel] No listeners for event type:', eventType);
      return;
    }
    
    // Call all registered listeners for this event type
    listeners.forEach(callback => {
      try {
        callback(payload);
      } catch (error) {
        console.error('[UnifiedChannel] Error in event callback:', error);
      }
    });
  }

  on(eventType: EventType, callback: EventCallback): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    
    this.listeners.get(eventType)!.add(callback);
    
    if (DEBUG) {
      console.log('[UnifiedChannel] 🎧 Registered listener for:', eventType, 
        '(total:', this.listeners.get(eventType)!.size, ')');
    }
    
    // Return unsubscribe function
    return () => this.off(eventType, callback);
  }

  off(eventType: EventType, callback: EventCallback) {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.delete(callback);
      if (DEBUG) {
        console.log('[UnifiedChannel] 🔇 Removed listener for:', eventType,
          '(remaining:', listeners.size, ')');
      }
    }
  }

  private setupVisibilityHandlers() {
    if (this.visibilityHandlersSetup || typeof document === 'undefined') return;
    this.visibilityHandlersSetup = true;
    
    this.visibilityChangeHandler = () => {
      if (document.hidden) {
        // Tab hidden - start idle timer (close after 5 minutes)
        if (DEBUG) console.log('[UnifiedChannel] 🌙 Tab hidden, starting idle timer');
        this.idleTimeout = window.setTimeout(() => {
          if (DEBUG) console.log('[UnifiedChannel] ⏸️  Pausing due to inactivity');
          this.pause();
        }, 5 * 60 * 1000); // 5 minutes
      } else {
        // Tab visible - cancel idle timer and resume if needed
        if (DEBUG) console.log('[UnifiedChannel] ☀️ Tab visible, resuming');
        if (this.idleTimeout) {
          clearTimeout(this.idleTimeout);
          this.idleTimeout = null;
        }
        this.resume();
      }
    };
    
    document.addEventListener('visibilitychange', this.visibilityChangeHandler);
  }

  private pause() {
    if (this.channel) {
      if (DEBUG) console.log('[UnifiedChannel] ⏸️  Pausing connection');
      supabase.removeChannel(this.channel);
      this.channel = null;
      this.isActive = false;
    }
  }

  private resume() {
    if (this.userId && !this.channel) {
      if (DEBUG) console.log('[UnifiedChannel] ▶️ Resuming connection');
      this.subscribe(this.userId);
    }
  }

  private reconnect() {
    if (!this.userId) return;
    
    if (DEBUG) console.log('[UnifiedChannel] 🔄 Reconnecting...');
    
    // Clean up old channel
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    
    // Resubscribe
    this.subscribe(this.userId);
  }

  cleanup() {
    if (DEBUG) console.log('[UnifiedChannel] 🧹 Cleaning up');
    
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
      this.idleTimeout = null;
    }
    
    // 🔥 CLEANUP: Remove visibility change listener
    if (this.visibilityChangeHandler) {
      try {
        document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
        // eslint-disable-next-line no-empty
      } catch {
        // Silently ignore cleanup errors
      }
      this.visibilityChangeHandler = null;
    }
    
    this.listeners.clear();
    this.isActive = false;
    this.userId = null;
    this.visibilityHandlersSetup = false;
  }

  getStatus() {
    return {
      isActive: this.isActive,
      userId: this.userId,
      listenerCounts: Array.from(this.listeners.entries()).reduce((acc, [type, set]) => {
        acc[type] = set.size;
        return acc;
      }, {} as Record<EventType, number>)
    };
  }
}

// Singleton instance
export const unifiedChannel = new UnifiedChannelService();

