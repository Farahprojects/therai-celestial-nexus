import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSharedFolder, addFolderParticipant, isFolderParticipant } from '@/services/folders';
import { useAuth } from '@/contexts/AuthContext';

const JoinFolder: React.FC = () => {
  const { folderId } = useParams<{ folderId: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFolder = async () => {
      if (!folderId) {
        // Invalid folder ID - navigate to main route
        navigate('/therai', { replace: true });
        return;
      }

      try {
        const folder = await getSharedFolder(folderId);
        
        if (!folder) {
          // Folder doesn't exist - still show main route
          navigate('/therai', { replace: true });
          return;
        }

        // If folder is public, anyone can view without auth
        if (folder.is_public) {
          navigate(`/folders/${folderId}`, { replace: true });
          return;
        }

        // Private folder - requires sign-in
        if (!isAuthenticated || !user) {
          // Store pending join and full URL path for after sign-in
          localStorage.setItem('pending_join_folder_id', folderId);
          localStorage.setItem('pending_redirect_path', `/folders/${folderId}`);
          // Navigate to main route - ChatContainer will open auth modal
          navigate('/therai', { replace: true });
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
        // On error, navigate to main route instead of showing error
        navigate('/therai', { replace: true });
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

  // Component handles navigation internally - no error UI needed
  return null;
};

export default JoinFolder;

