import React from 'react';
import { MessageCircle, Blend, SquarePen } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useChatCreation } from '@/components/chat/ChatCreationProvider';

interface NewChatButtonProps {
  className?: string;
  isFolderView?: boolean; // Show "Folder" text only in folder view
}

export const NewChatButton: React.FC<NewChatButtonProps> = ({ className = "", isFolderView = false }) => {
  const {
    startChat,
    startTogetherMode,
  } = useChatCreation();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {isFolderView ? (
            <button className={`flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors ${className}`}>
              Folder
            </button>
          ) : (
            <button className={`flex items-center justify-center p-2 text-black hover:bg-gray-100 rounded-lg transition-colors ${className}`}>
              <SquarePen className="w-5 h-5" />
            </button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem
            onClick={() => { void startChat(); }}
            className="cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              <span>Chat</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => { void startTogetherMode(); }}
            className="cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Blend className="w-4 h-4" />
              <span>Together Mode</span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};
