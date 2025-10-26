import React from 'react';
import { MessageCircle, Orbit, Sparkles } from 'lucide-react';
import { useChatStore } from '@/core/store';
import { NewChatButton } from './NewChatButton';
import { ChatMenuButton } from './ChatMenuButton';

export const ChatHeader: React.FC = () => {
  const { chat_id, threads } = useChatStore();
  
  // Get current conversation details
  const currentConversation = threads.find(t => t.id === chat_id);
  const mode = currentConversation?.mode;
  const title = currentConversation?.title || 'New Chat';
  
  // Get appropriate icon based on mode
  const getIcon = () => {
    if (mode === 'insight') return <Sparkles className="w-4 h-4 text-gray-600" />;
    if (mode === 'astro') return <Orbit className="w-4 h-4 text-gray-600" />;
    return <MessageCircle className="w-4 h-4 text-gray-600" />;
  };
  
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Sexy New Chat Button */}
        <NewChatButton />
        
        {/* Conversation title with icon */}
        {chat_id && (
          <div className="flex items-center gap-2 min-w-0">
            {getIcon()}
            <span className="text-sm font-medium text-gray-900 truncate">
              {title}
            </span>
          </div>
        )}
      </div>

      {/* 3 Dots Menu - now uses the same component as sidebar threads */}
      <ChatMenuButton />
    </div>
  );
};