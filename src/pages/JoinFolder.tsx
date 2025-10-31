import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSharedFolder, joinFolder, isFolderParticipant } from '@/services/folders';
import { useAuth } from '@/contexts/AuthContext';

const JoinFolder: React.FC = () => {
  const { folderId } = useParams<{ folderId: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
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

        // Always redirect to main app interface (/folders/:folderId)
        // This provides the full app experience with sidebar, chat interface, etc.
        
        // If user is authenticated, add them as participant if needed (for private folders)
        if (isAuthenticated && user) {
          // For private folders, ensure user is a participant
          if (sharedFolder.share_mode === 'private' || !sharedFolder.share_mode) {
            const isParticipant = await isFolderParticipant(folderId, user.id);
            
            if (!isParticipant) {
              try {
                await joinFolder(folderId, user.id);
              } catch (joinError) {
                console.error('Error joining folder:', joinError);
              }
            }
          }
        } else {
          // For unauthenticated users on private folders, store pending join
          if (sharedFolder.share_mode === 'private' || !sharedFolder.share_mode) {
            localStorage.setItem('pending_join_folder_id', folderId);
          }
        }
        
        // Redirect to main app interface - AuthGuard will handle auth modal if needed
        navigate(`/folders/${folderId}`, { replace: true });
      } catch (err) {
        console.error('Error loading folder:', err);
        setError('Failed to load folder');
        setLoading(false);
      }
    };

    loadFolder();
  }, [folderId, isAuthenticated, user, navigate]);

  // Show loading state while checking folder and redirecting
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

  // Show error state if folder not found
  if (error) {
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

  // This should rarely be seen - redirect happens almost immediately
  return null;
};

export default JoinFolder;

