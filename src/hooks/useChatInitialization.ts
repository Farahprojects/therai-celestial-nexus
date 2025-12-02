import { useEffect } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useChatStore } from '@/core/store';
import { chatController } from '@/features/chat/ChatController';
import { useAuth } from '@/contexts/AuthContext';
import { getLastChatId } from '@/services/auth/chatTokens';

/**
 * Direct chat initialization - always fetch from source of truth (DB)
 * No more fragile sessionStorage hydration
 * 
 * Architecture:
 * - URL threadId → Direct DB fetch → Store → UI
 * - WebSocket initialized once on app startup
 * - Everything is explicit and direct
 */
export const useChatInitialization = () => {
  const { threadId, chatId, folderId } = useParams<{ threadId?: string; chatId?: string; folderId?: string }>();
  const routeChatId = threadId || chatId;
  const { startConversation, setViewMode } = useChatStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Load threads when user signs in (useChatStore needs this for ChatThreadsSidebar)
    if (user) {
      const { loadThreads } = useChatStore.getState();
      
      // Load all threads from DB (conversations table)
      loadThreads(user.id);
      
      // No persistence - always start fresh from URL
    }
  }, [user]);

  useEffect(() => {
    // Handle folder navigation from URL
    if (folderId) {
      setViewMode('folder', folderId);
      
      // Check if there's a chat_id query parameter for folder routes
      const chatIdFromQuery = searchParams.get('chat_id');
      if (chatIdFromQuery && chatIdFromQuery !== "1") {
        // Load the chat when on a folder route with chat_id query param
        const loadThread = async () => {
          try {
            const { useMessageStore } = await import('@/stores/messageStore');
            useMessageStore.getState().setChatId(chatIdFromQuery);
            startConversation(chatIdFromQuery);
            await chatController.switchToChat(chatIdFromQuery);
          } catch (error) {
            console.error('[useChatInitialization] Error loading thread from folder query:', error);
            useChatStore.getState().clearChat();
          }
        };
        
        loadThread();
      }
      return;
    }

    // Handle direct URL navigation for both /c/:threadId and /join/:chatId
    if (routeChatId && routeChatId !== "1") {
      // Load the chat directly - let the message store handle validation
      const loadThread = async () => {
        try {
          // Use the same direct flow as handleSwitchToChat
          const { useMessageStore } = await import('@/stores/messageStore');
          useMessageStore.getState().setChatId(routeChatId);
          startConversation(routeChatId);
          await chatController.switchToChat(routeChatId);
        } catch (error) {
          console.error('[useChatInitialization] Error loading thread:', error);
          useChatStore.getState().clearChat();
        }
      };
      
      loadThread();
    } else if (routeChatId === "1") {
      useChatStore.getState().clearChat();
    }
  }, [routeChatId, folderId, startConversation, setViewMode, searchParams]);

  // Smart navigation: redirect to last chat when visiting root URLs
  useEffect(() => {
    // Don't redirect if we're on a folder route
    if (folderId) return;
    
    if (!threadId && user) {
      const redirectToLastChat = async () => {
        try {
          // Check if we're on a root URL that should redirect
          const isRootUrl = location.pathname === '/' || location.pathname === '/therai';
          
          if (isRootUrl) {
            const { chatId } = getLastChatId();
            
            if (chatId) {
              // Validate the chat exists in current threads
              const { threads, isLoadingThreads } = useChatStore.getState();
              
              // Wait for threads to load if they're still loading
              if (isLoadingThreads) {
                // Set up a listener to wait for threads to finish loading
                const checkThreadsLoaded = () => {
                  const currentState = useChatStore.getState();
                  if (!currentState.isLoadingThreads) {
                    const threadExists = currentState.threads.some(thread => thread.id === chatId);
                    if (threadExists) {
                      // Redirect to the last chat
                      navigate(`/c/${chatId}`, { replace: true });
                    }
                  }
                };
                
                // Check immediately and set up a small delay to catch the state change
                setTimeout(checkThreadsLoaded, 100);
              } else {
                const threadExists = threads.some(thread => thread.id === chatId);
                if (threadExists) {
                  // Redirect to the last chat
                  navigate(`/c/${chatId}`, { replace: true });
                }
              }
            }
          }
        } catch (error) {
          console.error('[useChatInitialization] Error redirecting to last chat:', error);
        }
      };

      redirectToLastChat();
    }
  }, [threadId, folderId, user, location.pathname, navigate]);
};
