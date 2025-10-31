import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSharedFolder, addFolderParticipant, isFolderParticipant } from '@/services/folders';
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
        const folder = await getSharedFolder(folderId);
        
        if (!folder) {
          setError('Folder not found');
          setLoading(false);
          return;
        }

        // If folder is public, anyone can view without auth
        if (folder.is_public) {
          navigate(`/folders/${folderId}`, { replace: true });
          return;
        }

        // Private folder - requires sign-in
        if (!isAuthenticated || !user) {
          // Store pending join for after sign-in
          localStorage.setItem('pending_join_folder_id', folderId);
          setError('Please sign in to view this folder');
          setLoading(false);
          return;
        }

        // Check if already a participant
        const isParticipant = await isFolderParticipant(folderId, user.id);
        
        if (!isParticipant) {
          // Add user as participant
          await addFolderParticipant(folderId, user.id, 'member');
        }

        // Navigate to folder view
        navigate(`/folders/${folderId}`, { replace: true });
      } catch (err) {
        console.error('Error loading folder:', err);
        setError('Failed to load folder');
        setLoading(false);
      }
    };

    loadFolder();
  }, [folderId, isAuthenticated, user, navigate]);

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

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-xl font-medium text-gray-900 mb-2">Folder Not Accessible</h1>
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

  return null;
};

export default JoinFolder;

