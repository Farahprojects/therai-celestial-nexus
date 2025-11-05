import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { useChatStore } from '@/core/store';
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
    // If any error checking auth/chat state, assume we should clean
    console.warn('[MessageStore] Error checking auth state:', error);
    return true;
  }
};

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
          updated[idx] = { 
            ...updated[idx], 
            ...message, 
            pending: false, 
            source: message.source || updated[idx].source 
          };
          // ⚡ OPTIMIZED: No sort needed - messages already in order from DB
          return { messages: updated };
        }
      }

      // Check if message already exists by id
      const exists = state.messages.some(m => m.id === message.id);
      
      if (exists) {
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
      
      // ⚡ OPTIMIZED: Add new message - no sort needed, messages arrive ordered from DB
      const newMessages = [...state.messages, message];
      
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
      
      // ⚡ OPTIMIZED: Add optimistic message - no sort needed, new timestamp > existing
      const newMessages = [...state.messages, optimisticMessage];
      
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
      set((state) => ({
        messages: [...olderMessages, ...state.messages],
        hasOlder: (data?.length || 0) === 50
      }));
    } catch (e: any) {
      console.error('[MessageStore] Failed to load older messages:', e);
    }
  },


}));

// Self-cleaning mechanism - only called on auth state changes
export const triggerMessageStoreSelfClean = async () => {
  await useMessageStore.getState().selfClean();
};

// 🔒 Initialize message store - listen for WebSocket events (one-time guard)
if (typeof window !== 'undefined' && !(window as any).__msgStoreListenerInstalled) {
  (window as any).__msgStoreListenerInstalled = true;
  
  // Listen for message events from WebSocket
  window.addEventListener('assistant-message', async (event: any) => {
    const { chat_id, role, message: messageData } = event.detail;
    
    if (DEBUG) {
      console.log('[MessageStore] 🔔 Message event received:', { 
        role,
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
      if (DEBUG) console.log('[MessageStore] ⚡ Using WebSocket payload directly (no DB refetch)');
      
      // Use message data directly from WebSocket payload
      const message = mapDbToMessage(messageData);
      const messageWithSource = { ...message, source: 'websocket' as const };
      
      // Always call addMessage - it handles both INSERT (new) and UPDATE (existing) cases
      // The addMessage function checks if message exists by ID and updates it if needed
      addMessage(messageWithSource);
      
      // ⚡ OPTIMIZED: Handle side-effects ONLY for assistant messages
      if (role === 'assistant') {
        // Clear typing immediately - guard to prevent unnecessary state update
        const chatState = useChatStore.getState();
        if (chatState.isAssistantTyping) {
          chatState.setAssistantTyping(false);
        }
      }
    } else if (DEBUG && chat_id !== currentChatId) {
      console.log('[MessageStore] Chat ID mismatch, ignoring event');
    }
  });
}
