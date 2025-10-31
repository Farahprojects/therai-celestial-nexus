import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getSharedFolder, getFolderConversations, joinFolder, isFolderParticipant } from '@/services/folders';
import { ChatFolder } from '@/services/folders';
import { useAuth } from '@/contexts/AuthContext';
import { useChatStore } from '@/core/store';
import { MessageSquare } from 'lucide-react';

const JoinFolder: React.FC = () => {
  const { folderId } = useParams<{ folderId: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { setViewMode, startConversation } = useChatStore();
  const [folder, setFolder] = useState<ChatFolder | null>(null);
  const [conversations, setConversations] = useState<Array<{
    id: string;
    title: string;
    updated_at: string;
    mode: string | null;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadFolder = async () => {
      if (!folderId) {
        setError('Invalid folder link');
        setLoading(false);
        return;
      }

      try {
        // Check if folder exists and is shared
        const sharedFolder = await getSharedFolder(folderId);
        
        if (!sharedFolder) {
          setError('Folder not found or not shared');
          setLoading(false);
          return;
        }

        setFolder(sharedFolder);

        // Handle public folders (no sign-in required)
        if (sharedFolder.share_mode === 'public') {
          // Public folder: anyone can view without signing in
          const folderConversations = await getFolderConversations(folderId);
          setConversations(folderConversations);
          setLoading(false);
          return;
        }

        // Private folder: requires sign-in and participant status
        // If user is authenticated, add them as participant if not already
        if (isAuthenticated && user) {
          const isParticipant = await isFolderParticipant(folderId, user.id);
          
          if (!isParticipant) {
            // Add user as participant (private folders require participants)
            try {
              await joinFolder(folderId, user.id);
            } catch (joinError) {
              console.error('Error joining folder:', joinError);
              // Continue anyway - they can still view if folder is shared
            }
          }
          
          // If user is now a participant, redirect to folder view
          navigate(`/folders/${folderId}`, { replace: true });
          return;
        }

        // For unauthenticated users viewing private folder, show sign-in prompt
        // They won't be able to see conversations without being a participant
        try {
          const folderConversations = await getFolderConversations(folderId);
          setConversations(folderConversations);
        } catch (err) {
          // Might fail due to RLS if not participant
          console.error('Error loading conversations:', err);
        }
      } catch (err) {
        console.error('Error loading folder:', err);
        setError('Failed to load folder');
      } finally {
        setLoading(false);
      }
    };

    loadFolder();
  }, [folderId, isAuthenticated, user, navigate]);

  const handleChatClick = (conversation: { id: string; mode: string | null }) => {
    // Handle swiss conversations differently
    if (conversation.mode === 'swiss') {
      navigate(`/astro?chat_id=${conversation.id}`);
      return;
    }

    // For regular conversations, navigate to chat
    setViewMode('chat');
    startConversation(conversation.id);
    navigate(`/c/${conversation.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-light">Loading folder...</p>
        </div>
      </div>
    );
  }

  if (error || !folder) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-xl font-medium text-gray-900 mb-2">Folder Not Found</h1>
          <p className="text-gray-600 mb-6 font-light">{error}</p>
          <button
            onClick={() => navigate('/', { replace: true })}
            className="px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-sm font-light transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Folder Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-3xl font-light text-gray-900">{folder.name}</h1>
            {folder.share_mode === 'public' && (
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                Public
              </span>
            )}
            {folder.share_mode === 'private' && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                Private
              </span>
            )}
          </div>
          <p className="text-gray-500 font-light">Shared folder with {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</p>
        </div>

        {/* Conversations List */}
        {conversations.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-light">No conversations in this folder</p>
          </div>
        ) : (
          <div className="space-y-1 border border-gray-200 rounded-xl overflow-hidden">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => handleChatClick(conversation)}
                className="flex items-center py-3 px-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-light text-gray-900 truncate">
                    {conversation.title || 'New Chat'}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {new Date(conversation.updated_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sign In Prompt for unauthenticated users (only for private folders) */}
        {!isAuthenticated && folder?.share_mode === 'private' && (
          <div className="mt-8 text-center border-t border-gray-200 pt-8">
            <p className="text-gray-600 font-light mb-4">Sign in to view and join conversations in this folder</p>
            <button
              onClick={() => {
                // Store folder ID to redirect after sign in
                if (folderId) {
                  localStorage.setItem('pending_join_folder_id', folderId);
                }
                navigate('/therai');
              }}
              className="px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-sm font-light transition-colors"
            >
              Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default JoinFolder;

