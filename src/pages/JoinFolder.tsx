import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSharedFolder, addFolderParticipant, isFolderParticipant } from '@/services/folders';
import { useAuth } from '@/contexts/AuthContext';
import { setRedirectPath, encodeRedirectPath } from '@/utils/redirectUtils';

const JoinFolder: React.FC = () => {
  const { folderId } = useParams<{ folderId: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFolder = async () => {
      console.log('[JoinFolder] Starting loadFolder', { folderId, isAuthenticated, userId: user?.id });
      
      if (!folderId) {
        console.log('[JoinFolder] No folderId - navigating to /therai');
        setLoading(false);
        navigate('/therai', { replace: true });
        return;
      }

      try {
        console.log('[JoinFolder] Fetching folder:', folderId);
        const folder = await getSharedFolder(folderId);
        console.log('[JoinFolder] Folder fetched:', folder ? { id: folder.id, name: folder.name, is_public: folder.is_public } : 'null');
        
        if (!folder) {
          console.log('[JoinFolder] Folder not found - navigating to /therai');
          setLoading(false);
          navigate('/therai', { replace: true });
          return;
        }

        // If folder is public, anyone can view without auth
        if (folder.is_public) {
          console.log('[JoinFolder] Public folder - navigating to /folders/:folderId');
          setLoading(false);
          navigate(`/folders/${folderId}`, { replace: true });
          return;
        }

        // Private folder - requires sign-in
        if (!isAuthenticated || !user) {
          console.log('[JoinFolder] Private folder, user not authenticated - preserving redirect');
          // Preserve redirect path in URL params (more reliable than localStorage)
          const redirectPath = setRedirectPath(`/folders/${folderId}`);
          const encodedRedirect = encodeRedirectPath(redirectPath);
          
          // Also store folder ID for backward compatibility
          try {
            localStorage.setItem('pending_join_folder_id', folderId);
          } catch {
            // Ignore localStorage errors
          }
          
          // Navigate with redirect param - auth flow will preserve it
          setLoading(false);
          navigate(`/therai?redirect=${encodedRedirect}`, { replace: true });
          return;
        }

        console.log('[JoinFolder] Private folder, user authenticated - checking participant status');
        // Check if already a participant
        const participantStatus = await isFolderParticipant(folderId, user.id);
        console.log('[JoinFolder] Is participant:', participantStatus);
        
        if (!participantStatus) {
          console.log('[JoinFolder] Not a participant - adding as participant', { folderId, userId: user.id });
          try {
            await addFolderParticipant(folderId, user.id, 'member');
            console.log('[JoinFolder] Successfully added as participant');
            
            // Small delay to ensure participant record is committed
            await new Promise(resolve => setTimeout(resolve, 100));
            console.log('[JoinFolder] Delay completed, participant should be committed');
          } catch (err) {
            console.error('[JoinFolder] Error adding participant:', err);
            throw err;
          }
        } else {
          console.log('[JoinFolder] Already a participant - skipping add');
        }

        // Store folder in sessionStorage so it appears in sidebar immediately
        try {
          console.log('[JoinFolder] Saving folder to sessionStorage');
          const tempFoldersJson = sessionStorage.getItem('temp_folders');
          const tempFolders = tempFoldersJson ? JSON.parse(tempFoldersJson) : [];
          const exists = tempFolders.some((f: any) => f.id === folderId);
          if (!exists) {
            tempFolders.push({
              id: folder.id,
              name: folder.name,
            });
            sessionStorage.setItem('temp_folders', JSON.stringify(tempFolders));
            console.log('[JoinFolder] Folder saved to sessionStorage');
          } else {
            console.log('[JoinFolder] Folder already in sessionStorage');
          }
        } catch (error) {
          console.error('[JoinFolder] Failed to save folder to sessionStorage:', error);
        }

        // Navigate to folder view
        console.log('[JoinFolder] Navigating to /folders/:folderId');
        setLoading(false);
        navigate(`/folders/${folderId}`, { replace: true });
      } catch (err) {
        console.error('[JoinFolder] Error loading folder:', err);
        setLoading(false);
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

