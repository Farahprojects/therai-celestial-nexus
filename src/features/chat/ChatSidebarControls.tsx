import React from 'react';
import { ChatThreadsSidebar } from './ChatThreadsSidebar';
import Logo from '@/components/Logo';
import { ChatCreationProvider } from '@/components/chat/ChatCreationProvider';

interface ChatSidebarControlsProps {
  className?: string;
  onDelete?: () => void;
  onCloseMobileSidebar?: () => void;
  conversationType?: 'chat' | 'swiss'; // Filter conversations by type
}

export const ChatSidebarControls: React.FC<ChatSidebarControlsProps> = ({ 
  onDelete, 
  onCloseMobileSidebar,
  conversationType = 'chat' // Default to chat
}) => {
  return (
    <ChatCreationProvider onConversationReady={onCloseMobileSidebar}>
      <div className="w-full h-full flex flex-col">
        {/* Logo at the top */}
        <div className="px-4 py-4">
          <Logo className="h-8" />
        </div>

        {/* Chat Threads */}
        <ChatThreadsSidebar
          className="flex-1 min-h-0"
          onDelete={onDelete}
          onCloseMobileSidebar={onCloseMobileSidebar}
          conversationType={conversationType}
        />
      </div>
    </ChatCreationProvider>
  );
};


