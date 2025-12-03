import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FolderProfileSetup } from './FolderProfileSetup';
import { JournalEntryModal } from './JournalEntryModal';
import { DocumentUploadModal } from './DocumentUploadModal';
import { InsightsModal } from '@/components/insights/InsightsModal';
import { ReportSlideOver } from '@/components/report-viewer/ReportSlideOver';
import { FolderAIPanel } from '@/components/folders/FolderAIPanel';
import { FolderAIDocumentCanvas } from '@/components/folders/FolderAIDocumentCanvas';
import { saveDocumentDraft, DraftDocument } from '@/services/folder-ai';
import { safeConsoleError } from '@/utils/safe-logging';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

// Hooks
import { useFolderData } from './hooks/useFolderData';
import { useFolderActions } from './hooks/useFolderActions';

// Components
import { FolderHeader } from './FolderHeader';
import { JournalSection } from './JournalSection';
import { DocumentsSection } from './DocumentsSection';
import { ConversationsSection } from './ConversationsSection';
import { FolderFooter } from './FolderFooter';
import { FolderModals } from './FolderModals';

interface FolderViewProps {
  folderId: string;
  onChatClick: (chatId: string) => void;
}
export const FolderView: React.FC<FolderViewProps> = ({
  folderId,
  onChatClick
}) => {
  const { user } = useAuth();

  // Data management hook
  const {
    conversations,
    journals,
    documents,
    folderName,
    folderProfileId,
    folderProfile,
    hasProfileSetup,
    folders,
    isLoading,
    error,
    loadFolderData,
    updateConversations,
    updateJournals,
    updateDocuments,
    upsertConversation,
  } = useFolderData(folderId);

  // Actions hook
  const {
    showEditDialog,
    showDeleteDialog,
    isDeleting,
    isSaving,
    editTitle,
    showFolderModal,
    conversationToMoveToNewFolder,
    shareConversationId,
    showEditJournalDialog,
    editingJournal,
    editJournalTitle,
    editJournalText,
    isSavingJournal,
    showDeleteJournalDialog,
    showDeleteDocumentDialog,
    setShowEditDialog,
    setShowDeleteDialog,
    setEditTitle,
    setEditingConversationId,
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
    handleChatClick: actionsHandleChatClick,
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
  } = useFolderActions({
    folderId,
    folderName,
    conversations,
    journals,
    documents,
    updateConversations,
    updateJournals,
    updateDocuments,
    upsertConversation,
    loadFolderData,
    onChatClick,
  });

  // Additional modal states
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showInsightsModal, setShowInsightsModal] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [showAstroForm, setShowAstroForm] = useState(false);
  const [showFolderShareModal, setShowFolderShareModal] = useState(false);

  // Document viewer state
  const [viewingDocumentId, setViewingDocumentId] = useState<string | null>(null);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);

  // Folder AI state
  const [showFolderAI, setShowFolderAI] = useState(false);
  const [showDocumentCanvas, setShowDocumentCanvas] = useState(false);
  const [currentDraft, setCurrentDraft] = useState<DraftDocument | null>(null);
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [folderAIMessage, setFolderAIMessage] = useState<string>('');
  // Additional handlers
  const handleProfileLinked = async () => {
    // Reload all folder data to update the folder name in the UI
    await loadFolderData();
  };

  const handleAstroFormSubmit = async (data: { chat_id?: string }) => {
    if (!data.chat_id) return;

    // Move conversation to folder if it's not already there
    try {
      const { moveConversationToFolder } = await import('@/services/folders');
      await moveConversationToFolder(data.chat_id, folderId);
      await loadFolderData();
      setShowAstroForm(false);
      onChatClick(data.chat_id);
    } catch (error) {
      safeConsoleError('[FolderView] Failed to move conversation to folder', error);
      toast.error('Failed to add conversation to folder');
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
    {/* Folder Header */}
    <FolderHeader
      folderName={folderName}
      folderId={folderId}
      onJournalClick={() => setShowJournalModal(true)}
      onInsightsClick={() => setShowInsightsModal(true)}
      onUploadClick={() => setShowUploadModal(true)}
      onNewChatClick={handleNewChat}
      onCompatibilityClick={() => {
        if (!folderProfile || !folderProfileId) {
          toast.error('Please set up your profile for this folder first');
          return;
        }
        setShowAstroForm(true);
      }}
    />

    {/* Profile Setup Banner */}
    {user && !hasProfileSetup && (
      <div className="px-6">
        <FolderProfileSetup
          folderId={folderId}
          folderName={folderName}
          onProfileLinked={handleProfileLinked}
        />
      </div>
    )}

    {/* Journal Section */}
    <JournalSection
      journals={journals}
      onEditJournal={handleOpenEditJournal}
      onDeleteJournal={handleRequestDeleteJournal}
    />

    {/* Documents Section */}
    <DocumentsSection
      documents={documents}
      formatFileSize={formatFileSize}
      onViewDocument={(documentId) => {
        setViewingDocumentId(documentId);
        setEditingDocumentId(null);
      }}
      onEditDocument={(documentId) => {
        setViewingDocumentId(documentId);
        setEditingDocumentId(documentId);
      }}
      onDeleteDocument={handleRequestDeleteDocument}
    />

    {/* Conversations Section */}
    <div className="flex-1 overflow-y-auto">
      <ConversationsSection
        conversations={conversations}
        folders={folders}
        currentFolderId={folderId}
        onChatClick={actionsHandleChatClick}
        onEditChat={handleEditChat}
        onDeleteChat={handleDeleteChat}
        onShareChat={(id) => setShareConversationId(id)}
        onMoveToFolder={handleMoveToFolder}
        onCreateFolder={handleCreateFolderAndMove}
      />
    </div>

    {/* Folder Modals */}
    <FolderModals
      showEditDialog={showEditDialog}
      editTitle={editTitle}
      isSaving={isSaving}
      onEditTitleChange={setEditTitle}
      onSaveTitle={handleSaveTitle}
      onCloseEditDialog={() => {
        setShowEditDialog(false);
        setEditingConversationId(null);
      }}
      showDeleteDialog={showDeleteDialog}
      isDeleting={isDeleting}
      onConfirmDeleteChat={handleConfirmDelete}
      onCloseDeleteDialog={() => {
        setShowDeleteDialog(false);
        setEditingConversationId(null);
      }}
      showEditJournalDialog={showEditJournalDialog}
      editingJournal={editingJournal}
      editJournalTitle={editJournalTitle}
      editJournalText={editJournalText}
      isSavingJournal={isSavingJournal}
      onEditJournalTitleChange={setEditJournalTitle}
      onEditJournalTextChange={setEditJournalText}
      onSaveJournalEdit={handleSaveJournalEdit}
      onCloseEditJournalDialog={() => {
        setShowEditJournalDialog(false);
        setEditingJournal(null);
      }}
      showDeleteJournalDialog={showDeleteJournalDialog}
      onConfirmDeleteJournal={handleConfirmDeleteJournal}
      onCloseDeleteJournalDialog={() => {
        setShowDeleteJournalDialog(false);
        setDeletingJournalId(null);
      }}
      showDeleteDocumentDialog={showDeleteDocumentDialog}
      onConfirmDeleteDocument={handleConfirmDeleteDocument}
      onCloseDeleteDocumentDialog={() => {
        setShowDeleteDocumentDialog(false);
        setDeletingDocumentId(null);
      }}
      showFolderModal={showFolderModal}
      conversationToMoveToNewFolder={conversationToMoveToNewFolder}
      onCreateFolder={handleCreateFolder}
      onCloseFolderModal={() => {
        setShowFolderModal(false);
        setConversationToMoveToNewFolder(null);
      }}
      shareConversationId={shareConversationId}
      onCloseShareConversationModal={() => setShareConversationId(null)}
      showFolderShareModal={showFolderShareModal}
      folderId={folderId}
      onCloseFolderShareModal={() => setShowFolderShareModal(false)}
      showAstroForm={showAstroForm}
      folderProfile={folderProfile}
      onAstroFormSubmit={handleAstroFormSubmit}
      onCloseAstroForm={() => setShowAstroForm(false)}
    />

    {/* Journal Entry Modal */}
    {user && (
      <JournalEntryModal
        isOpen={showJournalModal}
        onClose={() => setShowJournalModal(false)}
        folderId={folderId}
        userId={user.id}
        onEntrySaved={handleJournalSaved}
      />
    )}

    {/* Document Upload Modal */}
    {user && (
      <DocumentUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        folderId={folderId}
        userId={user.id}
        onUploadComplete={handleDocumentUploaded}
      />
    )}

    {/* Insights Modal */}
    <InsightsModal
      isOpen={showInsightsModal}
      onClose={() => setShowInsightsModal(false)}
      folderId={folderId}
      profileData={folderProfile}
      onReportReady={loadFolderData}
      onReportCreated={(conversation) => {
        if (!conversation?.id) return;
        upsertConversation({
          id: conversation.id,
          title: conversation.title || 'Insights',
          updated_at: new Date().toISOString(),
          mode: conversation.mode || 'insight'
        });
      }}
    />

    {/* Document Viewer Slide-Over */}
    <ReportSlideOver
      isOpen={!!viewingDocumentId}
      onClose={() => {
        setViewingDocumentId(null);
        setEditingDocumentId(null);
      }}
      documentId={viewingDocumentId || undefined}
      documentEditMode={editingDocumentId === viewingDocumentId}
    />

    {/* Folder AI Panel */}
    {user && (
      <FolderAIPanel
        isOpen={showFolderAI}
        onClose={() => {
          setShowFolderAI(false);
          setFolderAIMessage('');
        }}
        folderId={folderId}
        userId={user.id}
        folderName={folderName}
        onOpenDocumentCanvas={(draft, docId) => {
          setCurrentDraft(draft);
          setCurrentDocumentId(docId ?? null);
          setShowDocumentCanvas(true);
        }}
        initialMessage={folderAIMessage || undefined}
      />
    )}

    {/* Folder Footer */}
    <FolderFooter
      folderAIMessage={folderAIMessage}
      showFolderAI={showFolderAI}
      onMessageChange={setFolderAIMessage}
      onSendMessage={() => setShowFolderAI(true)}
    />

    {/* Document Canvas */}
    {user && showDocumentCanvas && (
      <FolderAIDocumentCanvas
        isOpen={showDocumentCanvas}
        onClose={() => {
          setShowDocumentCanvas(false);
          setCurrentDraft(null);
          setCurrentDocumentId(null);
        }}
        draft={currentDraft}
        documentId={currentDocumentId || undefined}
        onSave={async (title, content, docId) => {
          if (!folderId || !user.id) return;
          try {
            setIsSavingDraft(true);
            await saveDocumentDraft(folderId, user.id, title, content, docId);
            toast.success(docId ? 'Document updated' : 'Document saved to folder');
            setShowDocumentCanvas(false);
            setCurrentDraft(null);
            setCurrentDocumentId(null);
            handleDocumentUploaded();
          } catch (error) {
            safeConsoleError('[FolderView] Error saving document', error);
            toast.error('Failed to save document');
          } finally {
            setIsSavingDraft(false);
          }
        }}
        isSaving={isSavingDraft}
      />
    )}

    {/* Help Dialog */}
    <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-light">Folder Features</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4 text-sm font-light text-gray-700">
          <div>
            <h4 className="font-normal text-gray-900 mb-1">Folder AI</h4>
            <p>Your AI knowledge worker. Ask it to analyze documents, create summaries, or generate new content based on your folder's data.</p>
          </div>
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