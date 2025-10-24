import React, { useState } from 'react';
import { SquarePen, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useChatStore } from '@/core/store';
import { useMessageStore } from '@/stores/messageStore';
import { AstroDataForm } from '@/components/chat/AstroDataForm';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SwissNewChartButtonProps {
  className?: string;
}

export const SwissNewChartButton: React.FC<SwissNewChartButtonProps> = ({ className = "" }) => {
  const { user } = useAuth();
  const { isSubscriptionActive } = useSubscription();
  const navigate = useNavigate();
  const [showAstroModal, setShowAstroModal] = useState(false);

  // Handle opening astro form for Swiss data generation
  const handleOpenAstro = () => {
    // Check subscription status
    if (!isSubscriptionActive) {
      navigate('/subscription');
      return;
    }
    setShowAstroModal(true);
  };

  // Handle Astro form submission - creates Swiss data conversation
  const handleAstroFormSubmit = async (data: any) => {
    if (!user) return;

    try {
      // AstroDataForm already created the conversation with report_data
      // The conversation was created with mode='swiss' via the form
      const newChatId = data.chat_id;
      
      if (!newChatId) {
        console.error('[SwissNewChartButton] No chat_id returned from form submission');
        return;
      }
      
      // Set chat_id and start conversation
      const { setChatId } = useMessageStore.getState();
      setChatId(newChatId);
      
      const { startConversation } = useChatStore.getState();
      startConversation(newChatId);
      
      // Switch WebSocket subscription
      // Swiss mode doesn't need WebSocket - we'll poll for data instead
      
      // Close modal and navigate to Swiss page with chat_id
      setShowAstroModal(false);
      navigate(`/swiss?chat_id=${newChatId}`, { replace: true });
    } catch (error) {
      console.error('[SwissNewChartButton] Failed to navigate to Swiss conversation:', error);
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
            onClick={handleOpenAstro}
            className="cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span>Generate Swiss Data</span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Astro Modal for Swiss Data */}
      {showAstroModal && (
        <AstroDataForm
          onClose={() => setShowAstroModal(false)}
          onSubmit={handleAstroFormSubmit}
          mode="swiss"
        />
      )}
    </>
  );
};

