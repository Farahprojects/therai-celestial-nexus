import React from 'react';
import { SquarePen, ChevronDown, MessageCircle, Orbit } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useChatCreation } from '@/components/chat/ChatCreationProvider';

interface NewChatDropdownProps {
  className?: string;
}

export const NewChatDropdown: React.FC<NewChatDropdownProps> = ({ className = "" }) => {
  const { startChat, openAstroFlow } = useChatCreation();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={`flex items-center gap-2 px-3 py-1.5 text-sm font-light text-black hover:bg-gray-100 rounded-lg transition-colors justify-start ${className}`}>
            <SquarePen className="w-4 h-4" />
            New Chat
            <ChevronDown className="w-3 h-3" />
          </button>
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
          <DropdownMenuItem
            onClick={openAstroFlow}
            className="cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Orbit className="w-4 h-4" />
              <span>Astro</span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};
