import React, { useEffect, useState } from 'react';
import { getFolderConversations, getUserFolders, getSharedFolder, moveConversationToFolder, getFolderWithProfile } from '@/services/folders';
import { MoreHorizontal, Folder, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '@/core/store';
import { useAuth } from '@/contexts/AuthContext';
import { updateConversationTitle, createConversation } from '@/services/conversations';
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConversationActionsMenuContent } from '@/components/chat/ConversationActionsMenu';
import { FolderModal } from './FolderModal';
import { FolderAddMenu } from './FolderAddMenu';
import { FolderExportMenu } from './FolderExportMenu';
import { JournalEntryModal } from './JournalEntryModal';
import { DocumentUploadModal } from './DocumentUploadModal';
import { FolderProfileSetup } from './FolderProfileSetup';
import { InsightsModal } from '@/components/insights/InsightsModal';
import { createFolder } from '@/services/folders';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface FolderViewProps {
  folderId: string;
  onChatClick: (chatId: string) => void;
}

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
  mode: string | null;
}

export const FolderView: React.FC<FolderViewProps> = ({ folderId, onChatClick }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [folderName, setFolderName] = useState<string>('');
  const [folderProfileId, setFolderProfileId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [folders, setFolders] = useState<Array<{ id: string; name: string }>>([]);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [conversationToMoveToNewFolder, setConversationToMoveToNewFolder] = useState<string | null>(null);
  
  // New modal states
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showInsightsModal, setShowInsightsModal] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setViewMode, startConversation, threads, removeThread, clearChat } = useChatStore();

  useEffect(() => {
    const loadFolderData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Try to load folder - works for authenticated users
        if (user?.id) {
          try {
            const [folderWithProfile, userFolders, conversationsData] = await Promise.all([
              getFolderWithProfile(folderId),
              getUserFolders(user.id),
              getFolderConversations(folderId)
            ]);

            const folder = userFolders.find(f => f.id === folderId);
            if (folder) {
              setFolderName(folderWithProfile.folder.name);
              setFolderProfileId(folderWithProfile.folder.profile_id || null);
              setConversations(conversationsData);
              setIsLoading(false);
              
              // Also load all folders for move to folder menu
              setFolders(userFolders.map(f => ({ id: f.id, name: f.name })));
              return;
            }
          } catch (err) {
            console.error('[FolderView] Failed to load from user folders:', err);
            // Fall through to try as shared folder
          }
        }

        // Try loading as shared/public folder (for non-owners or unauthenticated)
        const sharedFolder = await getSharedFolder(folderId);
        if (sharedFolder) {
          // If folder is public, anyone can view it
          if (sharedFolder.is_public) {
            const conversationsData = await getFolderConversations(folderId);
            setFolderName(sharedFolder.name);
            setFolderProfileId(sharedFolder.profile_id || null);
            setConversations(conversationsData);
            setIsLoading(false);
            return;
          }
          
          // Private folder - requires authentication
          if (!user?.id) {
            setError('Please sign in to view this folder');
            setIsLoading(false);
            return;
          }
        }

        // If we get here, folder not found or not accessible
        setError('Folder not found or not accessible');
      } catch (err) {
        console.error('[FolderView] Failed to load folder data:', err);
        setError('Failed to load folder');
      } finally {
        setIsLoading(false);
      }
    };

    loadFolderData();
  }, [folderId, user?.id]);

  const handleChatClick = (conversation: Conversation) => {
    // Switch to chat view
    setViewMode('chat');
    
    // Handle swiss conversations differently
    if (conversation.mode === 'swiss') {
      navigate(`/astro?chat_id=${conversation.id}`, { replace: true });
      return;
    }
    
    // For regular conversations, use standard navigation
    startConversation(conversation.id);
    onChatClick(conversation.id);
  };

  // Conversation action handlers
  const handleEditChat = (conversationId: string, currentTitle: string) => {
    setEditingConversationId(conversationId);
    setEditTitle(currentTitle);
    setShowEditDialog(true);
  };

  const handleSaveTitle = async () => {
    if (!editingConversationId || !editTitle.trim() || isSaving) return;

    setIsSaving(true);
    try {
      await updateConversationTitle(editingConversationId, editTitle.trim());
      
      // Update local state
      const updatedThreads = threads.map(t => 
        t.id === editingConversationId ? { ...t, title: editTitle.trim() } : t
      );
      useChatStore.setState({ threads: updatedThreads });
      
      // Update conversations list in folder view
      setConversations(prev => prev.map(c => 
        c.id === editingConversationId ? { ...c, title: editTitle.trim() } : c
      ));
      
      setShowEditDialog(false);
      setEditingConversationId(null);
    } catch (error) {
      console.error('[FolderView] Failed to update title:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteChat = (conversationId: string) => {
    setEditingConversationId(conversationId);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!editingConversationId || !user) return;

    setIsDeleting(true);

    try {
      // Delete messages
      const { supabase } = await import('@/integrations/supabase/client');
      await supabase
        .from('messages')
        .delete()
        .eq('chat_id' as never, editingConversationId);

      // Delete conversation
      await supabase
        .from('conversations')
        .delete()
        .eq('id' as never, editingConversationId)
        .eq('user_id' as never, user.id);

      // Update local state
      removeThread(editingConversationId);
      
      // Update conversations list in folder view
      setConversations(prev => prev.filter(c => c.id !== editingConversationId));
      
      setShowDeleteDialog(false);
      setIsDeleting(false);
      setEditingConversationId(null);
      
      // If this was the current chat, clear the session
      const { chat_id } = useChatStore.getState();
      if (chat_id === editingConversationId) {
        clearChat();
        navigate('/therai', { replace: true });
      }
    } catch (error) {
      console.error('[FolderView] Error deleting conversation:', error);
      setIsDeleting(false);
    }
  };

  const handleMoveToFolder = async (conversationId: string, targetFolderId: string | null) => {
    if (!user?.id) return;
    
    try {
      await moveConversationToFolder(conversationId, targetFolderId);
      
      // Update local state
      const updatedThreads = threads.map(t => 
        t.id === conversationId ? { ...t, folder_id: targetFolderId } : t
      );
      useChatStore.setState({ threads: updatedThreads });

      // Remove from current folder view if moving to another folder
      if (targetFolderId !== folderId) {
        setConversations(prev => prev.filter(c => c.id !== conversationId));
      }

      // Reload folders
      const userFolders = await getUserFolders(user.id);
      setFolders(userFolders.map(f => ({ id: f.id, name: f.name })));
    } catch (error) {
      console.error('[FolderView] Failed to move conversation to folder:', error);
    }
  };

  const handleCreateFolder = async (name: string) => {
    if (!user?.id) return;
    
    try {
      const newFolder = await createFolder(user.id, name);
      
      // If there's a conversation waiting to be moved, move it now
      if (conversationToMoveToNewFolder) {
        await moveConversationToFolder(conversationToMoveToNewFolder, newFolder.id);
        setConversationToMoveToNewFolder(null);
        
        // Remove from current folder view
        setConversations(prev => prev.filter(c => c.id !== conversationToMoveToNewFolder));
      }
      
      // Reload folders
      const userFolders = await getUserFolders(user.id);
      setFolders(userFolders.map(f => ({ id: f.id, name: f.name })));
    } catch (error) {
      console.error('[FolderView] Failed to create folder:', error);
    }
  };

  const handleCreateFolderAndMove = (conversationId: string) => {
    setConversationToMoveToNewFolder(conversationId);
    setShowFolderModal(true);
  };

  // New handler functions
  const handleNewChat = async () => {
    if (!user?.id) return;
    
    try {
      const newChatId = await createConversation(user.id, 'chat', 'New Chat');
      
      // Move the conversation to this folder
      await moveConversationToFolder(newChatId, folderId);
      
      // Navigate to the new chat
      setViewMode('chat');
      startConversation(newChatId);
      onChatClick(newChatId);
    } catch (error) {
      console.error('[FolderView] Failed to create new chat:', error);
    }
  };

  const handleProfileLinked = async () => {
    // Reload folder data to get the updated profile_id
    try {
      const folderWithProfile = await getFolderWithProfile(folderId);
      setFolderProfileId(folderWithProfile.folder.profile_id || null);
    } catch (error) {
      console.error('[FolderView] Failed to reload folder profile:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500 font-light">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-red-500 font-light">{error}</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Folder Name and Action Buttons */}
      <div className="px-6 py-4">
        <div className="w-full max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-lg font-light text-gray-900">
            <Folder className="w-5 h-5 text-gray-900" />
            <span>{folderName}</span>
          </div>
          {user && (
            <div className="flex items-center gap-2">
              {/* Help Icon */}
              <button
                onClick={() => setShowHelpDialog(true)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                title="Help"
              >
                <HelpCircle className="w-4 h-4 text-gray-500" />
              </button>
              
              {/* Export Menu */}
              <FolderExportMenu folderId={folderId} folderName={folderName} />
              
              {/* Add Menu */}
              <FolderAddMenu
                onJournalClick={() => setShowJournalModal(true)}
                onInsightsClick={() => setShowInsightsModal(true)}
                onUploadClick={() => setShowUploadModal(true)}
                onNewChatClick={handleNewChat}
              />
            </div>
          )}
        </div>
      </div>

      {/* Profile Setup Banner (shown when no profile is linked) */}
      {user && !folderProfileId && (
        <div className="px-6">
          <FolderProfileSetup
            folderId={folderId}
            folderName={folderName}
            onProfileLinked={handleProfileLinked}
          />
        </div>
      )}

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-400 font-light text-center">
              <p>No conversations in this folder</p>
            </div>
          </div>
        ) : (
          <div className="px-6 py-4">
            <div className="w-full max-w-2xl mx-auto flex flex-col space-y-2">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className="flex items-center justify-between gap-4 py-3 px-4 rounded-2xl hover:bg-gray-50 transition-colors group"
                >
                  <div 
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => handleChatClick(conversation)}
                  >
                    <div className="text-sm font-light text-gray-900 truncate">
                      {conversation.title || 'New Chat'}
                    </div>
                  </div>
                  
                  {/* Three dots menu */}
                  {user && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button 
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="w-4 h-4 text-gray-600" />
                        </button>
                      </DropdownMenuTrigger>
                      <ConversationActionsMenuContent
                        conversationId={conversation.id}
                        currentTitle={conversation.title || ''}
                        onEdit={handleEditChat}
                        onDelete={handleDeleteChat}
                        onMoveToFolder={handleMoveToFolder}
                        onCreateFolder={handleCreateFolderAndMove}
                        folders={folders}
                        currentFolderId={folderId}
                        align="end"
                      />
                    </DropdownMenu>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Edit Title Dialog */}
      {showEditDialog && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-6 bg-black/10 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Title</h3>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSaveTitle();
                } else if (e.key === 'Escape') {
                  setShowEditDialog(false);
                  setEditingConversationId(null);
                }
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 mb-4"
              placeholder="Enter title"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowEditDialog(false);
                  setEditingConversationId(null);
                }}
                disabled={isSaving}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTitle}
                disabled={isSaving}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-6 bg-black/10 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Delete Chat</h3>
            <p className="text-gray-600 mb-4">Are you sure you want to delete this chat? This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowDeleteDialog(false);
                  setEditingConversationId(null);
                }}
                disabled={isDeleting}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Folder Modal for Create New Folder */}
      {showFolderModal && (
        <FolderModal
          isOpen={showFolderModal}
          onClose={() => {
            setShowFolderModal(false);
            setConversationToMoveToNewFolder(null);
          }}
          onCreateFolder={handleCreateFolder}
          editingFolder={null}
        />
      )}

      {/* Journal Entry Modal */}
      {user && (
        <JournalEntryModal
          isOpen={showJournalModal}
          onClose={() => setShowJournalModal(false)}
          folderId={folderId}
          userId={user.id}
        />
      )}

      {/* Document Upload Modal */}
      {user && (
        <DocumentUploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          folderId={folderId}
          userId={user.id}
        />
      )}

      {/* Insights Modal */}
      <InsightsModal
        isOpen={showInsightsModal}
        onClose={() => setShowInsightsModal(false)}
      />

      {/* Help Dialog */}
      <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-light">Folder Features</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 text-sm font-light text-gray-700">
            <div>
              <h4 className="font-normal text-gray-900 mb-1">Journal Entries</h4>
              <p>Quick notes and reflections saved to this folder. Use the mic button for voice-to-text.</p>
            </div>
            <div>
              <h4 className="font-normal text-gray-900 mb-1">Generate Insights</h4>
              <p>AI analysis of all content in this folder including chats, journals, and documents.</p>
            </div>
            <div>
              <h4 className="font-normal text-gray-900 mb-1">Upload Documents</h4>
              <p>Add PDF, DOCX, TXT, MD, or CSV files to analyze alongside your conversations.</p>
            </div>
            <div>
              <h4 className="font-normal text-gray-900 mb-1">New Chat</h4>
              <p>Start a conversation that's automatically organized in this folder.</p>
            </div>
            <div>
              <h4 className="font-normal text-gray-900 mb-1">Export Data</h4>
              <p>Download your journals, chats, or all folder content as JSON files.</p>
            </div>
            <div>
              <h4 className="font-normal text-gray-900 mb-1">Folder Profile</h4>
              <p>Link an astro profile to enable personalized insights for this folder's content.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

