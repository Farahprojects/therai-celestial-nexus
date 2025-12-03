import React, { useState, useEffect } from 'react';
import { MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConversationActionsMenuContent } from './ConversationActionsMenu';
import { ShareConversationModal } from './ShareConversationModal';
import { useChatStore } from '@/core/store';
import { updateConversationTitle } from '@/services/conversations';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { getUserFolders, moveConversationToFolder, createFolder } from '@/services/folders';
import { FolderModal } from '@/components/folders/FolderModal';
import type { Tables } from '@/integrations/supabase/types';

type MessageRow = Tables<'messages'>;
type ConversationRow = Tables<'conversations'>;

interface ChatMenuButtonProps {
  className?: string;
  onEditStart?: () => void;
  onDeleteStart?: () => void;
  mode?: 'chat' | 'swiss';
}

export const ChatMenuButton: React.FC<ChatMenuButtonProps> = ({ 
  className = "",
  onEditStart,
  onDeleteStart,
  mode 
}) => {
  const { chat_id, threads, removeThread, clearChat } = useChatStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [folders, setFolders] = useState<Array<{ id: string; name: string }>>([]);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [conversationToMoveToNewFolder, setConversationToMoveToNewFolder] = useState<string | null>(null);
  const [shareConversationId, setShareConversationId] = useState<string | null>(null);

  // Get current conversation title and folder
  const currentConversation = threads.find(t => t.id === chat_id);
  const currentTitle = currentConversation?.title || '';
  const currentFolderId = currentConversation?.folder_id || null;
  
  // Detect mode from URL if not explicitly provided
  const detectedMode = mode || (location.pathname.startsWith('/swiss') ? 'swiss' : 'chat');

  // Load folders on mount
  useEffect(() => {
    if (!user?.id) return;
    
    const loadFolders = async () => {
      try {
        const userFolders = await getUserFolders(user.id);
        setFolders(userFolders.map(f => ({ id: f.id, name: f.name })));
      } catch (error) {
        console.error('[ChatMenuButton] Failed to load folders:', error);
      }
    };
    
    loadFolders();
  }, [user?.id]);

  const handleEdit = async (conversationId: string, title: string) => {
    setEditTitle(title);
    setShowEditDialog(true);
    if (onEditStart) onEditStart();
  };

  const handleDelete = async () => {
    setShowDeleteDialog(true);
    if (onDeleteStart) onDeleteStart();
  };

  const confirmEdit = async () => {
    if (!chat_id || !editTitle.trim() || !user?.id) return;

    try {
      await updateConversationTitle(chat_id, editTitle, user.id);
      
      // Update local state
      const updatedThreads = threads.map(t => 
        t.id === chat_id ? { ...t, title: editTitle } : t
      );
      useChatStore.setState({ threads: updatedThreads });
      
      setShowEditDialog(false);
    } catch (error) {
      console.error('[ChatMenuButton] Error updating title:', error);
    }
  };

  const confirmDelete = async () => {
    if (!chat_id || !user) return;

    setIsDeleting(true);

    try {
      // Delete messages
      await supabase
        .from('messages')
        .delete()
        .eq('chat_id' as never, chat_id as MessageRow['chat_id']);

      // Delete conversation
      await supabase
        .from('conversations')
        .delete()
        .eq('id' as never, chat_id as ConversationRow['id'])
        .eq('user_id' as never, user.id as ConversationRow['user_id']);

      // Update local state
      removeThread(chat_id, user.id);
      clearChat();
      
      setShowDeleteDialog(false);
      setIsDeleting(false);
      navigate('/therai', { replace: true });
    } catch (error) {
      console.error('[ChatMenuButton] Error deleting conversation:', error);
      setIsDeleting(false);
    }
  };

  const handleMoveToFolder = async (conversationId: string, folderId: string | null) => {
    if (!user?.id || !conversationId) return;
    
    try {
      await moveConversationToFolder(conversationId, folderId);
      
      // Update local state
      const updatedThreads = threads.map(t => 
        t.id === conversationId ? { ...t, folder_id: folderId } : t
      );
      useChatStore.setState({ threads: updatedThreads });

      // Reload folders to update counts
      const userFolders = await getUserFolders(user.id);
      setFolders(userFolders.map(f => ({ id: f.id, name: f.name })));
    } catch (error) {
      console.error('[ChatMenuButton] Failed to move conversation to folder:', error);
    }
  };

  const handleCreateFolderAndMove = (conversationId: string) => {
    setConversationToMoveToNewFolder(conversationId);
    setShowFolderModal(true);
  };

  const handleCreateFolder = async (name: string) => {
    if (!user?.id || !name?.trim()) return;
    
    try {
      // Create new folder
      const newFolder = await createFolder(user.id, name);
      
      // If there's a conversation waiting to be moved, move it now
      if (conversationToMoveToNewFolder) {
        await moveConversationToFolder(conversationToMoveToNewFolder, newFolder.id);
        setConversationToMoveToNewFolder(null);
        
        // Update local state
        const updatedThreads = threads.map(t => 
          t.id === conversationToMoveToNewFolder ? { ...t, folder_id: newFolder.id } : t
        );
        useChatStore.setState({ threads: updatedThreads });
      }
      
      // Reload folders to update counts
      const userFolders = await getUserFolders(user.id);
      setFolders(userFolders.map(f => ({ id: f.id, name: f.name })));
    } catch (error) {
      console.error('[ChatMenuButton] Failed to create folder:', error);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={`flex items-center justify-center w-8 h-8 text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors ${className}`}>
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
        
        <ConversationActionsMenuContent
          align="end"
          conversationId={chat_id || ''}
          currentTitle={currentTitle}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onShare={(id) => setShareConversationId(id)}
          onMoveToFolder={handleMoveToFolder}
          onCreateFolder={handleCreateFolderAndMove}
          folders={folders}
          currentFolderId={currentFolderId}
          mode={detectedMode}
        />
      </DropdownMenu>

      {/* Edit Title Dialog */}
      {showEditDialog && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-xl font-light text-gray-900">Edit Title</h3>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="Conversation title"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowEditDialog(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmEdit}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-xl font-light text-gray-900">Delete</h3>
            <p className="text-sm text-gray-600">
              Are you sure you want to delete this conversation? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteDialog(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isDeleting && (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Folder Creation Modal */}
      <FolderModal
        isOpen={showFolderModal}
        onClose={() => {
          setShowFolderModal(false);
          setConversationToMoveToNewFolder(null);
        }}
        onCreateFolder={handleCreateFolder}
        editingFolder={null}
      />

      {shareConversationId && (
        <ShareConversationModal
          conversationId={shareConversationId}
          onClose={() => setShareConversationId(null)}
        />
      )}
    </>
  );
};
export default ChatMenuButton;

