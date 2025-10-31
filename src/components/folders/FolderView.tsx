import React, { useEffect, useState } from 'react';
import { getFolderConversations, getUserFolders, getSharedFolder } from '@/services/folders';
import { Plus, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '@/core/store';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { ShareFolderModal } from './ShareFolderModal';

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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setViewMode, startConversation } = useChatStore();

  useEffect(() => {
    const loadFolderData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // For authenticated users, try to load from their folders first
        // For unauthenticated users or if folder not found in user's folders, try shared folder
        if (user?.id) {
          try {
            const [folders, conversationsData] = await Promise.all([
              getUserFolders(user.id),
              getFolderConversations(folderId)
            ]);

            const folder = folders.find(f => f.id === folderId);
            if (folder) {
              setFolderName(folder.name);
              setConversations(conversationsData);
              setIsLoading(false);
              return;
            }
          } catch (err) {
            console.error('[FolderView] Failed to load from user folders:', err);
            // Fall through to try shared folder
          }
        }

        // Try loading as shared folder (works for both authenticated and unauthenticated)
        const sharedFolder = await getSharedFolder(folderId);
        if (sharedFolder) {
          // Check if it's a public folder or user is authenticated
          if (sharedFolder.share_mode === 'public' || user?.id) {
            const conversationsData = await getFolderConversations(folderId);
            setFolderName(sharedFolder.name);
            setConversations(conversationsData);
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
      {/* Folder Name and Add Button - Below Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="text-lg font-light text-gray-900">{folderName}</div>
        {/* Only show share/add buttons for authenticated users who own the folder */}
        {user && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full font-light"
              onClick={() => setShowShareModal(true)}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full font-light"
              disabled
            >
              <Plus className="w-4 h-4 mr-2" />
              Add
            </Button>
          </div>
        )}
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-400 font-light text-center">
              <p>No conversations in this folder</p>
            </div>
          </div>
        ) : (
          <div className="px-4 py-2">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => handleChatClick(conversation)}
                className="flex items-center py-2 px-0 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors group last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-light text-gray-900 truncate">
                    {conversation.title || 'New Chat'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Share Folder Modal */}
      {showShareModal && (
        <ShareFolderModal
          folderId={folderId}
          folderName={folderName}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
};

