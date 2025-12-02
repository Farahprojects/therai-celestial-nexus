import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { useChatStore } from '@/core/store';
import { unifiedChannel } from '@/services/websocket/UnifiedChannelService';
import type { Message } from '@/core/types';

// Debug flag for production logging
const DEBUG = import.meta.env.DEV;

// Extended message type with UI-only metadata
export type StoreMessage = Message & {
  pending?: boolean;
  tempId?: string;
  source?: 'fetch' | 'websocket';
};

// Self-cleaning logic - only clean when explicitly needed
const shouldSelfClean = async (): Promise<boolean> => {
  try {
    // Check if there's a valid auth user (async)
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return true;

    // Check if chat_id exists in chat store
    const chatState = useChatStore.getState();
    if (!chatState.chat_id) return true;

    return false;
  } catch (error) {
    // If any error checking auth state, assume we should clean
    console.warn('[MessageStore] Error checking auth state:', error);
    return true;
  }
};

// Memory management: limit messages to prevent excessive memory usage
const MAX_MESSAGES_IN_MEMORY = 500;

interface MessageStore {
  // State
  chat_id: string | null;
  messages: StoreMessage[];
  loading: boolean;
  error: string | null;
  hasOlder: boolean;
  
  // Actions
  setChatId: (id: string | null) => void;
  addMessage: (message: StoreMessage) => void;
  addOptimisticMessage: (message: StoreMessage) => void;
  updateMessage: (id: string, updates: Partial<StoreMessage>) => void;
  clearMessages: () => void;
  fetchMessages: () => Promise<void>;
  loadOlder: () => Promise<void>;
  selfClean: () => void;
}

const mapDbToMessage = (db: any): StoreMessage => ({
  id: db.id,
  chat_id: db.chat_id,
  role: db.role,
  text: db.text,
  user_id: db.user_id,
  user_name: db.user_name,
  createdAt: db.created_at,
  meta: db.meta,
  client_msg_id: db.client_msg_id,
  status: db.status,
  context_injected: db.context_injected,
  message_number: db.message_number,
  mode: db.mode,
  source: 'fetch', // All DB-fetched messages are explicitly 'fetch' - no animation
});

export const useMessageStore = create<MessageStore>()((set, get) => ({
  // Initial state
  chat_id: null,
  messages: [],
  loading: false,
  error: null,
  hasOlder: false,

  // Set chat ID and auto-fetch messages
  setChatId: (id: string | null) => {
    const currentState = get();
    const currentChatId = currentState.chat_id;
    
    // If switching to a different chat_id, clear messages
    // But preserve optimistic messages if they're for the new chat_id
    if (currentChatId !== id) {
      // If setting to null (no user logged in), clear everything
      if (id === null) {
        if (DEBUG) console.log('[MessageStore] Setting to null, clearing all');
        set({ chat_id: null, messages: [], error: null, hasOlder: false });
        return;
      }
      
      // Preserve optimistic messages ONLY if they match the new chat_id
      const optimisticMessages = currentState.messages.filter(
        m => m.pending && m.chat_id === id
      );
      
      if (optimisticMessages.length > 0) {
        // Keep optimistic messages for the new chat_id
        set({ chat_id: id, messages: optimisticMessages, error: null });
      } else {
        // Clear all messages when switching chats
        set({ chat_id: id, messages: [], error: null });
      }
    }
    
    if (id) {
      // Just fetch messages - WebSocket handles real-time updates
      get().fetchMessages();
    }
  },

      // Self-cleaning method - only clean when explicitly needed
      selfClean: async () => {
        const shouldClean = await shouldSelfClean();
        if (shouldClean) {
          set({ chat_id: null, messages: [], error: null, hasOlder: false });
        }
      },

      // Add message with deduplication and timestamp ordering
      addMessage: (message: Message) => {
        set((state) => {
      // First: if a message with the same client_msg_id exists (optimistic), merge/replace it
      if (message.client_msg_id) {
        const idx = state.messages.findIndex(m => 
          m.client_msg_id && 
          m.client_msg_id === message.client_msg_id &&
          m.chat_id === message.chat_id &&
          m.role === message.role
        );
        if (idx >= 0) {
          const updated = [...state.messages];
          // Replace optimistic with persisted message; clear pending
          // Preserve position to avoid visual glitch
          updated[idx] = { 
            ...message, 
            pending: false, 
            source: message.source || updated[idx].source,
            // Preserve any UI state from optimistic message
            tempId: updated[idx].tempId
          };
          // ⚡ OPTIMIZED: No sort needed - messages already in order from DB
          return { messages: updated };
        }
      }

      // Check if message already exists by id
      const existsById = state.messages.some(m => m.id === message.id);
      
      if (existsById) {
        // Update existing - preserve WebSocket source
        const updatedMessages = state.messages.map(m => {
          if (m.id === message.id) {
            return { 
              ...m, 
              ...message, 
              pending: false,
              source: message.source || m.source
            };
          }
          return m;
        });
        return { messages: updatedMessages };
      }
      
      // Check if there's a pending optimistic message that should be replaced first
      const hasPendingWithSameContent = state.messages.some(m => 
        m.pending && 
        m.role === message.role && 
        m.text === message.text &&
        m.chat_id === message.chat_id
      );
      
      if (hasPendingWithSameContent) {
        // Replace the first pending message with same content
        const updated = state.messages.map(m => {
          if (m.pending && m.role === message.role && m.text === message.text && m.chat_id === message.chat_id) {
            return { ...message, pending: false, source: message.source || m.source };
          }
          return m;
        });
        // Sort after replacement to handle out-of-order WebSocket delivery
        updated.sort((a, b) => {
          // Use message_number if available (most reliable)
          if (a.message_number != null && b.message_number != null) {
            return a.message_number - b.message_number;
          }
          // Fall back to timestamp
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });
        return { messages: updated };
      }
      
      // Add new message and sort to handle out-of-order delivery
      // This fixes voice mode where WebSocket can deliver assistant message before user message
      const newMessages = [...state.messages, message];
      newMessages.sort((a, b) => {
        // Use message_number if available (most reliable)
        if (a.message_number != null && b.message_number != null) {
          return a.message_number - b.message_number;
        }
        // Fall back to timestamp
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

      // Memory management: limit messages to prevent excessive memory usage
      // Keep the most recent messages, drop older ones if we exceed the limit
      if (newMessages.length > MAX_MESSAGES_IN_MEMORY) {
        const excessCount = newMessages.length - MAX_MESSAGES_IN_MEMORY;
        newMessages.splice(0, excessCount); // Remove oldest messages
        if (DEBUG) console.log(`[MessageStore] Memory optimization: removed ${excessCount} old messages`);
      }

      return { messages: newMessages };
    });
  },

      // Add optimistic message with current timestamp
      addOptimisticMessage: (message: Message) => {
        set((state) => {
      
      const optimisticMessage = {
        ...message,
        pending: true,
        tempId: message.id, // Keep original ID for reconciliation
        source: 'fetch' as const // Optimistic messages don't animate (user's own text)
      };
      
      // Add and sort to maintain correct message order
      const newMessages = [...state.messages, optimisticMessage];
      newMessages.sort((a, b) => {
        // Use message_number if available (most reliable)
        if (a.message_number != null && b.message_number != null) {
          return a.message_number - b.message_number;
        }
        // Fall back to timestamp
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

      // Memory management: limit messages to prevent excessive memory usage
      if (newMessages.length > MAX_MESSAGES_IN_MEMORY) {
        const excessCount = newMessages.length - MAX_MESSAGES_IN_MEMORY;
        newMessages.splice(0, excessCount); // Remove oldest messages
        if (DEBUG) console.log(`[MessageStore] Memory optimization: removed ${excessCount} old messages`);
      }

      return { messages: newMessages };
    });
  },

  // Update existing message - preserve source field
  updateMessage: (id: string, updates: Partial<Message>) => {
    set((state) => ({
      messages: state.messages.map(m => 
        m.id === id 
          ? { ...m, ...updates, source: updates.source || m.source } // Preserve source
          : m
      )
    }));
  },

  // Clear all messages
  clearMessages: () => {
    set({ messages: [], error: null });
  },

      // ⚡ OPTIMIZED: Simple fetch - just get messages, RLS handles authorization
      fetchMessages: async () => {
        // 🔒 Capture chat_id at start to prevent stale state writes
        const fetchChatId = get().chat_id;
        if (!fetchChatId) {
          if (DEBUG) console.log('[MessageStore] fetchMessages: No chat_id, skipping');
          return;
        }

    set({ loading: true, error: null });

    try {
      // ⚡ REMOVED 3 BLOCKING QUERIES (800-2000ms saved):
      // - auth.getUser()
      // - conversations ownership check  
      // - conversations_participants check
      // RLS policies already handle authorization - these were redundant!

      // JUST FETCH MESSAGES - Fast and simple
      const { data, error } = await supabase
        .from('messages')
        .select('id, chat_id, role, text, created_at, client_msg_id, status, context_injected, message_number, user_id, user_name, meta')
        .eq('chat_id', fetchChatId)
        .order('created_at', { ascending: true })
        .limit(50);

      // 🔒 Prevent stale state write if user switched chats during fetch
      const currentChatId = get().chat_id;
      if (currentChatId !== fetchChatId) {
        if (DEBUG) console.log('[MessageStore] fetchMessages: Chat switched during fetch, ignoring stale result');
        return;
      }

      if (error) {
        // If RLS blocks access, user will get appropriate error
        throw error;
      }

      const messages = (data || []).map(mapDbToMessage);
      
      set({ 
        messages, 
        loading: false,
        hasOlder: (data?.length || 0) === 50
      });
      
    } catch (e: any) {
      if (DEBUG) console.error('[MessageStore] Failed to fetch messages:', e.message, e);
      set({ error: e.message, loading: false });
    }
  },

  // Load older messages (use timestamp ordering)
  loadOlder: async () => {
    const { chat_id, messages } = get();
    if (!chat_id || messages.length === 0) return;

    const oldestMessage = messages[0];
    if (!oldestMessage?.createdAt) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id, chat_id, role, text, created_at, client_msg_id, status, context_injected, message_number, user_id, user_name, meta')
        .eq('chat_id', chat_id)
        .lt('created_at', oldestMessage.createdAt)
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) throw error;

      const olderMessages = (data || []).map(mapDbToMessage);
      set((state) => {
        const combinedMessages = [...olderMessages, ...state.messages];

        // Memory management: if loading older messages would exceed our limit,
        // only keep the most recent messages
        if (combinedMessages.length > MAX_MESSAGES_IN_MEMORY) {
          const excessCount = combinedMessages.length - MAX_MESSAGES_IN_MEMORY;
          combinedMessages.splice(0, excessCount); // Remove oldest messages
          if (DEBUG) console.log(`[MessageStore] Memory optimization: limited older messages, removed ${excessCount} messages`);
        }

        return {
          messages: combinedMessages,
          hasOlder: (data?.length || 0) === 50 && combinedMessages.length < MAX_MESSAGES_IN_MEMORY
        };
      });
    } catch (e: any) {
      console.error('[MessageStore] Failed to load older messages:', e);
    }
  },


}));

// Self-cleaning mechanism - only called on auth state changes
export const triggerMessageStoreSelfClean = async () => {
  await useMessageStore.getState().selfClean();
};

// 🔒 Initialize message store - listen for unified channel events (one-time guard)
if (typeof window !== 'undefined' && !(window as any).__msgStoreListenerInstalled) {
  (window as any).__msgStoreListenerInstalled = true;
  
  // Subscribe to unified channel when user is available
  const initializeUnifiedChannel = () => {
    // Get user from supabase auth directly (async)
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        if (DEBUG) console.log('[MessageStore] 🔌 Subscribing to unified channel for user:', data.user.id);
        unifiedChannel.subscribe(data.user.id);
      }
    });
  };
  
  // Initialize on load
  initializeUnifiedChannel();
  
  // Re-initialize on auth state changes - STORE UNSUBSCRIBE FUNCTION
  const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      if (DEBUG) console.log('[MessageStore] 🔌 Auth changed, subscribing to unified channel');
      unifiedChannel.subscribe(session.user.id);
    } else if (event === 'SIGNED_OUT') {
      if (DEBUG) console.log('[MessageStore] 🔌 User signed out, cleaning up unified channel');
      unifiedChannel.cleanup();
    }
  });
  
  // Store cleanup function globally for cleanup
  (window as any).__msgStoreAuthCleanup = authListener?.subscription.unsubscribe.bind(authListener.subscription);
  
  // Listen for message-insert events from unified channel
  unifiedChannel.on('message-insert', (payload: any) => {
    const { chat_id, message: messageData } = payload;
    
    if (DEBUG) {
      console.log('[MessageStore] 🔔 Message event received from unified channel:', { 
        chat_id,
        hasMessageData: !!messageData
      });
    }
    
    const { addMessage, chat_id: currentChatId, messages } = useMessageStore.getState();
    
    if (DEBUG) {
      console.log('[MessageStore] Current store state:', { 
        messageCount: messages.length,
        matchesEvent: chat_id === currentChatId 
      });
    }
    
    // Only process if this is for the current chat
    if (chat_id === currentChatId && messageData) {
      if (DEBUG) console.log('[MessageStore] ⚡ Using unified channel payload directly (no DB refetch)');
      
      // Use message data directly from unified channel payload
      const message = mapDbToMessage(messageData);
      const messageWithSource = { ...message, source: 'websocket' as const };
      
      // Debug: Log generating status for skeleton detection
      if (messageData.role === 'assistant' && messageData.meta) {
        console.log('[MessageStore] Assistant message meta:', {
          status: messageData.meta.status,
          message_type: messageData.meta.message_type,
          is_generating: messageData.meta.status === 'generating' && messageData.meta.message_type === 'image'
        });
      }
      
      // Always call addMessage - it handles both INSERT (new) and UPDATE (existing) cases
      addMessage(messageWithSource);
      
      // ⚡ OPTIMIZED: Handle side-effects ONLY for assistant messages
      if (messageData.role === 'assistant') {
        const chatState = useChatStore.getState();
        
        // Set typing indicator when assistant starts responding (for stop button)
        // Will be cleared by useWordAnimation when animation completes
        if (!chatState.isAssistantTyping && messageWithSource.source === 'websocket') {
          chatState.setAssistantTyping(true);
        }
      }
    } else if (DEBUG && chat_id !== currentChatId) {
      console.log('[MessageStore] Chat ID mismatch, ignoring event');
    }
  });
  
  // Also listen for message-update events (for image generation status updates)
  unifiedChannel.on('message-update', (payload: any) => {
    const { chat_id, message: messageData } = payload;
    
    if (DEBUG) {
      console.log('[MessageStore] 🔄 Message update received from unified channel:', {
        chat_id,
        message_id: messageData?.id
      });
    }
    
    const { addMessage, chat_id: currentChatId } = useMessageStore.getState();
    
    // Only process if this is for the current chat
    if (chat_id === currentChatId && messageData) {
      const message = mapDbToMessage(messageData);
      const messageWithSource = { ...message, source: 'websocket' as const };
      addMessage(messageWithSource);
    }
  });
  
  // Listen for conversation-update events for sidebar updates
  unifiedChannel.on('conversation-update', (payload: any) => {
    const { eventType, data } = payload;
    
    if (DEBUG) {
      console.log('[MessageStore] 🔄 Conversation update received:', {
        eventType,
        conversation_id: data?.id
      });
    }
    
    // Forward to chat store for sidebar updates
    const chatStore = useChatStore.getState();
    
    switch (eventType) {
      case 'INSERT':
        chatStore.addConversation(data);
        break;
      case 'UPDATE':
        chatStore.updateConversation(data);
        break;
      case 'DELETE':
        chatStore.removeConversation(data.id);
        break;
    }
  });
  
  // Listen for assistant-thinking events (shows stop button immediately)
  unifiedChannel.on('assistant-thinking', (payload: any) => {
    const { chat_id, status } = payload;
    
    if (DEBUG) {
      console.log('[MessageStore] 🤔 Assistant thinking event received:', {
        chat_id,
        status
      });
    }
    
    const { chat_id: currentChatId } = useMessageStore.getState();
    
    // Only process if this is for the current chat
    if (chat_id === currentChatId && status === 'thinking') {
      const chatState = useChatStore.getState();
      
      // Set typing indicator immediately (shows stop button + "thinking..." indicator)
      if (!chatState.isAssistantTyping) {
        chatState.setAssistantTyping(true);
        if (DEBUG) console.log('[MessageStore] ⚡ Set assistant typing from thinking event');
      }
    }
  });
}
