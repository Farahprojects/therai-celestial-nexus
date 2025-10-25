// src/features/chat/ChatController.ts
import { supabase } from '@/integrations/supabase/client';
import { useChatStore } from '@/core/store';
import { useMessageStore } from '@/stores/messageStore';
import { sttService } from '@/services/voice/stt';
import { llmService } from '@/services/llm/chat';
import { unifiedWebSocketService } from '@/services/websocket/UnifiedWebSocketService';
import { Message } from '@/core/types';
import { v4 as uuidv4 } from 'uuid';
import { networkErrorHandler } from '@/utils/networkErrorHandler';

class ChatController {
  private conversationServiceInitialized = false;
  private isResetting = false;
  private resetTimeout: NodeJS.Timeout | null = null;
  private lastFailedMessage: { text: string; mode?: string } | null = null;
  private isUnlocked = false; // New flag to control microphone access
  // Using unified message store for all message management
  private isProcessingRef = false;
  private isInitializing = false; // Guard against concurrent initializations


  constructor() {
    // Don't load messages in constructor - wait for initializeForConversation
    // this.loadExistingMessages();
    
    // Listen for network retry events
    window.addEventListener('network-retry', this.handleNetworkRetry.bind(this));
  }

  private async loadExistingMessages(chat_id?: string) {
    const { setMessageLoadError } = useChatStore.getState();
    const { setChatId, fetchMessages, messages: currentMessages } = useMessageStore.getState();
    
    // Use provided chat_id or fallback to store
    const targetChatId = chat_id || useChatStore.getState().chat_id;
    if (!targetChatId) {
      return;
    }
    
    // CRITICAL: Block invalid chat_id values
    if (targetChatId === "1" || targetChatId.length < 10) {
      console.error('[ChatController] BLOCKED: Invalid chat_id detected:', targetChatId);
      setMessageLoadError('Invalid chat ID');
      return;
    }

    try {
      // Set chat_id first (triggers fetchMessages automatically via setChatId)
      setChatId(targetChatId);
      
      // Explicitly fetch to ensure we have latest data
      await fetchMessages();
    } catch (error) {
      console.error('[ChatController] Error loading existing messages:', error);
      setMessageLoadError(error instanceof Error ? error.message : 'Failed to load messages');
    }
  }

  async initializeForConversation(chat_id: string) {
    if (!chat_id) {
      console.error('[ChatController] initializeForConversation: FAIL FAST - chat_id is required');
      throw new Error('chat_id is required for conversation initialization');
    }
    
    // Guard against concurrent initializations
    if (this.isInitializing) {
      console.log('[ChatController] Initialization already in progress, skipping duplicate call');
      return;
    }
    
    try {
      this.isInitializing = true;
      
      console.log('[ChatController] initializeForConversation START:', { chat_id });
      
      // Set chat_id in store (single source of truth) - this will persist to sessionStorage
      useChatStore.getState().startConversation(chat_id);
      
      // Subscribe WebSocket to this chat (just listens, emits events)
      console.log('[ChatController] Subscribing WebSocket to:', chat_id);
      await unifiedWebSocketService.subscribe(chat_id);
      
      // Check if conversation exists before fetching messages
      console.log('[ChatController] Checking if conversation exists');
      const conversationExists = await this.verifyConversationExists(chat_id);
      
      if (conversationExists) {
        console.log('[ChatController] Conversation exists, loading messages');
        await this.loadExistingMessages(chat_id);
      } else {
        console.log(`[ChatController] Conversation ${chat_id} does not exist yet, skipping message fetch (new conversation)`);
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
      console.error('[ChatController] Error verifying conversation exists:', error);
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
  }


  private async ensureRealtimeReady(chat_id: string): Promise<void> {
    try {
      // Lightweight ping to wake network/client
      await supabase
        .from('messages')
        .select('id', { head: true, count: 'exact' })
        .eq('chat_id', chat_id);
    } catch (error) {
      console.warn('[ChatController] ensureRealtimeReady ping failed (continuing):', error);
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


  private initializeConversationService() {
    if (this.conversationServiceInitialized) return;
    
    this.conversationServiceInitialized = true;
  }

  public unlock(): void {
    this.isUnlocked = true;
  }

  // Audio pipeline methods removed - using universal mic system
  public async initializeAudioPipeline() {
    // Audio pipeline removed - using universal mic system
    console.log('[ChatController] Audio pipeline removed - using universal mic system');
  }

  // Simple pause/unpause - no turn management needed
  public pauseMic() {
    console.log('[ChatController] pauseMic: Using universal mic system');
  }

  public unpauseMic() {
    console.log('[ChatController] unpauseMic: Using universal mic system');
  }





  public cancelMic() {
    console.log('[ChatController] cancelMic: Using universal mic system');
  }

  public resetConversationService() {
    this.isResetting = true;
  
    // Clear any existing timeouts
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
      this.resetTimeout = null;
    }
    
    // Audio pipeline removed - using universal mic system
    this.conversationServiceInitialized = false;
    this.isUnlocked = false; // Lock on reset
    this.isProcessingRef = false;
    this.isInitializing = false; // Reset initialization guard
    useChatStore.getState().setStatus('idle');

    this.resetTimeout = setTimeout(() => {
      this.isResetting = false;
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
    
    // Clean up unified WebSocket service
    unifiedWebSocketService.cleanup();
    
    this.isResetting = false;
    this.isUnlocked = false; // Lock on cleanup
    this.isInitializing = false; // Reset initialization guard
    console.log('[ChatController] 🔥 CLEANUP: ChatController cleanup complete');
  }

  /**
   * Handle network retry events from the error popup
   */
  private handleNetworkRetry = (event: CustomEvent) => {
    if (this.lastFailedMessage) {
      console.log('[ChatController] Retrying failed message due to network retry');
      const { text, mode } = this.lastFailedMessage;
      this.lastFailedMessage = null; // Clear the stored message
      
      // Retry sending the message
      setTimeout(() => {
        unifiedWebSocketService.sendMessageDirect(text, mode);
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
    console.log(`[ChatController] Added payment progress message: ${message}`);
  }

  public removePaymentFlowProgress(): void {
    const { messages, updateMessage } = useMessageStore.getState();
    
    // Find and remove payment progress messages
    const progressMessages = messages.filter(m => 
      m.meta?.type === 'payment-progress'
    );
    
    progressMessages.forEach(msg => {
      // Mark as complete instead of actually removing
      updateMessage(msg.id, { status: 'complete' });
    });
    
    console.log(`[ChatController] Removed ${progressMessages.length} payment progress messages`);
  }

  public setPaymentFlowStopIcon(show: boolean): void {
    const { setPaymentFlowStopIcon } = useChatStore.getState();
    setPaymentFlowStopIcon(show);
    console.log(`[ChatController] Payment flow stop icon: ${show ? 'ON' : 'OFF'}`);
  }

  public setTtsMode(enabled: boolean): void {
    unifiedWebSocketService.setTtsMode(enabled);
  }

}

export const chatController = new ChatController();
