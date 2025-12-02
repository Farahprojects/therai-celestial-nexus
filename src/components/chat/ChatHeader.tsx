import React, { useState } from 'react';
import { Share2, HelpCircle } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useChatStore } from '@/core/store';
import { NewChatButton } from './NewChatButton';
import { ChatMenuButton } from './ChatMenuButton';
import { ShareConversationModal } from './ShareConversationModal';
import { ShareFolderModal } from '@/components/folders/ShareFolderModal';
import { ChatCreationProvider } from '@/components/chat/ChatCreationProvider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export const ChatHeader: React.FC = () => {
  const { chat_id, viewMode, selectedFolderId } = useChatStore();
  const { folderId: urlFolderId } = useParams<{ folderId?: string }>();
  const [showShareModal, setShowShareModal] = useState(false);
  const [showFolderShareModal, setShowFolderShareModal] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  
  return (
    <>
      <ChatCreationProvider>
        <div className="flex items-center justify-between px-4 py-3 bg-white">
          <div className="max-w-3xl mx-auto w-full flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* New Chat Button */}
              <NewChatButton isFolderView={viewMode === 'folder'} />
            </div>

            <div className="flex items-center gap-2">
              {/* Share and Help buttons - Show when in folder view */}
              {viewMode === 'folder' && (selectedFolderId || urlFolderId) && (
                <>
                  <button
                    onClick={() => setShowFolderShareModal(true)}
                    className="flex items-center justify-center w-8 h-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                    title="Share folder"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowHelpDialog(true)}
                    className="flex items-center justify-center w-8 h-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                    title="Help"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                </>
              )}
              
              {/* Hide top-right share/menu when viewing a folder to avoid confusion */}
              {viewMode !== 'folder' && (
                <>
                  {/* Share Button - Chat only when not in folder view */}
                  <button
                    onClick={() => {
                      if (chat_id) {
                        setShowShareModal(true);
                      }
                    }}
                    disabled={!chat_id}
                    className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                      chat_id
                        ? 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                        : 'text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    <Share2 className="w-4 h-4" />
                  </button>

                  {/* 3 Dots Menu */}
                  <ChatMenuButton />
                </>
              )}
            </div>
          </div>
        </div>
      </ChatCreationProvider>

      {/* Share Modal */}
      {showShareModal && chat_id && (
        <ShareConversationModal
          conversationId={chat_id}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/* Folder Share Modal */}
      {showFolderShareModal && (selectedFolderId || urlFolderId) && (
        <ShareFolderModal
          folderId={selectedFolderId || urlFolderId || ''}
          onClose={() => setShowFolderShareModal(false)}
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
    </>
  );
};