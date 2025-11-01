import React, { useEffect, useState } from 'react';
import { ChatBox } from '@/features/chat/ChatBox';
import { ReportModalProvider } from '@/contexts/ReportModalContext';
import { useChatInitialization } from '@/hooks/useChatInitialization';
import { AuthModal } from '@/components/auth/AuthModal';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { getRedirectPath, clearRedirectPath, extractIdFromPath } from '@/utils/redirectUtils';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Single responsibility: Initialize chat when threadId changes
  useChatInitialization();
  
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
    </div>
  );
};

const ChatContainer: React.FC = () => {
  return <ChatContainerContent />;
};

export default ChatContainer;