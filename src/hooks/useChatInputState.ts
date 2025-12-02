import { useSyncExternalStore, useMemo } from 'react';
import { useChatStore } from '@/core/store';
import { useConversationUIStore } from '@/features/chat/conversation-ui-store';

/**
 * Isolated state management for ChatInput using useSyncExternalStore
 * This prevents unnecessary re-renders from parent component state changes
 */
export const useChatInputState = () => {
  // Subscribe to chat store state
  const chatState = useSyncExternalStore(
    useChatStore.subscribe,
    () => useChatStore.getState(),
    () => useChatStore.getState()
  );


  // Subscribe to conversation UI store state
  const conversationState = useSyncExternalStore(
    useConversationUIStore.subscribe,
    () => useConversationUIStore.getState(),
    () => ({
      isConversationOpen: false,
      openConversation: () => {},
      closeConversation: () => {},
    })
  );

  // Show stop icon when assistant is typing OR when payment flow stop icon is active
  const isAssistantGenerating = useMemo(() => 
    chatState.isAssistantTyping || chatState.isPaymentFlowStopIcon,
    [chatState.isAssistantTyping, chatState.isPaymentFlowStopIcon]
  );

  const isRecording = useMemo(() => 
    chatState.status === 'recording',
    [chatState.status]
  );

  return {
    // Chat state
    status: chatState.status,
    isAssistantTyping: chatState.isAssistantTyping,
    setAssistantTyping: chatState.setAssistantTyping,
    chat_id: chatState.chat_id,
    addThread: chatState.addThread,
    
    // Report state
    isPolling: false,
    isReportReady: false,
    
    // Conversation state
    isConversationOpen: conversationState.isConversationOpen,
    openConversation: conversationState.openConversation,
    closeConversation: conversationState.closeConversation,
    
    // Payment flow state (simplified - using chat store only)
    isPaymentConfirmed: false, // Not needed anymore
    isReportGenerating: chatState.isAssistantTyping, // Use isAssistantTyping instead
    paymentFlowIsReportReady: false,
    paymentFlowError: null,
    
    // Derived state
    isAssistantGenerating,
    isRecording,
  };
};
