import { useCallback, useEffect, useState } from 'react';
import { getFolderConversations, getUserFolders, getSharedFolder, getFolderWithProfile } from '@/services/folders';
import { getJournalEntries, JournalEntry } from '@/services/journal';
import { getDocuments, FolderDocument } from '@/services/folder-documents';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
  mode: string | null;
}

interface FolderData {
  conversations: Conversation[];
  journals: JournalEntry[];
  documents: FolderDocument[];
  folderName: string;
  folderProfileId: string | null;
  folderProfile: {
    id: string;
    profile_name: string;
    name: string;
    birth_date: string;
    birth_time: string;
    birth_location: string;
    birth_latitude: number | null;
    birth_longitude: number | null;
    birth_place_id: string | null;
    timezone: string | null;
    house_system: string | null;
    is_primary: boolean;
  } | null;
  hasProfileSetup: boolean;
  folders: Array<{
    id: string;
    name: string;
  }>;
  isLoading: boolean;
  error: string | null;
}

export const useFolderData = (folderId: string) => {
  const { user } = useAuth();
  const [state, setState] = useState<FolderData>({
    conversations: [],
    journals: [],
    documents: [],
    folderName: '',
    folderProfileId: null,
    folderProfile: null,
    hasProfileSetup: false,
    folders: [],
    isLoading: true,
    error: null,
  });

  const upsertConversation = useCallback((record: Conversation) => {
    if (!record?.id) return;
    const normalized: Conversation = {
      id: record.id,
      title: record.title || 'New Chat',
      updated_at: record.updated_at || new Date().toISOString(),
      mode: record.mode
    };
    setState(prev => ({
      ...prev,
      conversations: [...prev.conversations.filter(c => c.id !== normalized.id), normalized]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    }));
  }, []);

  const removeConversationById = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      conversations: prev.conversations.filter(c => c.id !== id)
    }));
  }, []);

  const updateConversations = useCallback((conversations: Conversation[]) => {
    setState(prev => ({ ...prev, conversations }));
  }, []);

  const updateJournals = useCallback((journals: JournalEntry[]) => {
    setState(prev => ({ ...prev, journals }));
  }, []);

  const updateDocuments = useCallback((documents: FolderDocument[]) => {
    setState(prev => ({ ...prev, documents }));
  }, []);

  const loadFolderData = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null, folderProfile: null }));

    try {
      // Try to load folder - works for authenticated users
      if (user?.id) {
        try {
          const [folderWithProfile, userFolders, conversationsData, journalsData, documentsData] = await Promise.all([
            getFolderWithProfile(folderId),
            getUserFolders(user.id),
            getFolderConversations(folderId),
            getJournalEntries(folderId),
            getDocuments(folderId)
          ]);

          const folder = userFolders.find(f => f.id === folderId);
          if (folder) {
            setState(prev => ({
              ...prev,
              folderName: folderWithProfile.folder.name,
              folderProfileId: folderWithProfile.folder.profile_id || null,
              hasProfileSetup: folderWithProfile.folder.has_profile_setup || false,
              folderProfile: folderWithProfile.profile || null,
              conversations: conversationsData,
              journals: journalsData,
              documents: documentsData,
              folders: userFolders.map(f => ({ id: f.id, name: f.name })),
              isLoading: false,
            }));
            return;
          }
        } catch (err) {
          console.error('[useFolderData] Failed to load from user folders:', err);
          // Fall through to try as shared folder
        }
      }

      // Try loading as shared/public folder (for non-owners or unauthenticated)
      const sharedFolder = await getSharedFolder(folderId);
      if (sharedFolder) {
        // If folder is public, anyone can view it
        if (sharedFolder.is_public) {
          const conversationsData = await getFolderConversations(folderId);
          setState(prev => ({
            ...prev,
            folderName: sharedFolder.name,
            folderProfileId: sharedFolder.profile_id || null,
            hasProfileSetup: sharedFolder.has_profile_setup || false,
            conversations: conversationsData,
            isLoading: false,
          }));
          return;
        }

        // Private folder - requires authentication
        if (!user?.id) {
          setState(prev => ({
            ...prev,
            error: 'Please sign in to view this folder',
            isLoading: false,
          }));
          return;
        }
      }

      // If we get here, folder not found or not accessible
      setState(prev => ({
        ...prev,
        error: 'Folder not found or not accessible',
        isLoading: false,
      }));
    } catch (err) {
      console.error('[useFolderData] Failed to load folder data:', err);
      setState(prev => ({
        ...prev,
        error: 'Failed to load folder',
        isLoading: false,
      }));
    }
  }, [folderId, user?.id]);

  const reloadProfileData = useCallback(async () => {
    try {
      const folderWithProfile = await getFolderWithProfile(folderId);
      setState(prev => ({
        ...prev,
        folderProfileId: folderWithProfile.folder.profile_id || null,
        hasProfileSetup: folderWithProfile.folder.has_profile_setup || false,
        folderProfile: folderWithProfile.profile || null,
      }));
    } catch (error) {
      console.error('[useFolderData] Failed to reload folder profile:', error);
    }
  }, [folderId]);

  // Real-time subscriptions
  useEffect(() => {
    const channel = supabase.channel(`folder-conversations-${folderId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'conversations',
        filter: `folder_id=eq.${folderId}`
      }, payload => upsertConversation(payload.new))
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversations',
        filter: `folder_id=eq.${folderId}`
      }, payload => upsertConversation(payload.new))
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'conversations',
        filter: `folder_id=eq.${folderId}`
      }, payload => {
        if (payload.old?.id) {
          removeConversationById(payload.old.id);
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'folder_documents',
        filter: `folder_id=eq.${folderId}`
      }, async () => {
        // Reload documents when new one is added
        try {
          const documentsData = await getDocuments(folderId);
          updateDocuments(documentsData);
        } catch (err) {
          console.error('[useFolderData] Failed to reload documents:', err);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'folder_documents',
        filter: `folder_id=eq.${folderId}`
      }, async () => {
        // Reload documents when one is updated
        try {
          const documentsData = await getDocuments(folderId);
          updateDocuments(documentsData);
        } catch (err) {
          console.error('[useFolderData] Failed to reload documents:', err);
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'folder_documents',
        filter: `folder_id=eq.${folderId}`
      }, payload => {
        if (payload.old?.id) {
          setState(prev => ({
            ...prev,
            documents: prev.documents.filter(d => d.id !== payload.old.id)
          }));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [folderId, upsertConversation, removeConversationById]);

  useEffect(() => {
    loadFolderData();
  }, [loadFolderData, updateDocuments]);

  return {
    ...state,
    loadFolderData,
    reloadProfileData,
    updateConversations,
    updateJournals,
    updateDocuments,
    upsertConversation,
  };
};
