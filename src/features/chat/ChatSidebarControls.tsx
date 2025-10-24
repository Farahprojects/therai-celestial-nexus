import React from 'react';
import { ChatThreadsSidebar } from './ChatThreadsSidebar';

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
    <div className="w-full h-full flex flex-col">
      {/* Chat Threads */}
      <ChatThreadsSidebar 
        className="h-full" 
        onDelete={onDelete} 
        onCloseMobileSidebar={onCloseMobileSidebar}
        conversationType={conversationType}
      />
    </div>
  );
};


