import React, { useState } from 'react';
import { Share2 } from 'lucide-react';
import { useChatStore } from '@/core/store';
import { NewChatButton } from './NewChatButton';
import { ChatMenuButton } from './ChatMenuButton';
import { ShareConversationModal } from './ShareConversationModal';

export const ChatHeader: React.FC = () => {
  const { chat_id } = useChatStore();
  const [showShareModal, setShowShareModal] = useState(false);
  
  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
        <div className="flex items-center gap-3">
          {/* New Chat Button */}
          <NewChatButton />
        </div>

        <div className="flex items-center gap-2">
          {/* Share Button */}
          {chat_id && (
            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center justify-center w-8 h-8 text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <Share2 className="w-4 h-4" />
            </button>
          )}
          
          {/* 3 Dots Menu */}
          <ChatMenuButton />
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && chat_id && (
        <ShareConversationModal
          conversationId={chat_id}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </>
  );
};