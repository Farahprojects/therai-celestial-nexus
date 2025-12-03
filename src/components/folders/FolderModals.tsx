import React from 'react';
import { X } from 'lucide-react';
import { FolderModal } from './FolderModal';
import { ShareConversationModal } from '@/components/chat/ShareConversationModal';
import { ShareFolderModal } from '@/components/folders/ShareFolderModal';
import { AstroDataForm } from '@/components/chat/AstroDataForm';

interface FolderModalsProps {
  // Edit Title Dialog
  showEditDialog: boolean;
  editTitle: string;
  isSaving: boolean;
  onEditTitleChange: (title: string) => void;
  onSaveTitle: () => void;
  onCloseEditDialog: () => void;

  // Delete Chat Dialog
  showDeleteDialog: boolean;
  isDeleting: boolean;
  onConfirmDeleteChat: () => void;
  onCloseDeleteDialog: () => void;

  // Edit Journal Dialog
  showEditJournalDialog: boolean;
  editingJournal: { id: string; title?: string | null; entry_text: string } | null;
  editJournalTitle: string;
  editJournalText: string;
  isSavingJournal: boolean;
  onEditJournalTitleChange: (title: string) => void;
  onEditJournalTextChange: (text: string) => void;
  onSaveJournalEdit: () => void;
  onCloseEditJournalDialog: () => void;

  // Delete Journal Dialog
  showDeleteJournalDialog: boolean;
  onConfirmDeleteJournal: () => void;
  onCloseDeleteJournalDialog: () => void;

  // Delete Document Dialog
  showDeleteDocumentDialog: boolean;
  onConfirmDeleteDocument: () => void;
  onCloseDeleteDocumentDialog: () => void;

  // Folder Modal
  showFolderModal: boolean;
  conversationToMoveToNewFolder: string | null;
  onCreateFolder: (name: string) => void;
  onCloseFolderModal: () => void;

  // Share Conversation Modal
  shareConversationId: string | null;
  onCloseShareConversationModal: () => void;

  // Share Folder Modal
  showFolderShareModal: boolean;
  folderId: string;
  onCloseFolderShareModal: () => void;

  // Astro Form Modal
  showAstroForm: boolean;
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
  onAstroFormSubmit: (data: { chat_id?: string }) => void;
  onCloseAstroForm: () => void;
}

export const FolderModals: React.FC<FolderModalsProps> = ({
  showEditDialog,
  editTitle,
  isSaving,
  onEditTitleChange,
  onSaveTitle,
  onCloseEditDialog,
  showDeleteDialog,
  isDeleting,
  onConfirmDeleteChat,
  onCloseDeleteDialog,
  showEditJournalDialog,
  editJournalTitle,
  editJournalText,
  isSavingJournal,
  onEditJournalTitleChange,
  onEditJournalTextChange,
  onSaveJournalEdit,
  onCloseEditJournalDialog,
  showDeleteJournalDialog,
  onConfirmDeleteJournal,
  onCloseDeleteJournalDialog,
  showDeleteDocumentDialog,
  onConfirmDeleteDocument,
  onCloseDeleteDocumentDialog,
  showFolderModal,
  onCreateFolder,
  onCloseFolderModal,
  shareConversationId,
  onCloseShareConversationModal,
  showFolderShareModal,
  folderId,
  onCloseFolderShareModal,
  showAstroForm,
  folderProfile,
  onAstroFormSubmit,
  onCloseAstroForm,
}) => {
  return (
    <>
      {/* Edit Title Dialog */}
      {showEditDialog && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-6 bg-black/10 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Title</h3>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => onEditTitleChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onSaveTitle();
                } else if (e.key === 'Escape') {
                  onCloseEditDialog();
                }
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 mb-4"
              placeholder="Enter title"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={onCloseEditDialog}
                disabled={isSaving}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={onSaveTitle}
                disabled={isSaving}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Conversation Modal */}
      {shareConversationId && (
        <ShareConversationModal
          conversationId={shareConversationId}
          onClose={onCloseShareConversationModal}
        />
      )}

      {/* Share Folder Modal */}
      {showFolderShareModal && (
        <ShareFolderModal
          folderId={folderId}
          onClose={onCloseFolderShareModal}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-6 bg-black/10 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Delete Chat</h3>
            <p className="text-gray-600 mb-4">Are you sure you want to delete this chat? This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={onCloseDeleteDialog}
                disabled={isDeleting}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={onConfirmDeleteChat}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Journal Dialog */}
      {showEditJournalDialog && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-6 bg-black/10 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Journal Entry</h3>
            <div className="space-y-3">
              <input
                type="text"
                value={editJournalTitle}
                onChange={(e) => onEditJournalTitleChange(e.target.value)}
                placeholder="Title (optional)"
                disabled={isSavingJournal}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <textarea
                value={editJournalText}
                onChange={(e) => onEditJournalTextChange(e.target.value)}
                placeholder="Edit your entry..."
                disabled={isSavingJournal}
                rows={6}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={onCloseEditJournalDialog}
                disabled={isSavingJournal}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={onSaveJournalEdit}
                disabled={isSavingJournal}
                className="px-4 py-2 bg-gray-900 text-white rounded-full hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {isSavingJournal ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Journal Confirmation Dialog */}
      {showDeleteJournalDialog && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-6 bg-black/10 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Delete Journal Entry</h3>
            <p className="text-gray-600 mb-4">Are you sure you want to delete this journal entry? This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={onCloseDeleteJournalDialog}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirmDeleteJournal}
                className="px-4 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Document Confirmation Dialog */}
      {showDeleteDocumentDialog && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-6 bg-black/10 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Delete Document</h3>
            <p className="text-gray-600 mb-4">Are you sure you want to delete this document? This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={onCloseDeleteDocumentDialog}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirmDeleteDocument}
                className="px-4 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Folder Modal for Create New Folder */}
      {showFolderModal && (
        <FolderModal
          isOpen={showFolderModal}
          onClose={onCloseFolderModal}
          onCreateFolder={onCreateFolder}
          editingFolder={null}
        />
      )}

      {/* Astro Form Modal for Sync */}
      {showAstroForm && folderProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/10 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl">
            {/* Desktop close button - only show on non-mobile */}
            <button
              onClick={onCloseAstroForm}
              className="hidden sm:block absolute top-4 right-4 z-10 p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
            <AstroDataForm
              onClose={onCloseAstroForm}
              onSubmit={onAstroFormSubmit}
              mode="astro"
              preselectedType="sync"
              reportType={undefined}
              prefillPersonA={{
                name: folderProfile.name,
                birthDate: folderProfile.birth_date,
                birthTime: folderProfile.birth_time,
                birthLocation: folderProfile.birth_location,
                birthLatitude: folderProfile.birth_latitude ?? undefined,
                birthLongitude: folderProfile.birth_longitude ?? undefined,
                birthPlaceId: folderProfile.birth_place_id ?? undefined,
                timezone: folderProfile.timezone ?? undefined
              }}
            />
          </div>
        </div>
      )}
    </>
  );
};
