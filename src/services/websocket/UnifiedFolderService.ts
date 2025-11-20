/**
 * ⚡ Unified Folder Service - Lazy subscription pattern
 * 
 * Only subscribes when needed (folder creation or document upload)
 * Unifies conversations and documents into a single channel per folder
 * Queues subscription requests until connection is ready
 */

import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

const DEBUG = import.meta.env.DEV;

type FolderEventHandler = {
  onConversationChange?: (event: 'INSERT' | 'UPDATE' | 'DELETE', record: any) => void;
  onDocumentChange?: (event: 'INSERT' | 'UPDATE' | 'DELETE', record: any) => void;
};

class UnifiedFolderService {
  private channels: Map<string, RealtimeChannel> = new Map();
  private pendingSubscriptions: Map<string, FolderEventHandler[]> = new Map();
  private subscriptionTimeout: Map<string, ReturnType<typeof setTimeout>> = new Map();

  /**
   * Subscribe to a folder's realtime events (lazy - only when needed)
   * @param folderId - The folder ID to subscribe to
   * @param handlers - Event handlers for conversation and document changes
   * @param immediate - If true, subscribe immediately. If false, queue until next WS connection needed
   */
  async subscribe(
    folderId: string,
    handlers: FolderEventHandler,
    immediate: boolean = false
  ): Promise<void> {
    if (!folderId) return;

    // If already subscribed, just add handlers
    if (this.channels.has(folderId)) {
      const channel = this.channels.get(folderId)!;
      if (channel.state === 'joined' || channel.state === 'joining') {
        // Channel is active, store handlers (they'll be called via broadcast)
        this.storeHandlers(folderId, handlers);
        if (DEBUG) console.log(`[UnifiedFolderService] Added handlers to existing subscription: ${folderId}`);
        return;
      }
    }

    // Store handlers for when subscription becomes active
    this.storeHandlers(folderId, handlers);

    if (immediate) {
      // Subscribe immediately (for active folder views)
      await this.establishSubscription(folderId);
    } else {
      // Queue subscription (will be established when needed)
      this.queueSubscription(folderId);
    }
  }

  /**
   * Queue subscription for later (when user creates folder or uploads doc)
   */
  private queueSubscription(folderId: string): void {
    if (this.pendingSubscriptions.has(folderId)) {
      // Already queued
      return;
    }

    // Clear any existing timeout
    const existingTimeout = this.subscriptionTimeout.get(folderId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Queue subscription - will be established on next action
    this.pendingSubscriptions.set(folderId, []);
    
    if (DEBUG) console.log(`[UnifiedFolderService] Queued subscription for folder: ${folderId}`);
  }

  /**
   * Establish subscription immediately (when needed)
   */
  private async establishSubscription(folderId: string): Promise<void> {
    if (this.channels.has(folderId)) {
      const channel = this.channels.get(folderId)!;
      if (channel.state === 'joined' || channel.state === 'joining') {
        if (DEBUG) console.log(`[UnifiedFolderService] Already subscribed: ${folderId}`);
        return;
      }
    }

    // Clear queue for this folder
    this.pendingSubscriptions.delete(folderId);
    const existingTimeout = this.subscriptionTimeout.get(folderId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.subscriptionTimeout.delete(folderId);
    }

    const channelName = `folder:${folderId}`;
    if (DEBUG) console.log(`[UnifiedFolderService] 📡 Establishing subscription: ${channelName}`);

    const channel = supabase
      .channel(channelName, { config: { private: true } })
      .on('broadcast', { event: '*' }, (payload: any) => {
        this.handleBroadcast(folderId, payload);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (DEBUG) console.log(`[UnifiedFolderService] ✅ Subscribed: ${channelName}`);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (DEBUG) console.warn(`[UnifiedFolderService] ⚠️ Channel error: ${status} for ${channelName}`);
        }
      });

    this.channels.set(folderId, channel);
  }

  /**
   * Trigger subscription for queued folder (called when creating folder or uploading doc)
   * Establishes the WebSocket connection immediately
   */
  async triggerSubscription(folderId: string): Promise<void> {
    // If already subscribed, no need to trigger
    if (this.isSubscribed(folderId)) {
      return;
    }
    
    // Always establish subscription when triggered (creating folder or uploading doc)
    // This ensures realtime updates are active when needed
    await this.establishSubscription(folderId);
  }

  /**
   * Handle broadcast events
   */
  private handleBroadcast(folderId: string, payload: any): void {
    const eventType = payload.type || payload.event;
    const newRecord = payload.new || payload.new_record;
    const oldRecord = payload.old || payload.old_record;
    const table = payload.table || payload.source;

    if (DEBUG) {
      console.log(`[UnifiedFolderService] 📥 Broadcast: ${table} ${eventType}`, {
        folderId,
        hasNew: !!newRecord,
        hasOld: !!oldRecord,
      });
    }

    const handlers = this.pendingSubscriptions.get(folderId) || [];

    if (table === 'conversations' || payload.type?.startsWith('conversation-')) {
      handlers.forEach(h => {
        if (h.onConversationChange && (eventType === 'INSERT' || eventType === 'UPDATE' || eventType === 'DELETE')) {
          h.onConversationChange(eventType, newRecord || oldRecord);
        }
      });
    } else if (table === 'folder_documents' || payload.type?.startsWith('document-')) {
      handlers.forEach(h => {
        if (h.onDocumentChange && (eventType === 'INSERT' || eventType === 'UPDATE' || eventType === 'DELETE')) {
          h.onDocumentChange(eventType, newRecord || oldRecord);
        }
      });
    }
  }

  /**
   * Store handlers for a folder
   */
  private storeHandlers(folderId: string, handlers: FolderEventHandler): void {
    const existing = this.pendingSubscriptions.get(folderId) || [];
    existing.push(handlers);
    this.pendingSubscriptions.set(folderId, existing);
  }

  /**
   * Unsubscribe from a folder
   */
  unsubscribe(folderId: string): void {
    const channel = this.channels.get(folderId);
    if (channel) {
      if (DEBUG) console.log(`[UnifiedFolderService] 🔌 Unsubscribing from folder: ${folderId}`);
      supabase.removeChannel(channel);
      this.channels.delete(folderId);
    }

    // Clear handlers and queue
    this.pendingSubscriptions.delete(folderId);
    const timeout = this.subscriptionTimeout.get(folderId);
    if (timeout) {
      clearTimeout(timeout);
      this.subscriptionTimeout.delete(folderId);
    }
  }

  /**
   * Cleanup all subscriptions (on logout or app close)
   */
  cleanup(): void {
    if (DEBUG) console.log(`[UnifiedFolderService] 🧹 Cleaning up all subscriptions`);
    
    this.channels.forEach((channel, folderId) => {
      supabase.removeChannel(channel);
    });
    this.channels.clear();
    this.pendingSubscriptions.clear();
    
    this.subscriptionTimeout.forEach(timeout => clearTimeout(timeout));
    this.subscriptionTimeout.clear();
  }

  /**
   * Get current subscription count (for monitoring)
   */
  getSubscriptionCount(): number {
    return this.channels.size;
  }

  /**
   * Check if folder is subscribed
   */
  isSubscribed(folderId: string): boolean {
    const channel = this.channels.get(folderId);
    return channel?.state === 'joined' || channel?.state === 'joining';
  }
}

// Singleton instance
export const unifiedFolderService = new UnifiedFolderService();

