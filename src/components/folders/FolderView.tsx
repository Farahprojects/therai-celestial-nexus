import React, { useCallback, useEffect, useState } from 'react';
import { getFolderConversations, getUserFolders, getSharedFolder, moveConversationToFolder, getFolderWithProfile } from '@/services/folders';
import { getJournalEntries, JournalEntry, updateJournalEntry, deleteJournalEntry } from '@/services/journal';
import { MoreHorizontal, Folder, HelpCircle, Sparkles, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '@/core/store';
import { useAuth } from '@/contexts/AuthContext';
import { updateConversationTitle, createConversation } from '@/services/conversations';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from '@/components/ui/dropdown-menu';
import { ConversationActionsMenuContent } from '@/components/chat/ConversationActionsMenu';
import { FolderModal } from './FolderModal';
import { FolderAddMenu } from './FolderAddMenu';
import { FolderExportMenu } from './FolderExportMenu';
import { JournalEntryModal } from './JournalEntryModal';
import { DocumentUploadModal } from './DocumentUploadModal';
import { FolderProfileSetup } from './FolderProfileSetup';
import { InsightsModal } from '@/components/insights/InsightsModal';
import { createFolder } from '@/services/folders';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ShareConversationModal } from '@/components/chat/ShareConversationModal';
import { ShareFolderModal } from '@/components/folders/ShareFolderModal';
import { SecondPersonForm, SecondPersonData } from './SecondPersonForm';
import { createCompatibilityConversation, buildSyncPayload, ensureProfileExists } from '@/services/compatibility';
import { toast } from 'sonner';

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
export const FolderView: React.FC<FolderViewProps> = ({
  folderId,
  onChatClick
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [folderName, setFolderName] = useState<string>('');
  const [folderProfileId, setFolderProfileId] = useState<string | null>(null);
  const [folderProfile, setFolderProfile] = useState<any | null>(null);
  const [hasProfileSetup, setHasProfileSetup] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [folders, setFolders] = useState<Array<{
    id: string;
    name: string;
  }>>([]);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [conversationToMoveToNewFolder, setConversationToMoveToNewFolder] = useState<string | null>(null);
  const [shareConversationId, setShareConversationId] = useState<string | null>(null);
  const [showFolderShareModal, setShowFolderShareModal] = useState(false);

  // New modal states
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showInsightsModal, setShowInsightsModal] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [showSecondPersonForm, setShowSecondPersonForm] = useState(false);
  // Journal edit/delete states
  const [showEditJournalDialog, setShowEditJournalDialog] = useState(false);
  const [editingJournal, setEditingJournal] = useState<JournalEntry | null>(null);
  const [editJournalTitle, setEditJournalTitle] = useState('');
  const [editJournalText, setEditJournalText] = useState('');
  const [isSavingJournal, setIsSavingJournal] = useState(false);
  const [showDeleteJournalDialog, setShowDeleteJournalDialog] = useState(false);
  const [deletingJournalId, setDeletingJournalId] = useState<string | null>(null);
  const navigate = useNavigate();
  const {
    user
  } = useAuth();
  const {
    setViewMode,
    startConversation,
    threads,
    removeThread,
    clearChat
  } = useChatStore();
  const loadFolderData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setFolderProfile(null);
    try {
      // Try to load folder - works for authenticated users
      if (user?.id) {
        try {
          const [folderWithProfile, userFolders, conversationsData, journalsData] = await Promise.all([getFolderWithProfile(folderId), getUserFolders(user.id), getFolderConversations(folderId), getJournalEntries(folderId)]);
          const folder = userFolders.find(f => f.id === folderId);
          if (folder) {
            setFolderName(folderWithProfile.folder.name);
            setFolderProfileId(folderWithProfile.folder.profile_id || null);
            setHasProfileSetup(folderWithProfile.folder.has_profile_setup || false);
            setFolderProfile(folderWithProfile.profile || null);
            setConversations(conversationsData);
            setJournals(journalsData);

            // Also load all folders for move to folder menu
            setFolders(userFolders.map(f => ({
              id: f.id,
              name: f.name
            })));
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
          setHasProfileSetup(sharedFolder.has_profile_setup || false);
          setConversations(conversationsData);
          return;
        }

        // Private folder - requires authentication
        if (!user?.id) {
          setError('Please sign in to view this folder');
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
  }, [folderId, user?.id]);
  useEffect(() => {
    loadFolderData();
  }, [loadFolderData]);
  const handleChatClick = (conversation: Conversation) => {
    // Switch to chat view
    setViewMode('chat');

    // Handle swiss conversations differently
    if (conversation.mode === 'swiss') {
      navigate(`/astro?chat_id=${conversation.id}`, {
        replace: true
      });
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
      const updatedThreads = threads.map(t => t.id === editingConversationId ? {
        ...t,
        title: editTitle.trim()
      } : t);
      useChatStore.setState({
        threads: updatedThreads
      });

      // Update conversations list in folder view
      setConversations(prev => prev.map(c => c.id === editingConversationId ? {
        ...c,
        title: editTitle.trim()
      } : c));
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
      await supabase.from('messages').delete().eq('chat_id' as never, editingConversationId);

      // Delete conversation
      await supabase.from('conversations').delete().eq('id' as never, editingConversationId).eq('user_id' as never, user.id);

      // Update local state
      removeThread(editingConversationId);

      // Update conversations list in folder view
      setConversations(prev => prev.filter(c => c.id !== editingConversationId));
      setShowDeleteDialog(false);
      setIsDeleting(false);
      setEditingConversationId(null);

      // If this was the current chat, clear the session
      const {
        chat_id
      } = useChatStore.getState();
      if (chat_id === editingConversationId) {
        clearChat();
        navigate('/therai', {
          replace: true
        });
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
      const updatedThreads = threads.map(t => t.id === conversationId ? {
        ...t,
        folder_id: targetFolderId
      } : t);
      useChatStore.setState({
        threads: updatedThreads
      });

      // Remove from current folder view if moving to another folder
      if (targetFolderId !== folderId) {
        setConversations(prev => prev.filter(c => c.id !== conversationId));
      }

      // Reload folders
      const userFolders = await getUserFolders(user.id);
      setFolders(userFolders.map(f => ({
        id: f.id,
        name: f.name
      })));
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
      setFolders(userFolders.map(f => ({
        id: f.id,
        name: f.name
      })));
    } catch (error) {
      console.error('[FolderView] Failed to create folder:', error);
    }
  };
  const handleCreateFolderAndMove = (conversationId: string) => {
    setConversationToMoveToNewFolder(conversationId);
    setShowFolderModal(true);
  };
  const handleJournalSaved = (entry: JournalEntry) => {
    setJournals(prev => [entry, ...prev]);
  };

  // Journal handlers
  const handleOpenEditJournal = (journal: JournalEntry) => {
    setEditingJournal(journal);
    setEditJournalTitle(journal.title || '');
    setEditJournalText(journal.entry_text || '');
    setShowEditJournalDialog(true);
  };
  const handleSaveJournalEdit = async () => {
    if (!editingJournal) return;
    if (!editJournalText.trim() && !editJournalTitle.trim()) return;
    setIsSavingJournal(true);
    try {
      const updated = await updateJournalEntry(editingJournal.id, {
        title: editJournalTitle.trim() || undefined,
        entry_text: editJournalText.trim() || undefined
      });
      setJournals(prev => prev.map(j => j.id === updated.id ? updated : j));
      setShowEditJournalDialog(false);
      setEditingJournal(null);
    } catch (err) {
      console.error('[FolderView] Failed to update journal entry:', err);
    } finally {
      setIsSavingJournal(false);
    }
  };
  const handleRequestDeleteJournal = (journalId: string) => {
    setDeletingJournalId(journalId);
    setShowDeleteJournalDialog(true);
  };
  const handleConfirmDeleteJournal = async () => {
    if (!deletingJournalId) return;
    try {
      await deleteJournalEntry(deletingJournalId);
      setJournals(prev => prev.filter(j => j.id !== deletingJournalId));
      setShowDeleteJournalDialog(false);
      setDeletingJournalId(null);
    } catch (err) {
      console.error('[FolderView] Failed to delete journal entry:', err);
    }
  };
  const upsertConversation = useCallback((record: any) => {
    if (!record?.id) return;
    const normalized: Conversation = {
      id: record.id,
      title: record.title || 'New Chat',
      updated_at: record.updated_at || new Date().toISOString(),
      mode: record.mode
    };
    setConversations(prev => {
      const filtered = prev.filter(c => c.id !== normalized.id);
      const next = [...filtered, normalized].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      return next;
    });
  }, []);
  const removeConversationById = useCallback((id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
  }, []);
  useEffect(() => {
    const channel = supabase.channel(`folder-conversations-${folderId}`).on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'conversations',
      filter: `folder_id=eq.${folderId}`
    }, payload => upsertConversation(payload.new)).on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'conversations',
      filter: `folder_id=eq.${folderId}`
    }, payload => upsertConversation(payload.new)).on('postgres_changes', {
      event: 'DELETE',
      schema: 'public',
      table: 'conversations',
      filter: `folder_id=eq.${folderId}`
    }, payload => {
      if (payload.old?.id) {
        removeConversationById(payload.old.id);
      }
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [folderId, upsertConversation, removeConversationById]);

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
      setHasProfileSetup(folderWithProfile.folder.has_profile_setup || false);
      setFolderProfile(folderWithProfile.profile || null);
    } catch (error) {
      console.error('[FolderView] Failed to reload folder profile:', error);
    }
  };

  const handleAddSecondPerson = async (secondPersonData: SecondPersonData) => {
    if (!user?.id) return;
    
    // Validate folder has profile_id (person_a)
    if (!folderProfile || !folderProfileId) {
      toast.error('Please set up your profile for this folder first');
      setShowSecondPersonForm(false);
      return;
    }

    try {
      // Ensure second person profile exists
      let personBId = secondPersonData.profile_id;
      if (!personBId) {
        personBId = await ensureProfileExists(user.id, {
          name: secondPersonData.name,
          birth_date: secondPersonData.birth_date,
          birth_time: secondPersonData.birth_time,
          location: secondPersonData.location,
          latitude: secondPersonData.latitude,
          longitude: secondPersonData.longitude,
          place_id: secondPersonData.place_id,
          timezone: secondPersonData.timezone,
        });
      }

      // Prepare person A data from folder profile
      const personA = {
        name: folderProfile.name,
        birth_date: folderProfile.birth_date,
        birth_time: folderProfile.birth_time,
        location: folderProfile.birth_location,
        latitude: folderProfile.birth_latitude,
        longitude: folderProfile.birth_longitude,
        tz: folderProfile.timezone,
        house_system: folderProfile.house_system || 'placidus',
      };

      // Prepare person B data
      const personB = {
        name: secondPersonData.name,
        birth_date: secondPersonData.birth_date,
        birth_time: secondPersonData.birth_time,
        location: secondPersonData.location,
        latitude: secondPersonData.latitude,
        longitude: secondPersonData.longitude,
        tz: secondPersonData.timezone,
        house_system: 'placidus',
      };

      // Create compatibility conversation
      const conversationId = await createCompatibilityConversation(
        user.id,
        folderId,
        personA,
        personB
      );

      // Build sync payload
      const payload = buildSyncPayload(conversationId, personA, personB);

      // Fire initiate-auth-report to generate sync chart
      const { error: reportError } = await supabase.functions.invoke('initiate-auth-report', {
        body: payload,
      });

      if (reportError) {
        console.error('[FolderView] Error initiating sync chart:', reportError);
        toast.error('Failed to generate compatibility chart');
        return;
      }

      // Close form and navigate to new conversation
      setShowSecondPersonForm(false);
      toast.success('Compatibility chat created!');
      
      // Reload folder data to show new conversation
      await loadFolderData();
      
      // Navigate to the new conversation
      setViewMode('chat');
      startConversation(conversationId);
      onChatClick(conversationId);
    } catch (error) {
      console.error('[FolderView] Failed to create compatibility chat:', error);
      toast.error('Failed to create compatibility chat');
    }
  };
  if (isLoading) {
    return <div className="h-full flex items-center justify-center">
        <div className="text-gray-500 font-light">Loading...</div>
      </div>;
  }
  if (error) {
    return <div className="h-full flex items-center justify-center">
        <div className="text-red-500 font-light">{error}</div>
      </div>;
  }
  return <div className="h-full flex flex-col bg-white">
      {/* Folder Name and Action Buttons */}
      <div className="px-6 py-4">
        <div className="w-full max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-lg font-light text-gray-900">
            <Folder className="w-5 h-5 text-gray-900" />
            <span>{folderName}</span>
          </div>
          {user && <div className="flex items-center gap-2">
              <button onClick={() => setShowFolderShareModal(true)} className="p-2 hover:bg-gray-100 rounded-full transition-colors" title="Share folder">
                <Share2 className="w-4 h-4 text-gray-500" />
              </button>
              {/* Help Icon */}
              <button onClick={() => setShowHelpDialog(true)} className="p-2 hover:bg-gray-100 rounded-full transition-colors" title="Help">
                <HelpCircle className="w-4 h-4 text-gray-500" />
              </button>
              
              {/* Export Menu */}
              <FolderExportMenu folderId={folderId} folderName={folderName} />
              
              {/* Add Menu */}
              <FolderAddMenu onJournalClick={() => setShowJournalModal(true)} onInsightsClick={() => setShowInsightsModal(true)} onUploadClick={() => setShowUploadModal(true)} onNewChatClick={handleNewChat} onAddSecondPersonClick={() => setShowSecondPersonForm(true)} />
            </div>}
        </div>
      </div>

      {/* Profile Setup Banner (shown when no profile is linked) */}
      {user && !hasProfileSetup && <div className="px-6">
          <FolderProfileSetup folderId={folderId} folderName={folderName} onProfileLinked={handleProfileLinked} />
        </div>}

      {/* Journal Entries Section */}
      {journals.length > 0 && <div className="px-6 py-4">
          <div className="w-full max-w-2xl mx-auto">
            
            <div className="flex flex-col space-y-2">
              {journals.map(journal => <div key={journal.id} className="py-2">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      {!!journal.title && <p className="text-sm font-light text-gray-900 mb-1">
                          {journal.title}
                        </p>}
                      <p className="text-sm font-light text-gray-900 mb-1">
                        {journal.entry_text}
                      </p>
                      <p className="text-xs font-light text-gray-500">
                        {new Date(journal.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {user && <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1 hover:bg-gray-100 rounded transition-colors" aria-label="Journal actions">
                            <MoreHorizontal className="w-4 h-4 text-gray-600" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <button className="w-full text-left" onClick={() => handleOpenEditJournal(journal)}>
                            <div className="px-2 py-1.5 text-sm hover:bg-gray-100 rounded">
                              Edit
                            </div>
                          </button>
                          <button className="w-full text-left" onClick={() => handleRequestDeleteJournal(journal.id)}>
                            <div className="px-2 py-1.5 text-sm text-red-600 hover:bg-gray-100 rounded">
                              Delete
                            </div>
                          </button>
                        </DropdownMenuContent>
                      </DropdownMenu>}
                  </div>
                </div>)}
            </div>
          </div>
        </div>}

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? <div className="flex items-center justify-center h-full">
            <div className="text-gray-400 font-light text-center">
              <p>No conversations in this folder</p>
            </div>
          </div> : <div className="px-6 py-4">
            <div className="w-full max-w-2xl mx-auto flex flex-col space-y-2">
              {conversations.map(conversation => <div key={conversation.id} className="flex items-center justify-between gap-4 py-3 px-4 rounded-2xl hover:bg-gray-50 transition-colors group">
                  <div className="flex-1 min-w-0 cursor-pointer flex items-center gap-2" onClick={() => handleChatClick(conversation)}>
                    {conversation.mode === 'insight' && <Sparkles className="w-4 h-4 text-gray-500 flex-shrink-0" />}
                    <div className="text-sm font-light text-gray-900 truncate">
                      {conversation.title || 'New Chat'}
                    </div>
                    {conversation.mode === 'sync_score' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pink-100 text-pink-700 border border-pink-200 flex-shrink-0">Compatibility</span>}
                  </div>
                  
                  {/* Three dots menu */}
                  {user && <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 hover:bg-gray-200 rounded transition-colors" onClick={e => e.stopPropagation()}>
                          <MoreHorizontal className="w-4 h-4 text-gray-600" />
                        </button>
                      </DropdownMenuTrigger>
                      <ConversationActionsMenuContent conversationId={conversation.id} currentTitle={conversation.title || ''} onEdit={handleEditChat} onDelete={handleDeleteChat} onShare={id => setShareConversationId(id)} onMoveToFolder={handleMoveToFolder} onCreateFolder={handleCreateFolderAndMove} folders={folders} currentFolderId={folderId} align="end" />
                    </DropdownMenu>}
                </div>)}
            </div>
          </div>}
      </div>

      {/* Edit Title Dialog */}
      {showEditDialog && <div className="fixed inset-0 flex items-center justify-center z-50 p-6 bg-black/10 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Title</h3>
            <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} onKeyDown={e => {
          if (e.key === 'Enter') {
            handleSaveTitle();
          } else if (e.key === 'Escape') {
            setShowEditDialog(false);
            setEditingConversationId(null);
          }
        }} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 mb-4" placeholder="Enter title" autoFocus />
            <div className="flex justify-end gap-2">
              <button onClick={() => {
            setShowEditDialog(false);
            setEditingConversationId(null);
          }} disabled={isSaving} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleSaveTitle} disabled={isSaving} className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50">
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>}

      {/* Share Conversation Modal */}
      {shareConversationId && <ShareConversationModal conversationId={shareConversationId} onClose={() => setShareConversationId(null)} />}

      {/* Share Folder Modal */}
      {showFolderShareModal && <ShareFolderModal folderId={folderId} onClose={() => setShowFolderShareModal(false)} />}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && <div className="fixed inset-0 flex items-center justify-center z-50 p-6 bg-black/10 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Delete Chat</h3>
            <p className="text-gray-600 mb-4">Are you sure you want to delete this chat? This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => {
            setShowDeleteDialog(false);
            setEditingConversationId(null);
          }} disabled={isDeleting} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleConfirmDelete} disabled={isDeleting} className="px-4 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors disabled:opacity-50">
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>}

      {/* Edit Journal Dialog */}
      {showEditJournalDialog && <div className="fixed inset-0 flex items-center justify-center z-50 p-6 bg-black/10 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Journal Entry</h3>
            <div className="space-y-3">
              <input type="text" value={editJournalTitle} onChange={e => setEditJournalTitle(e.target.value)} placeholder="Title (optional)" disabled={isSavingJournal} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900" />
              <textarea value={editJournalText} onChange={e => setEditJournalText(e.target.value)} placeholder="Edit your entry..." disabled={isSavingJournal} rows={6} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setShowEditJournalDialog(false);
                  setEditingJournal(null);
                }}
                disabled={isSavingJournal}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveJournalEdit}
                disabled={isSavingJournal}
                className="px-4 py-2 bg-gray-900 text-white rounded-full hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {isSavingJournal ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>}

      {/* Delete Journal Confirmation Dialog */}
      {showDeleteJournalDialog && <div className="fixed inset-0 flex items-center justify-center z-50 p-6 bg-black/10 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Delete Journal Entry</h3>
            <p className="text-gray-600 mb-4">Are you sure you want to delete this journal entry? This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => {
            setShowDeleteJournalDialog(false);
            setDeletingJournalId(null);
          }} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
                Cancel
              </button>
              <button onClick={handleConfirmDeleteJournal} className="px-4 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>}

      {/* Folder Modal for Create New Folder */}
      {showFolderModal && <FolderModal isOpen={showFolderModal} onClose={() => {
      setShowFolderModal(false);
      setConversationToMoveToNewFolder(null);
    }} onCreateFolder={handleCreateFolder} editingFolder={null} />}

      {/* Journal Entry Modal */}
      {user && <JournalEntryModal isOpen={showJournalModal} onClose={() => setShowJournalModal(false)} folderId={folderId} userId={user.id} onEntrySaved={handleJournalSaved} />}

      {/* Document Upload Modal */}
      {user && <DocumentUploadModal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} folderId={folderId} userId={user.id} />}

      {/* Insights Modal */}
      <InsightsModal isOpen={showInsightsModal} onClose={() => setShowInsightsModal(false)} folderId={folderId} profileData={folderProfile} onReportReady={loadFolderData} onReportCreated={conversation => {
      if (!conversation?.id) return;
      upsertConversation({
        id: conversation.id,
        title: conversation.title || 'Insights',
        updated_at: new Date().toISOString(),
        mode: conversation.mode || 'insight'
      });
    }} />

      {/* Second Person Form Modal */}
      <SecondPersonForm isOpen={showSecondPersonForm} onClose={() => setShowSecondPersonForm(false)} folderId={folderId} onSubmit={handleAddSecondPerson} />

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
    </div>;
};