import React, { useEffect, useState } from 'react';
import { ChatBox } from '@/features/chat/ChatBox';
import { ReportModalProvider } from '@/contexts/ReportModalContext';
import { useChatInitialization } from '@/hooks/useChatInitialization';
import { AuthModal } from '@/components/auth/AuthModal';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

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

  // Single responsibility: Initialize chat when threadId changes
  useChatInitialization();
  
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
      
      // Get the preserved redirect path
      const redirectPath = localStorage.getItem('pending_redirect_path');
      
      // Handle pending folder join
      const pendingFolderId = localStorage.getItem('pending_join_folder_id');
      if (pendingFolderId) {
        try {
          const { addFolderParticipant, isFolderParticipant } = await import('@/services/folders');
          
          // Check if already a participant
          const isParticipant = await isFolderParticipant(pendingFolderId, user.id);
          if (!isParticipant) {
            await addFolderParticipant(pendingFolderId, user.id, 'member');
          }
          
          // Clear pending and redirect to preserved path or folder URL
          localStorage.removeItem('pending_join_folder_id');
          const finalPath = redirectPath || `/folders/${pendingFolderId}`;
          localStorage.removeItem('pending_redirect_path');
          window.location.href = finalPath;
          return;
        } catch (error) {
          console.error('Error joining pending folder:', error);
          localStorage.removeItem('pending_join_folder_id');
          localStorage.removeItem('pending_redirect_path');
        }
      }
      
      // Handle pending chat join
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
          
          // Clear pending and redirect to preserved path or chat URL
          localStorage.removeItem('pending_join_chat_id');
          const finalPath = redirectPath || `/c/${pendingChatId}`;
          localStorage.removeItem('pending_redirect_path');
          window.location.href = finalPath;
        } catch (error) {
          console.error('Error joining pending chat:', error);
          localStorage.removeItem('pending_join_chat_id');
          localStorage.removeItem('pending_redirect_path');
        }
      }
    };

    if (user?.id) {
      handlePendingJoins();
    }
  }, [user]);

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