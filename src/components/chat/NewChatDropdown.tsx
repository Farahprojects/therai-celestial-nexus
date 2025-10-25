import React, { useState } from 'react';
import { Plus, ChevronDown, Sparkles, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useChatStore } from '@/core/store';
import { useMessageStore } from '@/stores/messageStore';
import { InsightsModal } from '@/components/insights/InsightsModal';
import { AstroDataForm } from '@/components/chat/AstroDataForm';
import { ReportFormData } from '@/types/public-report';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface NewChatDropdownProps {
  className?: string;
}

export const NewChatDropdown: React.FC<NewChatDropdownProps> = ({ className = "" }) => {
  const { user } = useAuth();
  const { isSubscriptionActive } = useSubscription();
  const navigate = useNavigate();
  const [showInsightsModal, setShowInsightsModal] = useState(false);
  const [showAstroModal, setShowAstroModal] = useState(false);

  // Shared handleNewChat function - all creation goes through conversation-manager
  const handleNewChat = async (mode: 'chat' | 'astro' | 'insight' = 'chat') => {
    if (!user) {
      console.error('[NewChatDropdown] Cannot create new chat: user not authenticated');
      return;
    }

    // Check subscription status
    if (!isSubscriptionActive) {
      navigate('/subscription');
      return;
    }

    try{
      const title = mode === 'insight' ? 'New Insight Chat' : 'New Chat';
      
      // Create conversation through conversation-manager edge function
      const { addThread } = useChatStore.getState();
      const newChatId = await addThread(user.id, mode, title);
      
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
      console.error('[NewChatDropdown] Failed to create new conversation:', error);
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

  // Handle Astro modal open - just show the form, don't create conversation yet
  const handleOpenAstro = () => {
    // Check subscription status
    if (!isSubscriptionActive) {
      navigate('/subscription');
      return;
    }
    setShowAstroModal(true);
  };

  // Handle Astro form submission - AstroDataForm creates conversation with report_data
  const handleAstroFormSubmit = async (data: ReportFormData & { chat_id?: string }) => {
    if (!user) return;

    try {
      // AstroDataForm already created the conversation with report_data through conversation-manager
      // Just need to navigate to it
      const newChatId = data.chat_id;
      
      if (!newChatId) {
        console.error('[NewChatDropdown] No chat_id returned from form submission');
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
      console.error('[NewChatDropdown] Failed to navigate to astro conversation:', error);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={`flex items-center gap-2 px-3 py-1.5 text-sm font-light text-black hover:bg-gray-100 rounded-lg transition-colors ${className}`}>
            <Plus className="w-4 h-4" />
            New Chat
            <ChevronDown className="w-3 h-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem
            onClick={() => handleNewChat('chat')}
            className="cursor-pointer"
          >
            Chat
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleOpenAstro}
            className="cursor-pointer"
          >
            Astro
          </DropdownMenuItem>
          <DropdownMenuSeparator />
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

      {/* Insights Modal */}
      <InsightsModal
        isOpen={showInsightsModal}
        onClose={() => setShowInsightsModal(false)}
      />

      {/* Astro Modal */}
      {showAstroModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-2xl font-light text-gray-900">Astro</h2>
                <p className="text-sm text-gray-500 mt-1">Discover your self or compare energy signal's</p>
              </div>
              <button
                onClick={() => setShowAstroModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <AstroDataForm
                onClose={() => setShowAstroModal(false)}
                onSubmit={handleAstroFormSubmit}
                variant="standalone"
                isProfileFlow={false}
                mode="astro"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
