import React, { useEffect, useState } from 'react';
import { ChatBox } from '@/features/chat/ChatBox';
import { ReportModalProvider } from '@/contexts/ReportModalContext';
import { useChatInitialization } from '@/hooks/useChatInitialization';
import { AuthModal } from '@/components/auth/AuthModal';
import { StarterQuestionsPopup } from '@/components/onboarding/StarterQuestionsPopup';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useSearchParams, useNavigate, useLocation, useParams } from 'react-router-dom';
import { getRedirectPath, clearRedirectPath, extractIdFromPath } from '@/utils/redirectUtils';
import { useChatStore } from '@/core/store';
import { useMessageStore } from '@/stores/messageStore';
import { toast } from 'sonner';

/**
 * Streamlined ChatContainer - Single Responsibility
 * 
 * Architecture:
 * - URL threadId → useChatInitialization → ChatController → Store → Components
 * - PaymentFlowOrchestrator handles all payment logic and UI
 * - ChatContainer just renders ChatBox when unlocked
 */
const ChatContainerContent: React.FC = () => {
  const { user } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showStarterQuestions, setShowStarterQuestions] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { threadId } = useParams<{ threadId: string }>();
  const { chat_id } = useChatStore();

  // Single responsibility: Initialize chat when threadId changes
  useChatInitialization();
  
  // Check for onboarding flow - show starter questions if ?new=true AND both flags are true
  // IMPORTANT: Only show after chat_id is set to prevent ChatInput fallback from creating duplicate conversation
  useEffect(() => {
    const checkAndShowStarter = async () => {
      const isNew = searchParams.get('new') === 'true';
      const onboardingChatId = localStorage.getItem('onboarding_chat_id');
      
      // CRITICAL: Wait for chat_id to be set before showing starter questions
      // This ensures ChatInput doesn't hit its fallback path and create a duplicate conversation
      if (isNew && chat_id && onboardingChatId === chat_id && user) {
        // Check if user has seen subscription page AND onboarding modal has fully closed
        const { data: profile } = await supabase
          .from('profiles')
          .select('has_seen_subscription_page, onboarding_modal_closed')
          .eq('id', user.id)
          .maybeSingle();
        
        if (profile?.has_seen_subscription_page && profile?.onboarding_modal_closed) {
          console.log('[ChatContainer] Chat initialized, onboarding complete, showing starter questions', { chat_id });
          setShowStarterQuestions(true);
          
          // Remove ?new from URL
          const newSearchParams = new URLSearchParams(searchParams);
          newSearchParams.delete('new');
          setSearchParams(newSearchParams, { replace: true });
        } else {
          console.log('[ChatContainer] Waiting for onboarding modal to close', {
            has_seen_subscription_page: profile?.has_seen_subscription_page,
            onboarding_modal_closed: profile?.onboarding_modal_closed
          });
        }
      }
    };
    
    checkAndShowStarter();
  }, [searchParams, chat_id, user, setSearchParams]);
  
  // Clear redirect persistence after successful navigation
  useEffect(() => {
    const currentPath = location.pathname;
    
    // If we're on a folder or chat route, check if we just completed a redirect
    if (currentPath.startsWith('/folders/') || currentPath.startsWith('/c/')) {
      const pendingFolderId = localStorage.getItem('pending_join_folder_id');
      const pendingChatId = localStorage.getItem('pending_join_chat_id');
      const pendingRedirect = localStorage.getItem('pending_redirect_path');
      
      // Only clear if we're actually on the pending route (confirms success)
      // Use exact path matching for safety
      const onPendingFolder = pendingFolderId && currentPath === `/folders/${pendingFolderId}`;
      const onPendingChat = pendingChatId && currentPath === `/c/${pendingChatId}`;
      let onRedirectPath = false;
      if (pendingRedirect) {
        try {
          const redirectPath = new URL(pendingRedirect, window.location.origin).pathname;
          onRedirectPath = currentPath === redirectPath;
        } catch {
          // Invalid URL, skip
        }
      }
      
      if (onPendingFolder || onPendingChat || onRedirectPath) {
        console.log('[ChatContainer] Successfully redirected - clearing persistence', {
          currentPath,
          onPendingFolder,
          onPendingChat,
          onRedirectPath
        });
        clearRedirectPath();
      }
    }
  }, [location.pathname]);
  
  // Check for pending join token/folder/chat and open auth modal
  useEffect(() => {
    const pendingToken = localStorage.getItem('pending_join_token');
    const pendingFolderId = localStorage.getItem('pending_join_folder_id');
    const pendingChatId = localStorage.getItem('pending_join_chat_id');
    if ((pendingToken || pendingFolderId || pendingChatId) && !user) {
      setShowAuthModal(true);
    }
  }, [user]);

  // Handle pending folder/chat join after sign in
  useEffect(() => {
    const handlePendingJoins = async () => {
      if (!user?.id) return;
      
      // Priority 1: Check URL params for redirect
      const redirectPath = getRedirectPath(searchParams);
      
      if (redirectPath) {
        console.log('[ChatContainer] Found redirect path in URL params:', redirectPath);
        
        // Extract ID and type from path
        const { type, id } = extractIdFromPath(redirectPath);
        
        if (type === 'folder' && id) {
          console.log('[ChatContainer] Handling folder redirect', { folderId: id, userId: user.id });
          try {
            const { addFolderParticipant, isFolderParticipant } = await import('@/services/folders');
            
            const isParticipant = await isFolderParticipant(id, user.id);
            console.log('[ChatContainer] Is participant:', isParticipant);
            
            if (!isParticipant) {
              console.log('[ChatContainer] Adding as participant');
              await addFolderParticipant(id, user.id, 'member');
              console.log('[ChatContainer] Successfully added as participant');
            }
            
            // Clear redirect param and navigate
            clearRedirectPath();
            searchParams.delete('redirect');
            setSearchParams(searchParams);
            console.log('[ChatContainer] Redirecting to:', redirectPath);
            navigate(redirectPath, { replace: true });
            return;
          } catch (error) {
            console.error('[ChatContainer] Error joining folder:', error);
            clearRedirectPath();
            searchParams.delete('redirect');
            setSearchParams(searchParams);
          }
        } else if (type === 'chat' && id) {
          console.log('[ChatContainer] Handling chat redirect', { chatId: id });
          try {
            // Check if user is already a participant
            const { data: existingParticipant } = await supabase
              .from('conversations_participants')
              .select('conversation_id')
              .eq('conversation_id', id)
              .eq('user_id', user.id)
              .maybeSingle();

            if (!existingParticipant) {
              // Add user as participant
              await supabase
                .from('conversations_participants')
                .insert({
                  conversation_id: id,
                  user_id: user.id,
                  role: 'member',
                });
              console.log('[ChatContainer] Added as chat participant');
            }
            
            // Clear redirect param and navigate
            clearRedirectPath();
            searchParams.delete('redirect');
            setSearchParams(searchParams);
            console.log('[ChatContainer] Redirecting to:', redirectPath);
            navigate(redirectPath, { replace: true });
            return;
          } catch (error) {
            console.error('[ChatContainer] Error joining chat:', error);
            clearRedirectPath();
            searchParams.delete('redirect');
            setSearchParams(searchParams);
          }
        } else {
          // Unknown redirect path, just navigate to it
          console.log('[ChatContainer] Navigating to redirect path:', redirectPath);
          clearRedirectPath();
          searchParams.delete('redirect');
          setSearchParams(searchParams);
          navigate(redirectPath, { replace: true });
          return;
        }
      }
      
      // Priority 2: Fallback to localStorage (backward compatibility)
      const storedRedirectPath = localStorage.getItem('pending_redirect_path');
      const pendingFolderId = localStorage.getItem('pending_join_folder_id');
      
      if (pendingFolderId) {
        console.log('[ChatContainer] Handling pending folder join from localStorage', { pendingFolderId, userId: user.id });
        try {
          const { addFolderParticipant, isFolderParticipant } = await import('@/services/folders');
          
          const isParticipant = await isFolderParticipant(pendingFolderId, user.id);
          console.log('[ChatContainer] Is participant:', isParticipant);
          
          if (!isParticipant) {
            console.log('[ChatContainer] Not a participant - adding as participant');
            await addFolderParticipant(pendingFolderId, user.id, 'member');
            console.log('[ChatContainer] Successfully added as participant');
          }
          
          const finalPath = storedRedirectPath || `/folders/${pendingFolderId}`;
          clearRedirectPath();
          console.log('[ChatContainer] Redirecting to:', finalPath);
          navigate(finalPath, { replace: true });
          return;
        } catch (error) {
          console.error('[ChatContainer] Error joining pending folder:', error);
          clearRedirectPath();
        }
      }
      
      // Handle pending chat join from localStorage
      const pendingChatId = localStorage.getItem('pending_join_chat_id');
      if (pendingChatId) {
        try {
          // Check if user is already a participant
          const { data: existingParticipant } = await supabase
            .from('conversations_participants')
            .select('conversation_id')
            .eq('conversation_id', pendingChatId)
            .eq('user_id', user.id)
            .maybeSingle();

          if (!existingParticipant) {
            // Add user as a participant
            const { error: insertError } = await supabase
              .from('conversations_participants')
              .insert({
                conversation_id: pendingChatId,
                user_id: user.id,
                role: 'member',
              });

            if (insertError) {
              console.error('Error adding user as participant:', insertError);
              localStorage.removeItem('pending_join_chat_id');
              localStorage.removeItem('pending_redirect_path');
              return;
            }
          }
          
          const finalPath = storedRedirectPath || `/c/${pendingChatId}`;
          clearRedirectPath();
          console.log('[ChatContainer] Redirecting to:', finalPath);
          navigate(finalPath, { replace: true });
        } catch (error) {
          console.error('[ChatContainer] Error joining pending chat:', error);
          clearRedirectPath();
        }
      }
    };

    handlePendingJoins();
  }, [user, searchParams, setSearchParams, navigate]);

  // Handle starter question selection
  const handleQuestionSelect = async (question: string) => {
    setShowStarterQuestions(false);
    
    if (!chat_id || !user) {
      console.error('[ChatContainer] Missing chat_id or user for starter question');
      return;
    }

    try {
      // Get user profile data for display name
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .maybeSingle();
      
      const displayName = profile?.display_name || 'User';
      
      // Send the selected question as a message
      const { llmService } = await import('@/services/llm/chat');
      
      // Ensure chat_id is set in message store
      useMessageStore.getState().setChatId(chat_id);
      useChatStore.getState().startConversation(chat_id);
      
      // Create optimistic message
      const client_msg_id = crypto.randomUUID();
      const optimisticMessage = {
        id: client_msg_id,
        chat_id: chat_id,
        role: 'user' as const,
        text: question,
        createdAt: new Date().toISOString(),
        status: 'thinking' as const,
        client_msg_id,
        mode: 'chat',
        user_id: user.id,
        user_name: displayName
      };
      
      // Add message to UI immediately
      const { addOptimisticMessage } = useMessageStore.getState();
      addOptimisticMessage(optimisticMessage);
      
      // Send message to backend
      await llmService.sendMessage({
        chat_id: chat_id,
        text: question,
        mode: 'chat',
        chattype: 'text',
        client_msg_id,
        user_id: user.id,
        user_name: displayName
      });
      
      // Clear onboarding chat ID from localStorage
      localStorage.removeItem('onboarding_chat_id');
      
      // Refresh conversations list to show the new chat/folder in UI
      const { loadThreads } = useChatStore.getState();
      if (user?.id) {
        loadThreads(user.id).catch(err =>
          console.error('[ChatContainer] Failed to refresh conversations:', err)
        );
      }
      
      console.log('[ChatContainer] Starter question sent successfully');
    } catch (error) {
      console.error('[ChatContainer] Error sending starter question:', error);
      toast.error('Failed to send message. Please try again.');
    }
  };

  return (
    <div 
      className="flex flex-col" 
      style={{ 
        height: '100dvh', 
        minHeight: '100vh', 
        overscrollBehavior: 'contain' as any,
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      
      <ReportModalProvider>
        <ChatBox />
      </ReportModalProvider>
      
      {/* Auth modal for pending joins */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultMode="login"
      />
      
      {/* Starter questions popup for onboarding */}
      <StarterQuestionsPopup
        isOpen={showStarterQuestions}
        onQuestionSelect={handleQuestionSelect}
      />
      
    </div>
  );
};

const ChatContainer: React.FC = () => {
  return <ChatContainerContent />;
};

export default ChatContainer;