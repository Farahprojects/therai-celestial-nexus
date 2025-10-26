import React, { useState } from 'react';
import { SquarePen, Sparkles, MessageCircle, Orbit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useChatStore } from '@/core/store';
import { useMessageStore } from '@/stores/messageStore';
import { InsightsModal } from '@/components/insights/InsightsModal';
import { AstroDataForm } from '@/components/chat/AstroDataForm';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface NewChatButtonProps {
  className?: string;
}

export const NewChatButton: React.FC<NewChatButtonProps> = ({ className = "" }) => {
  const { user } = useAuth();
  const { isSubscriptionActive } = useSubscription();
  const navigate = useNavigate();
  const [showInsightsModal, setShowInsightsModal] = useState(false);
  const [showAstroModal, setShowAstroModal] = useState(false);

  // Shared handleNewChat function - only for simple chat mode
  const handleNewChat = async () => {
    if (!user) {
      console.error('[NewChatButton] Cannot create new chat: user not authenticated');
      return;
    }

    // Check subscription status
    if (!isSubscriptionActive) {
      navigate('/subscription');
      return;
    }

    try {
      // Create conversation through conversation-manager edge function
      const { addThread } = useChatStore.getState();
      const newChatId = await addThread(user.id, 'chat', 'New Chat');
      
      // Set chat_id and fetch messages
      const { setChatId } = useMessageStore.getState();
      setChatId(newChatId);
      
      // Update the main chat store
      const { startConversation } = useChatStore.getState();
      startConversation(newChatId);
      
      // Switch WebSocket subscription to new chat_id
      const { chatController } = await import('@/features/chat/ChatController');
      await chatController.switchToChat(newChatId);
      
      // Navigate to the new conversation
      navigate(`/c/${newChatId}`, { replace: true });
    } catch (error) {
      console.error('[NewChatButton] Failed to create new conversation:', error);
    }
  };

  // Shared handleOpenInsights function
  const handleOpenInsights = () => {
    // Check subscription status
    if (!isSubscriptionActive) {
      navigate('/subscription');
      return;
    }
    setShowInsightsModal(true);
  };

  // Shared handleOpenAstro function
  const handleOpenAstro = () => {
    // Check subscription status
    if (!isSubscriptionActive) {
      navigate('/subscription');
      return;
    }
    setShowAstroModal(true);
  };

  // Handle Astro form submission - AstroDataForm creates conversation with report_data
  const handleAstroFormSubmit = async (data: any) => {
    if (!user) return;

    try {
      // AstroDataForm already created the conversation with report_data through conversation-manager
      // Just need to navigate to it
      const newChatId = data.chat_id;
      
      if (!newChatId) {
        console.error('[NewChatButton] No chat_id returned from form submission');
        return;
      }
      
      // Set chat_id and start conversation
      const { setChatId } = useMessageStore.getState();
      setChatId(newChatId);
      
      const { startConversation } = useChatStore.getState();
      startConversation(newChatId);
      
      // Switch WebSocket subscription
      const { chatController } = await import('@/features/chat/ChatController');
      await chatController.switchToChat(newChatId);
      
      // Close modal and navigate
      setShowAstroModal(false);
      navigate(`/c/${newChatId}`, { replace: true });
    } catch (error) {
      console.error('[NewChatButton] Failed to navigate to astro conversation:', error);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={`flex items-center justify-center p-2 text-black hover:bg-gray-100 rounded-lg transition-colors ${className}`}>
            <SquarePen className="w-5 h-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem
            onClick={handleNewChat}
            className="cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              <span>Chat</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleOpenAstro}
            className="cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Orbit className="w-4 h-4" />
              <span>Generate Astro</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleOpenInsights}
            className="cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span>Generate Insight</span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Astro Modal */}
      {showAstroModal && (
        <AstroDataForm
          onClose={() => setShowAstroModal(false)}
          onSubmit={handleAstroFormSubmit}
        />
      )}

      {/* Insights Modal */}
      <InsightsModal
        isOpen={showInsightsModal}
        onClose={() => setShowInsightsModal(false)}
      />
    </>
  );
};
