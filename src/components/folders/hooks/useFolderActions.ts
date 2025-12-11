import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '@/core/store';
import { useAuth } from '@/contexts/AuthContext';
import { updateConversationTitle, createConversation } from '@/services/conversations';
import { moveConversationToFolder, createFolder, getUserFolders } from '@/services/folders';
import { updateJournalEntry, deleteJournalEntry, JournalEntry } from '@/services/journal';
import { deleteDocument, getDocuments, FolderDocument } from '@/services/folder-documents';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { safeConsoleError } from '@/utils/safe-logging';

interface Conversation {
  id: string;
  title: string | null;
  updated_at: string | null;
  mode: string | null;
}

interface UseFolderActionsProps {
  folderId: string;
  folderName?: string;
  conversations: Conversation[];
  journals: JournalEntry[];
  documents: FolderDocument[];
  updateConversations: (conversations: Conversation[]) => void;
  updateJournals: (journals: JournalEntry[]) => void;
  updateDocuments: (documents: FolderDocument[]) => void;
  upsertConversation: (record: Conversation) => void;
  loadFolderData: () => void;
  onChatClick: (chatId: string) => void;
}

export const useFolderActions = ({
  folderId,
  conversations,
  journals,
  documents,
  updateConversations,
  updateJournals,
  updateDocuments,
  onChatClick,
}: UseFolderActionsProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    setViewMode,
    startConversation,
    threads,
    removeThread,
    clearChat
  } = useChatStore();

  // Modal states
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [folders, setFolders] = useState<Array<{ id: string; name: string }>>([]);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [conversationToMoveToNewFolder, setConversationToMoveToNewFolder] = useState<string | null>(null);
  const [shareConversationId, setShareConversationId] = useState<string | null>(null);

  // Journal states
  const [showEditJournalDialog, setShowEditJournalDialog] = useState(false);
  const [editingJournal, setEditingJournal] = useState<JournalEntry | null>(null);
  const [editJournalTitle, setEditJournalTitle] = useState('');
  const [editJournalText, setEditJournalText] = useState('');
  const [isSavingJournal, setIsSavingJournal] = useState(false);
  const [showDeleteJournalDialog, setShowDeleteJournalDialog] = useState(false);
  const [deletingJournalId, setDeletingJournalId] = useState<string | null>(null);

  // Document states
  const [showDeleteDocumentDialog, setShowDeleteDocumentDialog] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);

  // Conversation action handlers
  const handleChatClick = (conversation: Conversation) => {
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

  const handleEditChat = (conversationId: string, currentTitle: string | null) => {
    setEditingConversationId(conversationId);
    setEditTitle(currentTitle);
    setShowEditDialog(true);
  };

  const handleSaveTitle = async () => {
    if (!editingConversationId || !editTitle.trim() || isSaving || !user) return;
    setIsSaving(true);
    try {
      await updateConversationTitle(editingConversationId, editTitle.trim(), user.id);

      // Update local state
      const updatedThreads = threads.map(t => t.id === editingConversationId ? {
        ...t,
        title: editTitle.trim()
      } : t);
      useChatStore.setState({
        threads: updatedThreads
      });

      // Update conversations list in folder view
      updateConversations(conversations.map(c => c.id === editingConversationId ? {
        ...c,
        title: editTitle.trim()
      } : c));
      setShowEditDialog(false);
      setEditingConversationId(null);
    } catch (error) {
      safeConsoleError('[useFolderActions] Failed to update title', error);
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
      removeThread(editingConversationId, user.id);

      // Update conversations list in folder view
      updateConversations(conversations.filter(c => c.id !== editingConversationId));
      setShowDeleteDialog(false);
      setIsDeleting(false);
      setEditingConversationId(null);

      // Reload threads to update the left sidebar
      const { loadThreads } = useChatStore.getState();
      loadThreads(user.id);

      // If this was the current chat, clear the session
      const { chat_id } = useChatStore.getState();
      if (chat_id === editingConversationId) {
        clearChat();
        navigate('/therai', {
          replace: true
        });
      }
    } catch (error) {
      safeConsoleError('[useFolderActions] Error deleting conversation', error);
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
        updateConversations(conversations.filter(c => c.id !== conversationId));
      }

      // Reload folders
      const userFolders = await getUserFolders(user.id);
      setFolders(userFolders.map(f => ({
        id: f.id,
        name: f.name
      })));
    } catch (error) {
      safeConsoleError('[useFolderActions] Failed to move conversation to folder', error);
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
        updateConversations(conversations.filter(c => c.id !== conversationToMoveToNewFolder));
      }

      // Reload folders
      const userFolders = await getUserFolders(user.id);
      setFolders(userFolders.map(f => ({
        id: f.id,
        name: f.name
      })));
    } catch (error) {
      safeConsoleError('[useFolderActions] Failed to create folder', error);
    }
  };

  const handleCreateFolderAndMove = (conversationId: string) => {
    setConversationToMoveToNewFolder(conversationId);
    setShowFolderModal(true);
  };

  // Journal handlers
  const handleJournalSaved = (entry: JournalEntry) => {
    updateJournals([entry, ...journals]);
  };

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
      updateJournals(journals.map(j => j.id === updated.id ? updated : j));
      setShowEditJournalDialog(false);
      setEditingJournal(null);
    } catch (err) {
      safeConsoleError('[useFolderActions] Failed to update journal entry', err);
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
      updateJournals(journals.filter(j => j.id !== deletingJournalId));
      setShowDeleteJournalDialog(false);
      setDeletingJournalId(null);
    } catch (err) {
      safeConsoleError('[useFolderActions] Failed to delete journal entry', err);
    }
  };

  // Document handlers
  const handleDocumentUploaded = async () => {
    try {
      const documentsData = await getDocuments(folderId);
      updateDocuments(documentsData);
    } catch (err) {
      safeConsoleError('[useFolderActions] Failed to reload documents', err);
    }
  };

  const handleRequestDeleteDocument = (documentId: string) => {
    setDeletingDocumentId(documentId);
    setShowDeleteDocumentDialog(true);
  };

  const handleConfirmDeleteDocument = async () => {
    if (!deletingDocumentId) return;
    try {
      await deleteDocument(deletingDocumentId);
      updateDocuments(documents.filter(d => d.id !== deletingDocumentId));
      setShowDeleteDocumentDialog(false);
      setDeletingDocumentId(null);
      toast.success('Document deleted');
    } catch (err) {
      safeConsoleError('[useFolderActions] Failed to delete document', err);
      toast.error('Failed to delete document');
    }
  };

  // New chat handler
  const handleNewChat = async () => {
    if (!user?.id) return;
    try {
      // Pass folderId directly to createConversation for atomic folder assignment
      const newChatId = await createConversation(user.id, 'chat', 'New Chat', undefined, folderId);

      // Navigate to the new chat
      setViewMode('chat');
      startConversation(newChatId);
      onChatClick(newChatId);
    } catch (error) {
      safeConsoleError('[useFolderActions] Failed to create new chat', error);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return {
    // Modal states
    showEditDialog,
    showDeleteDialog,
    isDeleting,
    isSaving,
    editTitle,
    editingConversationId,
    folders,
    showFolderModal,
    conversationToMoveToNewFolder,
    shareConversationId,
    showEditJournalDialog,
    editingJournal,
    editJournalTitle,
    editJournalText,
    isSavingJournal,
    showDeleteJournalDialog,
    deletingJournalId,
    showDeleteDocumentDialog,
    deletingDocumentId,

    // State setters
    setShowEditDialog,
    setShowDeleteDialog,
    setEditTitle,
    setEditingConversationId,
    setFolders,
    setShowFolderModal,
    setConversationToMoveToNewFolder,
    setShareConversationId,
    setShowEditJournalDialog,
    setEditingJournal,
    setEditJournalTitle,
    setEditJournalText,
    setShowDeleteJournalDialog,
    setDeletingJournalId,
    setShowDeleteDocumentDialog,
    setDeletingDocumentId,

    // Handlers
    handleChatClick,
    handleEditChat,
    handleSaveTitle,
    handleDeleteChat,
    handleConfirmDelete,
    handleMoveToFolder,
    handleCreateFolder,
    handleCreateFolderAndMove,
    handleJournalSaved,
    handleOpenEditJournal,
    handleSaveJournalEdit,
    handleRequestDeleteJournal,
    handleConfirmDeleteJournal,
    handleDocumentUploaded,
    handleRequestDeleteDocument,
    handleConfirmDeleteDocument,
    handleNewChat,
    formatFileSize,
  };
};
