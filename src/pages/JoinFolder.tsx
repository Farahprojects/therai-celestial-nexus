import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSharedFolder, addFolderParticipant, isFolderParticipant } from '@/services/folders';
import { useAuth } from '@/contexts/AuthContext';
import { setRedirectPath, encodeRedirectPath } from '@/utils/redirectUtils';
import { safeConsoleError, safeConsoleLog } from '@/utils/safe-logging';
const JoinFolder: React.FC = () => {
  const { folderId } = useParams<{ folderId: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait for auth check to complete before proceeding
    if (authLoading) return;

    const loadFolder = async () => {
      safeConsoleLog('[JoinFolder] Starting loadFolder', { folderId, isAuthenticated, userId: user?.id });
      
      if (!folderId) {
        console.log('[JoinFolder] No folderId - navigating to /therai');
        setLoading(false);
        navigate('/therai', { replace: true });
        return;
      }

      // Check authentication FIRST before trying to fetch folder
      // This prevents RLS errors when unauthenticated users can't query the folder
      if (!isAuthenticated || !user) {
        console.log('[JoinFolder] User not authenticated - preserving redirect for folder');
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

      // User is authenticated - navigate immediately for seamless UX
      console.log('[JoinFolder] User authenticated - navigating immediately to /folders/:folderId');
      navigate(`/folders/${folderId}`, { replace: true });
      
      // Handle folder validation and participant addition in background
      (async () => {
        try {
          const folder = await getSharedFolder(folderId);
          
          if (!folder) {
            safeConsoleLog('[JoinFolder] Folder not found in background check');
            return;
          }
          
          console.log('[JoinFolder] Background: Folder fetched:', { id: folder.id, name: folder.name, is_public: folder.is_public });
          
          // Store folder in sessionStorage so it appears in sidebar immediately
          try {
            const tempFoldersJson = sessionStorage.getItem('temp_folders');
            const tempFolders = tempFoldersJson ? JSON.parse(tempFoldersJson) : [];
            const exists = tempFolders.some((f: { id: string }) => f.id === folderId);
            if (!exists) {
              tempFolders.push({
                id: folder.id,
                name: folder.name,
              });
              sessionStorage.setItem('temp_folders', JSON.stringify(tempFolders));
              console.log('[JoinFolder] Background: Folder saved to sessionStorage');
            }
          } catch (error) {
            safeConsoleError('[JoinFolder] Background: Failed to save folder to sessionStorage:', error);
          }

          // If private folder, add user as participant
          if (!folder.is_public) {
            const participantStatus = await isFolderParticipant(folderId, user.id);
            
            if (!participantStatus) {
              safeConsoleLog('[JoinFolder] Background: Adding user as participant');
              await addFolderParticipant(folderId, user.id, 'member');
              console.log('[JoinFolder] Background: Successfully added as participant');
            }
          }
          
          // Clear pending keys
          try {
            localStorage.removeItem('pending_join_folder_id');
            localStorage.removeItem('pending_redirect_path');
          } catch {
            // Ignore
          }
        } catch (err) {
          safeConsoleError('[JoinFolder] Background error:', err);
        }
      })();
    };

    loadFolder();
  }, [folderId, isAuthenticated, user, navigate, authLoading]);

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

