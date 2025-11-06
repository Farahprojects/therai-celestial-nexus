import React from 'react';
import { SquarePen, Sparkles, MessageCircle, Orbit, Blend } from 'lucide-react';
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
}

export const NewChatButton: React.FC<NewChatButtonProps> = ({ className = "" }) => {
  const {
    startChat,
    startTogetherMode,
    openAstroFlow,
    openInsightsFlow,
  } = useChatCreation();

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
            onClick={openAstroFlow}
            className="cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Orbit className="w-4 h-4" />
              <span>Astro</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={openInsightsFlow}
            className="cursor-pointer"
          >
            <div className="flex items-center justify-between w-full gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <span>Generate Insight</span>
              </div>
            </div>
          </DropdownMenuItem>
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
