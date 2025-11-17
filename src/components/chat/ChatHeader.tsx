import React, { useState } from 'react';
import { Share2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useChatStore } from '@/core/store';
import { NewChatButton } from './NewChatButton';
import { ChatMenuButton } from './ChatMenuButton';
import { ShareConversationModal } from './ShareConversationModal';
import { ShareFolderModal } from '@/components/folders/ShareFolderModal';
import { ChatCreationProvider } from '@/components/chat/ChatCreationProvider';

export const ChatHeader: React.FC = () => {
  const { chat_id, viewMode, selectedFolderId } = useChatStore();
  const { folderId: urlFolderId } = useParams<{ folderId?: string }>();
  const [showShareModal, setShowShareModal] = useState(false);
  const [showFolderShareModal, setShowFolderShareModal] = useState(false);
  
  return (
    <>
      <ChatCreationProvider>
        <div className="flex items-center justify-between px-4 py-3 bg-white">
          <div className="max-w-3xl mx-auto w-full flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* New Chat Button */}
              <NewChatButton />
            </div>

            <div className="flex items-center gap-2">
              {/* Hide top-right share/menu when viewing a folder to avoid confusion */}
              {viewMode !== 'folder' && (
                <>
                  {/* Share Button - Chat only when not in folder view */}
                  <button
                    onClick={() => {
                      if (chat_id) {
                        setShowShareModal(true);
                      }
                    }}
                    disabled={!chat_id}
                    className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                      chat_id
                        ? 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                        : 'text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    <Share2 className="w-4 h-4" />
                  </button>

                  {/* 3 Dots Menu */}
                  <ChatMenuButton />
                </>
              )}
            </div>
          </div>
        </div>
      </ChatCreationProvider>

      {/* Share Modal */}
      {showShareModal && chat_id && (
        <ShareConversationModal
          conversationId={chat_id}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/* Folder Share Modal */}
      {showFolderShareModal && (selectedFolderId || urlFolderId) && (
        <ShareFolderModal
          folderId={selectedFolderId || urlFolderId || ''}
          onClose={() => setShowFolderShareModal(false)}
        />
      )}
    </>
  );
};