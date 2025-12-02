import React from 'react';
import { Sparkles, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from '@/components/ui/dropdown-menu';
import { ConversationActionsMenuContent } from '@/components/chat/ConversationActionsMenu';

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
  mode: string | null;
}

interface ConversationsSectionProps {
  conversations: Conversation[];
  folders: Array<{ id: string; name: string }>;
  currentFolderId: string;
  onChatClick: (conversation: Conversation) => void;
  onEditChat: (conversationId: string, currentTitle: string) => void;
  onDeleteChat: (conversationId: string) => void;
  onShareChat: (conversationId: string) => void;
  onMoveToFolder: (conversationId: string, targetFolderId: string | null) => void;
  onCreateFolder: (conversationId: string) => void;
}

export const ConversationsSection: React.FC<ConversationsSectionProps> = ({
  conversations,
  folders,
  currentFolderId,
  onChatClick,
  onEditChat,
  onDeleteChat,
  onShareChat,
  onMoveToFolder,
  onCreateFolder,
}) => {
  if (conversations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400 font-light text-center">
          <p>No conversations in this folder</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-4">
      <div className="w-full max-w-2xl mx-auto flex flex-col space-y-2">
        {conversations.map(conversation => (
          <div
            key={conversation.id}
            className="flex items-center justify-between gap-4 py-3 px-4 rounded-2xl hover:bg-gray-50 transition-colors group"
          >
            <div
              className="flex-1 min-w-0 cursor-pointer flex items-center gap-2"
              onClick={() => onChatClick(conversation)}
            >
              {conversation.mode === 'insight' && (
                <Sparkles className="w-4 h-4 text-gray-500 flex-shrink-0" />
              )}
              <div className="text-sm font-light text-gray-900 truncate">
                {conversation.title || 'New Chat'}
              </div>
              {conversation.mode === 'sync_score' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pink-100 text-pink-700 border border-pink-200 flex-shrink-0">
                  Sync
                </span>
              )}
            </div>

            {/* Three dots menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                  onClick={e => e.stopPropagation()}
                >
                  <MoreHorizontal className="w-4 h-4 text-gray-600" />
                </button>
              </DropdownMenuTrigger>
              <ConversationActionsMenuContent
                conversationId={conversation.id}
                currentTitle={conversation.title || ''}
                onEdit={onEditChat}
                onDelete={onDeleteChat}
                onShare={onShareChat}
                onMoveToFolder={onMoveToFolder}
                onCreateFolder={onCreateFolder}
                folders={folders}
                currentFolderId={currentFolderId}
                align="end"
              />
            </DropdownMenu>
          </div>
        ))}
      </div>
    </div>
  );
};
