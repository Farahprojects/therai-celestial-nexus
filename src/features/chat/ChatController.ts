// src/features/chat/ChatController.ts
import { supabase } from '@/integrations/supabase/client';
import { useChatStore } from '@/core/store';
import { useMessageStore } from '@/stores/messageStore';
import { unifiedWebSocketService } from '@/services/websocket/UnifiedWebSocketService';
import { unifiedChannel } from '@/services/websocket/UnifiedChannelService';
import { Message } from '@/core/types';
import { safeConsoleError } from '@/utils/safe-logging';
class ChatController {
  private resetTimeout: NodeJS.Timeout | null = null;
  private lastFailedMessage: { text: string; mode?: string } | null = null;
  private isInitializing = false; // Guard against concurrent initializations
  private networkRetryHandler: ((event: Event) => void) | null = null;


  constructor() {
    // Don't load messages in constructor - wait for initializeForConversation
    // this.loadExistingMessages();
    
    // Listen for network retry events - STORE HANDLER FOR CLEANUP
    this.networkRetryHandler = this.handleNetworkRetry.bind(this);
    window.addEventListener('network-retry', this.networkRetryHandler);
  }

  private async loadExistingMessages(chat_id?: string) {
    const { setMessageLoadError } = useChatStore.getState();
    const { setChatId, fetchMessages } = useMessageStore.getState();
    
    // Use provided chat_id or fallback to store
    const targetChatId = chat_id || useChatStore.getState().chat_id;
    if (!targetChatId) {
      return;
    }
    
    // CRITICAL: Block invalid chat_id values
    if (targetChatId === "1" || targetChatId.length < 10) {
      safeConsoleError('[ChatController] BLOCKED: Invalid chat_id detected:', targetChatId);
      setMessageLoadError('Invalid chat ID');
      return;
    }

    try {
      // Set chat_id first (triggers fetchMessages automatically via setChatId)
      setChatId(targetChatId);
      
      // Explicitly fetch to ensure we have latest data
      await fetchMessages();
    } catch (error) {
      safeConsoleError('[ChatController] Error loading existing messages:', error);
      setMessageLoadError(error instanceof Error ? error.message : 'Failed to load messages');
    }
  }

  async initializeForConversation(chat_id: string) {
    if (!chat_id) {
      safeConsoleError('[ChatController] initializeForConversation', 'FAIL FAST - chat_id is required');
      throw new Error('chat_id is required for conversation initialization');
    }
    
    // Guard against concurrent initializations
    if (this.isInitializing) {
      console.log('[ChatController] Initialization already in progress, skipping duplicate call');
      return;
    }
    
    try {
      this.isInitializing = true;
      
      // Set chat_id in store (single source of truth) - this will persist to sessionStorage
      useChatStore.getState().startConversation(chat_id);
      
      // Subscribe WebSocket to this chat (just listens, emits events)
      await unifiedWebSocketService.subscribe(chat_id);
      
      // Check if conversation exists before fetching messages
      const conversationExists = await this.verifyConversationExists(chat_id);
      
      if (conversationExists) {
        await this.loadExistingMessages(chat_id);
      } else {
        // Clear messages for new conversation
        const { setChatId } = useMessageStore.getState();
        setChatId(chat_id);
      }
      
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Verify conversation exists in database before fetching messages
   */
  private async verifyConversationExists(chat_id: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('id')
        .eq('id', chat_id)
        .maybeSingle();
      
      if (error || !data) {
        return false;
      }
      
      return true;
    } catch (error) {
      safeConsoleError('[ChatController] Error verifying conversation exists:', error);
      return false;
    }
  }

  /**
   * Initialize WebSocket callbacks once (without specific chat_id)
   */

  /**
   * Switch WebSocket subscription to different chat_id
   */
  async switchToChat(chat_id: string) {
    await unifiedWebSocketService.subscribe(chat_id);

    // Ensure unified channel is subscribed for message delivery
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      await unifiedChannel.subscribe(user.id);
    }
  }



  public pauseRealtimeSubscription() {
    unifiedWebSocketService.pauseRealtimeSubscription();
  }

  public resumeRealtimeSubscription() {
    unifiedWebSocketService.resumeRealtimeSubscription();
  }

  /**
   * Alias for backward compatibility
   */
  async initializeConversation(chat_id: string): Promise<void> {
    return this.initializeForConversation(chat_id);
  }

  // sendTextMessage removed - using unifiedWebSocketService.sendMessageDirect() directly

  // addOptimisticMessages removed - handled by unifiedWebSocketService.sendMessageDirect()

  // REMOVED: scrollToNewTurn - redundant with MessageList auto-scroll



  public unlock(): void {
  }

  // Audio pipeline methods removed - using universal mic system
  public async initializeAudioPipeline() {
    // Audio pipeline removed - using universal mic system
    // Audio pipeline removed - using universal mic system (removed noisy log)
  }

  // Simple pause/unpause - no turn management needed
  public pauseMic() {
    // pauseMic: Using universal mic system (removed noisy log)
  }

  public unpauseMic() {
    // unpauseMic: Using universal mic system (removed noisy log)
  }





  public cancelMic() {
    // cancelMic: Using universal mic system (removed noisy log)
  }

  public resetConversationService() {
  
    // Clear any existing timeouts
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
      this.resetTimeout = null;
    }
    
    // Audio pipeline removed - using universal mic system
    this.isInitializing = false; // Reset initialization guard
    useChatStore.getState().setStatus('idle');

    this.resetTimeout = setTimeout(() => {
    }, 100);
  }

  // Add cleanup method for component unmount
  public cleanup() {
    console.log('[ChatController] 🔥 CLEANUP: Starting ChatController cleanup');
    // Clear all timeouts
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
      this.resetTimeout = null;
    }
    
    // 🔥 CLEANUP: Remove network retry listener
    if (this.networkRetryHandler) {
      window.removeEventListener('network-retry', this.networkRetryHandler);
      this.networkRetryHandler = null;
    }
    
    // Clean up unified WebSocket service (voice-specific)
    unifiedWebSocketService.cleanup();

    // ⚠️ DO NOT cleanup unifiedChannel here!
    // The unified channel is a shared singleton for ALL message broadcasts (text + voice).
    // It should only be cleaned up on:
    // 1. User sign-out (handled in messageStore.ts)
    // 2. Full memory cleanup/page unload (handled in memoryCleanup.ts)
    // Cleaning it here would break text message receiving when voice mode resets.

    this.isInitializing = false; // Reset initialization guard
    console.log('[ChatController] 🔥 CLEANUP: ChatController cleanup complete');
  }

  /**
   * Handle network retry events from the error popup
   */
  private handleNetworkRetry = (): void => {
    if (this.lastFailedMessage) {
      console.log('[ChatController] Retrying failed message due to network retry');
      // Extract message data for retry (variables not directly used but kept for future extension)
      // const { text, mode } = this.lastFailedMessage;
      this.lastFailedMessage = null; // Clear the stored message
      
      // Retry sending the message
      setTimeout(() => {
        unifiedWebSocketService.sendMessageDirect();
      }, 1000); // Small delay before retry
    }
  }

  /**
   * Payment Flow Control Methods
   */
  public showPaymentFlowProgress(message: string): void {
    const { chat_id } = useChatStore.getState();
    const { addMessage } = useMessageStore.getState();
    if (!chat_id) return;

    const progressMessage: Message = {
      id: `payment-progress-${Date.now()}`,
      chat_id: chat_id,
      role: 'system',
      text: message,
      createdAt: new Date().toISOString(),
      status: 'thinking',
      meta: { type: 'payment-progress' },
      client_msg_id: `payment-progress-${Date.now()}`
    };

    addMessage(progressMessage);
    // Added payment progress message (removed noisy log)
  }

  public removePaymentFlowProgress(): void {
    const { messages, updateMessage } = useMessageStore.getState();
    
    // Find and remove payment progress messages
    const progressMessages = messages.filter((m: Message) => {
      const meta = m.meta as { type?: string };
      return meta?.type === 'payment-progress';
    });
    
    progressMessages.forEach((msg: Message) => {
      // Mark as complete instead of actually removing
      updateMessage(msg.id, { status: 'complete' });
    });
    
    // Removed payment progress messages (removed noisy log)
  }

  public setPaymentFlowStopIcon(show: boolean): void {
    const { setPaymentFlowStopIcon } = useChatStore.getState();
    setPaymentFlowStopIcon(show);
    // Payment flow stop icon toggled (removed noisy log)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public setTtsMode(enabled: boolean): void {
    unifiedWebSocketService.setTtsMode();
  }

}

export const chatController = new ChatController();
