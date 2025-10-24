import React, { useState, useEffect } from 'react';
import { MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConversationActionsMenuContent } from './ConversationActionsMenu';
import { useChatStore } from '@/core/store';
import { updateConversationTitle } from '@/services/conversations';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { getUserFolders, getFolderConversations, moveConversationToFolder, createFolder } from '@/services/folders';
import { FolderModal } from '@/components/folders/FolderModal';

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
  const [editTitle, setEditTitle] = useState('');
  const [folders, setFolders] = useState<Array<{ id: string; name: string }>>([]);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [conversationToMoveToNewFolder, setConversationToMoveToNewFolder] = useState<string | null>(null);

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

  const handleDelete = async (conversationId: string) => {
    setShowDeleteDialog(true);
    if (onDeleteStart) onDeleteStart();
  };

  const confirmEdit = async () => {
    if (!chat_id || !editTitle.trim()) return;

    try {
      await updateConversationTitle(chat_id, editTitle);
      
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

    try {
      // Delete messages
      await supabase
        .from('messages')
        .delete()
        .eq('chat_id', chat_id);

      // Delete conversation
      await supabase
        .from('conversations')
        .delete()
        .eq('id', chat_id)
        .eq('user_id', user.id);

      // Update local state
      removeThread(chat_id);
      clearChat();
      
      setShowDeleteDialog(false);
      navigate('/therai', { replace: true });
    } catch (error) {
      console.error('[ChatMenuButton] Error deleting conversation:', error);
    }
  };

  const handleMoveToFolder = async (conversationId: string, folderId: string | null) => {
    if (!user?.id) return;
    
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
    if (!user?.id) return;
    
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
          conversationId={chat_id}
          currentTitle={currentTitle}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onMoveToFolder={handleMoveToFolder}
          onCreateFolder={handleCreateFolderAndMove}
          folders={folders}
          currentFolderId={currentFolderId}
          mode={detectedMode}
        />
      </DropdownMenu>

      {/* Edit Title Dialog */}
      {showEditDialog && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
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
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-xl font-light text-gray-900">Delete Conversation</h3>
            <p className="text-sm text-gray-600">
              Are you sure you want to delete this conversation? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
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
    </>
  );
};
export default ChatMenuButton;

