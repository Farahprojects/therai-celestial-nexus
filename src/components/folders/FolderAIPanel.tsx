import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, FileText, BookOpen, Loader2, ChevronDown, ChevronUp, MessageSquare, BarChart3, SquarePen } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFolderAI, ParsedMessage } from '@/hooks/useFolderAI';
import { DraftDocument } from '@/services/folder-ai';
import { clearFolderAIHistory } from '@/services/folder-ai';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface FolderAIPanelProps {
  isOpen: boolean;
  onClose: () => void;
  folderId: string;
  userId: string;
  folderName: string;
  onDocumentCreated?: () => void;
  onDocumentUpdated?: () => void;
  currentDraft: DraftDocument | null;
  onDraftChange: (draft: DraftDocument | null) => void;
  onOpenDocumentCanvas: () => void;
}

export const FolderAIPanel: React.FC<FolderAIPanelProps> = ({
  isOpen,
  onClose,
  folderId,
  userId,
  folderName,
  onDocumentCreated,
  onDocumentUpdated,
  currentDraft,
  onDraftChange,
  onOpenDocumentCanvas
}) => {
  const [inputText, setInputText] = useState('');
  const [showFolderMap, setShowFolderMap] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    folderContext,
    isLoading,
    isSending,
    error,
    sendMessage,
    continueWithDocuments,
    refreshContext,
    hasPendingDocumentRequest,
    loadMessages
  } = useFolderAI(isOpen ? folderId : null, isOpen ? userId : null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!inputText.trim() || isSending) return;

    const message = inputText.trim();
    setInputText('');

    // If there's a pending document request, continue with it
    if (hasPendingDocumentRequest) {
      await continueWithDocuments(message);
    } else {
      await sendMessage(message);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };


  const handleNewChat = async () => {
    if (!folderId) return;
    
    try {
      await clearFolderAIHistory(folderId);
      // Reload messages (will be empty now)
      await loadMessages();
      // Close document canvas if open
      onDraftChange(null);
      toast.success('New conversation started');
    } catch (err: any) {
      console.error('[FolderAIPanel] Error clearing history:', err);
      toast.error('Failed to start new conversation');
    }
  };

  // Auto-open document canvas when AI creates a draft
  useEffect(() => {
    // Find the most recent assistant message with a draft
    const recentDraftMessage = messages
      .slice()
      .reverse()
      .find(msg => msg.role === 'assistant' && msg.draft);

    if (recentDraftMessage?.draft && !currentDraft) {
      onDraftChange(recentDraftMessage.draft);
      onOpenDocumentCanvas();
    }
  }, [messages, currentDraft, onDraftChange, onOpenDocumentCanvas]);

  // Get initial greeting message
  const getGreetingMessage = (): string => {
    if (!folderContext) return 'Loading folder context...';
    
    const docCount = folderContext.documents.length;
    const journalCount = folderContext.journals.length;
    const convCount = folderContext.conversations.length;
    const reportCount = folderContext.reports.length;
    const totalItems = docCount + journalCount + convCount + reportCount;
    
    return `I'm ready to work in **${folderName}**. I can see ${totalItems} items: ${docCount} document${docCount !== 1 ? 's' : ''}, ${journalCount} journal entr${journalCount !== 1 ? 'ies' : 'y'}, ${convCount} conversation${convCount !== 1 ? 's' : ''}, and ${reportCount} report${reportCount !== 1 ? 's' : ''}. How can I help you today?`;
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-2xl p-0 flex flex-col"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Header */}
        <SheetHeader className="flex flex-row items-center justify-between px-6 py-4 border-b bg-white shrink-0">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <SheetTitle className="text-lg font-medium text-gray-900">Folder AI</SheetTitle>
          </div>
          <div className="flex items-center gap-2">
            {/* New Chat Button */}
            <button
              onClick={handleNewChat}
              disabled={isSending || messages.length === 0}
              className="p-1.5 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Start new conversation"
            >
              <SquarePen className="w-4 h-4 text-purple-600" />
            </button>
            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </SheetHeader>

        {/* Folder Map (Collapsible) */}
        {folderContext && (
          <div className="border-b bg-gray-50 shrink-0">
            <button
              onClick={() => setShowFolderMap(!showFolderMap)}
              className="w-full px-6 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors"
            >
              <span className="text-sm font-medium text-gray-700">
                Folder Contents ({
                  folderContext.documents.length + 
                  folderContext.journals.length + 
                  folderContext.conversations.length + 
                  folderContext.reports.length
                } items)
              </span>
              {showFolderMap ? (
                <ChevronUp className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              )}
            </button>
            
            {showFolderMap && (
              <div className="px-6 pb-4 space-y-3">
                {/* Documents */}
                {folderContext.documents.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-gray-500" />
                      <span className="text-xs font-medium text-gray-600 uppercase">Documents</span>
                    </div>
                    <div className="space-y-1">
                      {folderContext.documents.slice(0, 5).map((doc) => (
                        <div key={doc.id} className="text-xs text-gray-600 pl-6">
                          • {doc.file_name}
                        </div>
                      ))}
                      {folderContext.documents.length > 5 && (
                        <div className="text-xs text-gray-500 pl-6">
                          + {folderContext.documents.length - 5} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Journals */}
                {folderContext.journals.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen className="w-4 h-4 text-gray-500" />
                      <span className="text-xs font-medium text-gray-600 uppercase">Journal Entries</span>
                    </div>
                    <div className="space-y-1">
                      {folderContext.journals.slice(0, 5).map((journal) => (
                        <div key={journal.id} className="text-xs text-gray-600 pl-6">
                          • {journal.title || 'Untitled'}
                        </div>
                      ))}
                      {folderContext.journals.length > 5 && (
                        <div className="text-xs text-gray-500 pl-6">
                          + {folderContext.journals.length - 5} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Conversations */}
                {folderContext.conversations.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="w-4 h-4 text-gray-500" />
                      <span className="text-xs font-medium text-gray-600 uppercase">Conversations</span>
                    </div>
                    <div className="space-y-1">
                      {folderContext.conversations.slice(0, 5).map((conv) => (
                        <div key={conv.id} className="text-xs text-gray-600 pl-6">
                          • {conv.title || 'Untitled'} {conv.mode && `(${conv.mode})`}
                        </div>
                      ))}
                      {folderContext.conversations.length > 5 && (
                        <div className="text-xs text-gray-500 pl-6">
                          + {folderContext.conversations.length - 5} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Reports */}
                {folderContext.reports.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 className="w-4 h-4 text-gray-500" />
                      <span className="text-xs font-medium text-gray-600 uppercase">Reports/Insights</span>
                    </div>
                    <div className="space-y-1">
                      {folderContext.reports.slice(0, 5).map((report) => (
                        <div key={report.id} className="text-xs text-gray-600 pl-6">
                          • {report.report_type || 'Insight'}
                        </div>
                      ))}
                      {folderContext.reports.length > 5 && (
                        <div className="text-xs text-gray-500 pl-6">
                          + {folderContext.reports.length - 5} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Messages Area */}
        <ScrollArea className="flex-1 px-6 py-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {/* Initial greeting */}
            {messages.length === 0 && !isLoading && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                </div>
                <div className="flex-1 bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{getGreetingMessage()}</p>
                </div>
              </div>
            )}

            {/* Loading state */}
            {isLoading && messages.length === 0 && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            )}

            {/* Messages */}
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                folderId={folderId}
                userId={userId}
              />
            ))}

            {/* Sending indicator */}
            {isSending && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                </div>
                <div className="flex-1 bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    <span className="text-sm text-gray-500">Thinking...</span>
                  </div>
                </div>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="border-t bg-white px-6 py-4 shrink-0">
          <div className="flex items-end gap-3">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me to analyze, create, or update documents..."
              disabled={isSending}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
            <Button
              onClick={handleSend}
              disabled={!inputText.trim() || isSending}
              className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white px-4 h-11"
            >
              {isSending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
          
          {hasPendingDocumentRequest && (
            <div className="mt-2 text-xs text-gray-500">
              AI is waiting to fetch documents. Send a message to continue.
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

// Message Bubble Component
interface MessageBubbleProps {
  message: ParsedMessage;
  folderId: string;
  userId: string;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  folderId,
  userId
}) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="bg-gray-100 rounded-lg px-3 py-2 text-xs text-gray-600">
          {message.plainText}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex items-start gap-3', isUser && 'flex-row-reverse')}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-purple-600" />
        </div>
      )}
      
      <div className="flex-1 space-y-3">
        {/* Text content */}
        {message.plainText && (
          <div
            className={cn(
              'rounded-2xl px-4 py-3',
              isUser
                ? 'bg-purple-600 text-white rounded-tr-sm ml-8'
                : 'bg-gray-50 text-gray-700 rounded-tl-sm'
            )}
          >
            <p className="text-sm whitespace-pre-wrap">{message.plainText}</p>
          </div>
        )}

        {/* Draft indicator - actual preview shown in left canvas */}
        {message.draft && !isUser && (
          <div className="rounded-lg bg-purple-50 border border-purple-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-900">{message.draft.title}</span>
            </div>
            <p className="text-xs text-purple-600 mt-1">
              Document ready to review in left panel
            </p>
          </div>
        )}

        {/* Update indicator */}
        {message.update && !isUser && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Proposed Update</span>
            </div>
            <p className="text-xs text-blue-600 mt-1">
              Changes ready to review
            </p>
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
          <span className="text-xs font-medium text-gray-600">You</span>
        </div>
      )}
    </div>
  );
};

