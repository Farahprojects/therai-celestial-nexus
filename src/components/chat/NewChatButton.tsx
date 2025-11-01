import React, { useState } from 'react';
import { SquarePen, Sparkles, MessageCircle, Orbit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { getBillingMode } from '@/utils/billingMode';
import { useChatStore } from '@/core/store';
import { useMessageStore } from '@/stores/messageStore';
import { InsightsModal } from '@/components/insights/InsightsModal';
import { AstroDataForm } from '@/components/chat/AstroDataForm';
import { AstroChartSelector } from '@/components/chat/AstroChartSelector';
import { useFeatureUsage } from '@/hooks/useFeatureUsage';
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
  const billingMode = getBillingMode();
  const navigate = useNavigate();
  const { usage } = useFeatureUsage();
  const [showInsightsModal, setShowInsightsModal] = useState(false);
  const [showAstroChartSelector, setShowAstroChartSelector] = useState(false);
  const [showAstroModal, setShowAstroModal] = useState(false);
  const [selectedChartType, setSelectedChartType] = useState<string | null>(null);

  // Shared handleNewChat function - only for simple chat mode
  const handleNewChat = async () => {
    if (!user) {
      console.error('[NewChatButton] Cannot create new chat: user not authenticated');
      return;
    }

    // Gate: Check subscription in subscription mode
    if (billingMode === 'SUBSCRIPTION' && !isSubscriptionActive) {
      navigate('/subscription-paywall');
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
    // Gate: Check subscription in subscription mode
    if (billingMode === 'SUBSCRIPTION' && !isSubscriptionActive) {
      navigate('/subscription-paywall');
      return;
    }
    setShowInsightsModal(true);
  };

  // Shared handleOpenAstro function
  const handleOpenAstro = () => {
    // Gate: Check subscription in subscription mode
    if (billingMode === 'SUBSCRIPTION' && !isSubscriptionActive) {
      navigate('/subscription-paywall');
      return;
    }
    setShowAstroChartSelector(true);
  };

  // Handle chart selection from AstroChartSelector
  const handleSelectChart = (chartId: string) => {
    setSelectedChartType(chartId);
    setShowAstroChartSelector(false);
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
      setSelectedChartType(null);
      navigate(`/c/${newChatId}`, { replace: true });
    } catch (error) {
      console.error('[NewChatButton] Failed to navigate to astro conversation:', error);
    }
  };

  const handleCloseAstroModal = () => {
    setShowAstroModal(false);
    setSelectedChartType(null);
  };

  const handleBackToChartSelector = () => {
    setShowAstroModal(false);
    setShowAstroChartSelector(true);
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
            <div className="flex items-center justify-between w-full gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <span>Generate Insight</span>
              </div>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Astro Chart Selector Modal */}
      {showAstroChartSelector && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <AstroChartSelector
              onSelectChart={handleSelectChart}
              onClose={() => setShowAstroChartSelector(false)}
            />
          </div>
        </div>
      )}

      {/* Astro Data Form Modal */}
      {showAstroModal && selectedChartType && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <AstroDataForm
              onClose={handleCloseAstroModal}
              onSubmit={handleAstroFormSubmit}
              onBack={handleBackToChartSelector}
              mode="astro"
              preselectedType={selectedChartType}
              reportType={selectedChartType}
            />
          </div>
        </div>
      )}

      {/* Insights Modal */}
      <InsightsModal
        isOpen={showInsightsModal}
        onClose={() => setShowInsightsModal(false)}
      />
    </>
  );
};
