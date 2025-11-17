import React from 'react';
import { Plus, FileText, Sparkles, Upload, MessageCircle, Heart } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

interface FolderAddMenuProps {
  onJournalClick: () => void;
  onInsightsClick: () => void;
  onUploadClick: () => void;
  onNewChatClick: () => void;
  onCompatibilityClick: () => void;
}

export const FolderAddMenu: React.FC<FolderAddMenuProps> = ({
  onJournalClick,
  onInsightsClick,
  onUploadClick,
  onNewChatClick,
  onCompatibilityClick,
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full font-light"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem
          onClick={onJournalClick}
          className="cursor-pointer font-light"
        >
          <FileText className="w-4 h-4 mr-3 text-gray-600" />
          <div className="flex flex-col">
            <span className="text-sm">Journal Entry</span>
            <span className="text-xs text-gray-500">Quick note or reflection</span>
          </div>
        </DropdownMenuItem>
        
        <DropdownMenuItem
          onClick={onInsightsClick}
          className="cursor-pointer font-light"
        >
          <Sparkles className="w-4 h-4 mr-3 text-gray-600" />
          <div className="flex flex-col">
            <span className="text-sm">Generate Insights</span>
            <span className="text-xs text-gray-500">AI analysis of folder content</span>
          </div>
        </DropdownMenuItem>
        
        <DropdownMenuItem
          onClick={onUploadClick}
          className="cursor-pointer font-light"
        >
          <Upload className="w-4 h-4 mr-3 text-gray-600" />
          <div className="flex flex-col">
            <span className="text-sm">Upload Document</span>
            <span className="text-xs text-gray-500">PDF, DOCX, TXT, MD, CSV</span>
          </div>
        </DropdownMenuItem>
        
        <DropdownMenuItem
          onClick={onNewChatClick}
          className="cursor-pointer font-light"
        >
          <MessageCircle className="w-4 h-4 mr-3 text-gray-600" />
          <div className="flex flex-col">
            <span className="text-sm">New Chat</span>
            <span className="text-xs text-gray-500">Start a conversation</span>
          </div>
        </DropdownMenuItem>
        
        <DropdownMenuItem
          onClick={onCompatibilityClick}
          className="cursor-pointer font-light"
        >
          <Heart className="w-4 h-4 mr-3 text-gray-600" />
          <div className="flex flex-col">
            <span className="text-sm">Compatibility</span>
            <span className="text-xs text-gray-500">Relationship analysis</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

