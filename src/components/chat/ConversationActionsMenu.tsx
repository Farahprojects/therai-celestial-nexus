import React from 'react';
import { Sparkles, Edit3, Trash2, FolderInput, X, Folder, Share2 } from 'lucide-react';
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useChatStore } from '@/core/store';
import { useReportModal } from '@/contexts/ReportModalContext';

interface Folder {
  id: string;
  name: string;
}

interface ConversationActionsMenuProps {
  conversationId?: string; // Optional - if not provided, uses current chat_id
  onEdit?: (conversationId: string, currentTitle: string) => void;
  onDelete?: (conversationId: string) => void;
  onShare?: (conversationId: string) => void;
  onMoveToFolder?: (conversationId: string, folderId: string | null) => void;
  onCreateFolder?: (conversationId: string) => void;
  folders?: Folder[];
  currentFolderId?: string | null;
  align?: 'start' | 'end' | 'center';
  currentTitle?: string;
  mode?: 'chat' | 'swiss'; // Mode to determine menu labels
}

export const ConversationActionsMenuContent: React.FC<ConversationActionsMenuProps> = ({
  conversationId,
  onEdit,
  onDelete,
  onShare,
  onMoveToFolder,
  onCreateFolder,
  folders = [],
  currentFolderId,
  align = 'end',
  currentTitle = '',
  mode = 'chat',
}) => {
  const { chat_id } = useChatStore();
  const { open: openReportModal } = useReportModal();
  
  // Use provided conversationId or fall back to current chat_id
  const targetConversationId = conversationId || chat_id;
  
  // Determine menu label based on mode
  const astroLabel = mode === 'swiss' ? 'Generate Astro Data' : 'Astro';

  const handleAstroClick = () => {
    if (targetConversationId) {
      openReportModal(targetConversationId);
    }
  };

  const handleEditClick = () => {
    if (onEdit && targetConversationId) {
      onEdit(targetConversationId, currentTitle);
    }
  };

  const handleDeleteClick = () => {
    if (onDelete && targetConversationId) {
      onDelete(targetConversationId);
    }
  };

  const handleMoveToFolder = (folderId: string | null) => {
    if (onMoveToFolder && targetConversationId) {
      onMoveToFolder(targetConversationId, folderId);
    }
  };

  const handleCreateFolder = () => {
    if (onCreateFolder && targetConversationId) {
      onCreateFolder(targetConversationId);
    }
  };

  const handleShareClick = () => {
    if (onShare && targetConversationId) {
      onShare(targetConversationId);
    }
  };

  return (
    <DropdownMenuContent align={align} className="bg-white border border-gray-200 shadow-lg min-w-fit rounded-lg p-1">
      <DropdownMenuItem
        onClick={handleAstroClick}
        className="px-3 py-1.5 text-sm text-black hover:bg-gray-100 hover:text-black focus:bg-gray-100 focus:text-black cursor-pointer rounded-full"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          <span>{astroLabel}</span>
        </div>
      </DropdownMenuItem>
        
        {onEdit && (
          <DropdownMenuItem
            onClick={handleEditClick}
            className="px-3 py-1.5 text-sm text-black hover:bg-gray-100 hover:text-black focus:bg-gray-100 focus:text-black cursor-pointer rounded-full"
          >
            <div className="flex items-center gap-2">
              <Edit3 className="w-4 h-4" />
              <span>Edit</span>
            </div>
          </DropdownMenuItem>
        )}
        
        {onShare && (
          <DropdownMenuItem
            onClick={handleShareClick}
            className="px-3 py-1.5 text-sm text-black hover:bg-gray-100 hover:text-black focus:bg-gray-100 focus:text-black cursor-pointer rounded-full"
          >
            <div className="flex items-center gap-2">
              <Share2 className="w-4 h-4" />
              <span>Share</span>
            </div>
          </DropdownMenuItem>
        )}
        
        {onMoveToFolder && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="px-3 py-1.5 text-sm text-black hover:bg-gray-100 hover:text-black focus:bg-gray-100 focus:text-black cursor-pointer rounded-full">
              <div className="flex items-center gap-2">
                <FolderInput className="w-4 h-4" />
                <span>Move to Folder</span>
              </div>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="bg-white border border-gray-200 shadow-lg rounded-lg p-1">
              {onCreateFolder && (
                <DropdownMenuItem
                  onClick={handleCreateFolder}
                  className="px-3 py-1.5 text-sm text-black hover:bg-gray-100 hover:text-black focus:bg-gray-100 focus:text-black cursor-pointer rounded-full"
                >
                  <div className="flex items-center gap-2">
                    <Folder className="w-4 h-4" />
                    <span>New Folder</span>
                  </div>
                </DropdownMenuItem>
              )}
              
              {onCreateFolder && folders.length > 0 && (
                <DropdownMenuSeparator className="my-1" />
              )}
              
              {currentFolderId && (
                <DropdownMenuItem
                  onClick={() => handleMoveToFolder(null)}
                  className="px-3 py-1.5 text-sm text-black hover:bg-gray-100 hover:text-black focus:bg-gray-100 focus:text-black cursor-pointer rounded-full"
                >
                  <div className="flex items-center gap-2">
                    <X className="w-4 h-4" />
                    <span>Remove from folder</span>
                  </div>
                </DropdownMenuItem>
              )}
              {folders.map((folder) => (
                <DropdownMenuItem
                  key={folder.id}
                  onClick={() => handleMoveToFolder(folder.id)}
                  className="px-3 py-1.5 text-sm text-black hover:bg-gray-100 hover:text-black focus:bg-gray-100 focus:text-black cursor-pointer rounded-full"
                  disabled={folder.id === currentFolderId}
                >
                  <span className={folder.id === currentFolderId ? 'font-medium' : ''}>
                    {folder.name}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        
        {onDelete && (
          <DropdownMenuItem
            onClick={handleDeleteClick}
            className="px-3 py-1.5 text-sm text-black hover:bg-red-50 hover:text-red-600 focus:bg-red-50 focus:text-red-600 cursor-pointer rounded-full"
          >
            <div className="flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </div>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
  );
};

