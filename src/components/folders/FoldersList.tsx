import React, { useState } from 'react';
import { Folder, ChevronRight, ChevronDown, MessageSquare, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConversationActionsMenuContent } from '@/components/chat/ConversationActionsMenu';

interface FolderItem {
  id: string;
  name: string;
  chatsCount: number;
  chats: Array<{
    id: string;
    title: string;
  }>;
  isTemp?: boolean;
}

interface FoldersListProps {
  folders: FolderItem[];
  onFolderClick?: (folderId: string) => void;
  onChatClick: (folderId: string, chatId: string) => void;
  onEditFolder?: (folderId: string, currentName: string) => void;
  onDeleteFolder?: (folderId: string) => void;
  onEditChat?: (conversationId: string, currentTitle: string) => void;
  onDeleteChat?: (conversationId: string) => void;
  onMoveToFolder?: (conversationId: string, folderId: string | null) => void;
  onCreateFolder?: (conversationId: string) => void;
  allFolders?: Array<{ id: string; name: string }>;
  activeChatId?: string;
}

export const FoldersList: React.FC<FoldersListProps> = ({
  folders,
  onFolderClick,
  onChatClick,
  onEditFolder,
  onDeleteFolder,
  onEditChat,
  onDeleteChat,
  onMoveToFolder,
  onCreateFolder,
  allFolders = [],
  activeChatId,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  if (folders.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1">
      {folders.map((folder) => {
        const isExpanded = expandedFolders.has(folder.id);
        
        return (
          <div key={folder.id} className="space-y-0.5">
            {/* Folder Header */}
            <div className="flex items-center gap-1 group">
              <button
                onClick={(e) => {
                  // If onFolderClick is provided, call it instead of toggling
                  if (onFolderClick) {
                    onFolderClick(folder.id);
                  } else {
                    toggleFolder(folder.id);
                  }
                }}
                className="flex-1 flex items-center gap-2 px-3 py-1.5 text-sm text-black hover:bg-gray-100 rounded-lg transition-colors font-light"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3 text-gray-500" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-gray-500" />
                )}
                <Folder className="w-4 h-4 text-gray-600" />
                <span className="flex-1 text-left">
                  {folder.name}
                  {folder.isTemp && (
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600 border border-gray-300">
                      temp
                    </span>
                  )}
                </span>
                <span className="text-xs text-gray-500">({folder.chatsCount})</span>
              </button>

              {/* Folder Actions Menu - only show for authenticated users */}
              {(onEditFolder || onDeleteFolder) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-all">
                      <MoreHorizontal className="w-4 h-4 text-gray-600" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {onEditFolder && (
                      <DropdownMenuItem onClick={() => onEditFolder(folder.id, folder.name)}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Rename
                      </DropdownMenuItem>
                    )}
                    {onDeleteFolder && (
                      <DropdownMenuItem 
                        onClick={() => onDeleteFolder(folder.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Expanded Chats */}
            {isExpanded && folder.chats.length > 0 && (
              <div className="ml-6 space-y-0.5">
                {folder.chats.map((chat) => {
                  const isActive = chat.id === activeChatId;
                  
                  return (
                    <div
                      key={chat.id}
                      className="relative group"
                    >
                      <div className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                        isActive 
                          ? 'bg-gray-100' 
                          : 'hover:bg-gray-100'
                      }`}>
                        <div 
                          className="flex-1 min-w-0 cursor-pointer flex items-center gap-2"
                          onClick={() => onChatClick(folder.id, chat.id)}
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-gray-500" />
                          <span className="text-sm font-medium text-gray-900 truncate">{chat.title}</span>
                        </div>
                        
                        {/* Three dots menu - only show if any actions are available */}
                        {(onEditChat || onDeleteChat || onMoveToFolder || onCreateFolder) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1 hover:bg-gray-200 rounded transition-colors">
                                <MoreHorizontal className="w-4 h-4 text-gray-600" />
                              </button>
                            </DropdownMenuTrigger>
                            <ConversationActionsMenuContent
                              conversationId={chat.id}
                              currentTitle={chat.title}
                              onEdit={onEditChat}
                              onDelete={onDeleteChat}
                              onMoveToFolder={onMoveToFolder}
                              onCreateFolder={onCreateFolder}
                              folders={allFolders}
                              currentFolderId={folder.id}
                              align="end"
                            />
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty folder state */}
            {isExpanded && folder.chats.length === 0 && (
              <div className="ml-6 px-3 py-2 text-xs text-gray-400">
                No chats in this folder
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

