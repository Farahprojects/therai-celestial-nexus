import React, { useEffect, useRef, Suspense, lazy, useState } from 'react';
import { ChatInput } from './ChatInput';
import { useChatStore } from '@/core/store';
import { useAuth } from '@/contexts/AuthContext';
import { chatController } from './ChatController';
import { supabase } from '@/integrations/supabase/client';

import { Menu, Sparkles, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { getChatTokens } from '@/services/auth/chatTokens';
import { MotionConfig } from 'framer-motion';
import { useConversationUIStore } from './conversation-ui-store';
import { SignInPrompt } from '@/components/auth/SignInPrompt';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { ShareConversationModal } from '@/components/chat/ShareConversationModal';
import { ShareFolderModal } from '@/components/folders/ShareFolderModal';
 

// Lazy load components for better performance
const MessageList = lazy(() => import('./MessageList').then(module => ({ default: module.MessageList })));
const ConversationOverlay = lazy(() => import('./ConversationOverlay/ConversationOverlay').then(module => ({ default: module.ConversationOverlay })));
const ChatSidebarControls = lazy(() => import('./ChatSidebarControls').then(module => ({ default: module.ChatSidebarControls })));
const ChatHeader = lazy(() => import('@/components/chat/ChatHeader').then(module => ({ default: module.ChatHeader })));
const NewChatButton = lazy(() => import('@/components/chat/NewChatButton').then(module => ({ default: module.NewChatButton })));
const ChatMenuButton = lazy(() => import('@/components/chat/ChatMenuButton').then(module => ({ default: module.ChatMenuButton })));
const FolderView = lazy(() => import('@/components/folders/FolderView').then(module => ({ default: module.FolderView })));

// Check if report is already generated for a chat_id (authenticated users only)
async function checkReportGeneratedStatus(chatId: string): Promise<boolean> {
  // For authenticated users, reports are handled differently
  // This function is kept for compatibility but always returns false
  return false;
}

interface ChatBoxProps {
  className?: string;
  onDelete?: () => void;
}

export const ChatBox: React.FC<ChatBoxProps> = ({ onDelete }) => {
  const { error, viewMode, selectedFolderId } = useChatStore();
  const { user } = useAuth();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showFolderShareModal, setShowFolderShareModal] = useState(false);
  const [hasCheckedTogetherModeShare, setHasCheckedTogetherModeShare] = useState(false);
  const navigate = useNavigate();
  const { uuid } = getChatTokens();
  const isConversationOpen = useConversationUIStore((s) => s.isConversationOpen);
  const { folderId: urlFolderId } = useParams<{ folderId?: string }>();
  
  
  // Get chat_id from store for payment flow
  const { chat_id, startConversation, setViewMode } = useChatStore();
  
  // Get user type from URL parameters - authenticated users only
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('user_id');
  
  // Determine user type and ID
  const isAuthenticated = !!userId;
  const currentUserId = userId;
  
  // User detection complete - no logging needed
  
  // Payment flow disabled for authenticated users
  const [shouldEnablePaymentFlow, setShouldEnablePaymentFlow] = useState(false);
  
  
  // ChatController methods for realtime updates (both text and conversation modes)
  const initializeAudioPipeline = chatController.initializeAudioPipeline.bind(chatController);
  const pauseMic = chatController.pauseMic.bind(chatController);
  const unpauseMic = chatController.unpauseMic.bind(chatController);
  // sendTextMessage removed - using unifiedWebSocketService.sendMessageDirect() directly
  const cancelMic = chatController.cancelMic.bind(chatController);
  const [signInPrompt, setSignInPrompt] = useState<{ show: boolean; feature: string }>({ 
    show: false, 
    feature: '' 
  });
  
  




  // Check if Together Mode conversation needs share modal
  useEffect(() => {
    const checkTogetherModeShare = async () => {
      if (!chat_id || !user || hasCheckedTogetherModeShare) return;
      
      try {
        // Fetch conversation mode and sharing status
        const { data: conversation, error: convError } = await supabase
          .from('conversations')
          .select('mode, is_public')
          .eq('id', chat_id)
          .single();
        
        if (convError) {
          console.error('[ChatBox] Error fetching conversation:', convError);
          return;
        }
        
        if (conversation?.mode === 'together') {
          // Check participants count - if only 1 participant (owner), it hasn't been shared
          const { data: participants, error: partError } = await supabase
            .from('conversations_participants')
            .select('user_id')
            .eq('conversation_id', chat_id);
          
          if (partError) {
            console.error('[ChatBox] Error checking participants:', partError);
            return;
          }
          
          // If conversation is public OR has more than 1 participant, it's been shared
          const isShared = conversation.is_public || (participants && participants.length > 1);
          
          // If not shared yet, show share modal
          if (!isShared) {
            setShowShareModal(true);
            setHasCheckedTogetherModeShare(true);
          } else {
            // Already shared, don't show modal
            setHasCheckedTogetherModeShare(true);
          }
        } else {
          // Not together mode, mark as checked
          setHasCheckedTogetherModeShare(true);
        }
      } catch (error) {
        console.error('[ChatBox] Error checking together mode share:', error);
      }
    };
    
    checkTogetherModeShare();
  }, [chat_id, user, hasCheckedTogetherModeShare]);
  
  // Reset check when chat_id changes
  useEffect(() => {
    setHasCheckedTogetherModeShare(false);
  }, [chat_id]);




  // Loading skeleton for message area
  const MessageListSkeleton = () => (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex flex-col space-y-6">
        {/* Welcome message skeleton */}
        <div className="flex-1 flex flex-col justify-end">
          <div className="p-4">
            <div className="h-8 bg-gray-200 rounded-lg w-3/4 animate-pulse"></div>
          </div>
        </div>
        {/* Message skeleton */}
        <div className="flex items-end gap-3 justify-start">
          <div className="px-4 py-3 rounded-2xl max-w-2xl lg:max-w-4xl">
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-full animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <MotionConfig
        transition={{
          type: "spring",
          bounce: 0.2,
          duration: 0.6
        }}
      >
        <div className="flex flex-row flex-1 bg-white w-full min-h-0 mobile-chat-container" style={{ scrollBehavior: 'smooth', overscrollBehavior: 'contain' as any }}>
          {/* Left Sidebar (Desktop) - extends to left edge */}
          <div className="hidden md:flex w-64 border-r border-gray-100 flex-col bg-gray-50/50 h-full">
            <div className="py-4 flex flex-col h-full">
              <Suspense fallback={<div className="space-y-4"><div className="h-8 bg-gray-200 rounded animate-pulse"></div><div className="h-6 bg-gray-200 rounded animate-pulse"></div><div className="h-6 bg-gray-200 rounded animate-pulse"></div></div>}>
                <ChatSidebarControls onDelete={onDelete} conversationType="chat" />
              </Suspense>
            </div>
          </div>

          {/* Main Chat Area - centered content */}
          <div className="flex flex-col flex-1 w-full min-w-0 mobile-chat-container">
            <div className="max-w-6xl mx-auto w-full h-full flex flex-col md:border-x border-gray-100">

              {/* Mobile Header */}
              <div className="md:hidden p-3 bg-white border-b border-gray-100 pt-safe">
                <div className="max-w-3xl mx-auto w-full flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
                    <SheetTrigger asChild>
                      <button
                        aria-label="Open menu"
                        className="p-2 rounded-md border border-gray-200 bg-white"
                      >
                        <Menu className="w-5 h-5" />
                      </button>
                    </SheetTrigger>
                    <SheetContent 
                      side="left" 
                      className="w-[85%] sm:max-w-xs p-0"
                      style={{
                        paddingTop: 'env(safe-area-inset-top)',
                        paddingBottom: 'env(safe-area-inset-bottom)',
                      }}
                    >
                      <div className="h-full flex flex-col bg-gray-50/50">
                        <div className="p-4 flex flex-col h-full bg-white">
                          <Suspense fallback={<div className="space-y-4"><div className="h-8 bg-gray-200 rounded animate-pulse"></div><div className="h-6 bg-gray-200 rounded animate-pulse"></div><div className="h-6 bg-gray-200 rounded animate-pulse"></div></div>}>
                            <ChatSidebarControls onDelete={onDelete} onCloseMobileSidebar={() => setIsMobileSidebarOpen(false)} conversationType="chat" />
                          </Suspense>
                        </div>
                      </div>
                    </SheetContent>
                  </Sheet>
                  
                  {/* New Chat Button on left */}
                  <Suspense fallback={<div className="h-8 w-8 bg-gray-200 rounded-lg animate-pulse" />}>
                    <NewChatButton />
                  </Suspense>
                </div>
                
                <div className="flex items-center gap-2">
                  {/* Share Button - Works for both folders and chats */}
                  <button
                    onClick={() => {
                      if (viewMode === 'folder' && (selectedFolderId || urlFolderId)) {
                        setShowFolderShareModal(true);
                      } else if (chat_id) {
                        setShowShareModal(true);
                      }
                    }}
                    disabled={!chat_id && viewMode !== 'folder'}
                    className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                      (chat_id || viewMode === 'folder')
                        ? 'text-gray-700 hover:text-gray-900 hover:bg-gray-50' 
                        : 'text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                  
                  {/* 3 Dots Menu */}
                  <Suspense fallback={<div className="h-8 w-8 bg-gray-200 rounded-lg animate-pulse" />}>
                    <ChatMenuButton />
                  </Suspense>
                </div>
                </div>
              </div>

              {/* Chat Header - Desktop only */}
              <div className="hidden md:block">
                <Suspense fallback={<div className="h-12 bg-white border-b border-gray-100" />}>
                  <ChatHeader />
                </Suspense>
              </div>

              {/* Main Content Area - Conditionally render FolderView or MessageList */}
              <div className="flex-1 min-h-0 mobile-messages-area" style={{ overflowAnchor: 'none' as any }}>
                {viewMode === 'folder' && selectedFolderId ? (
                  <Suspense fallback={<MessageListSkeleton />}>
                    <FolderView
                      folderId={selectedFolderId}
                      onChatClick={(chatId: string) => {
                        startConversation(chatId);
                        navigate(`/c/${chatId}`);
                      }}
                    />
                  </Suspense>
                ) : (
                  <Suspense fallback={<MessageListSkeleton />}>
                    <MessageList />
                  </Suspense>
                )}
              </div>

              {/* Footer Area - Only show ChatInput when in chat view */}
              {viewMode === 'chat' && (
                <div 
                  className="mobile-input-area mobile-input-container"
                >
                  {error && (
                    <div className="p-3 text-sm font-medium text-red-700 bg-red-100 border-t border-red-200">
                      {error}
                    </div>
                  )}
                  <div className="border-t border-gray-100">
                    <ChatInput />
                  </div>
                </div>
              )}

              {/* Conversation Overlay */}
              <Suspense fallback={null}>
                <ConversationOverlay />
              </Suspense>
            </div>
          </div>
        </div>
      </MotionConfig>


      {/* Settings Modal */}
      {/* {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )} */}

      {/* Sign In Prompt */}
      {signInPrompt.show && (
        <SignInPrompt
          feature={signInPrompt.feature}
          onClose={() => setSignInPrompt({ show: false, feature: '' })}
        />
      )}

      {/* Share Modal */}
      {showShareModal && chat_id && (
        <ShareConversationModal
          conversationId={chat_id}
          onClose={async () => {
            setShowShareModal(false);
            // Re-check sharing status after modal closes to see if it was shared
            if (chat_id) {
              const { data: conversation } = await supabase
                .from('conversations')
                .select('is_public')
                .eq('id', chat_id)
                .single();
              
              const { data: participants } = await supabase
                .from('conversations_participants')
                .select('user_id')
                .eq('conversation_id', chat_id);
              
              // If now shared (is_public or participants > 1), mark as checked so modal won't show again
              const isShared = conversation?.is_public || (participants && participants.length > 1);
              if (isShared) {
                setHasCheckedTogetherModeShare(true);
              }
            }
          }}
        />
      )}

      {/* Folder Share Modal */}
      {showFolderShareModal && (selectedFolderId || urlFolderId) && (
        <ShareFolderModal
          folderId={selectedFolderId || urlFolderId || ''}
          onClose={() => setShowFolderShareModal(false)}
        />
      )}

      {/* Report Modal is now rendered by the provider */}
    </>
  );
};
