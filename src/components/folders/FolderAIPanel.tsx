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
        {/* Header - Apple Style */}
        <SheetHeader className="flex flex-row items-center justify-between px-6 py-3.5 border-b border-gray-200/80 bg-white/80 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-[#007AFF]" />
            <SheetTitle className="text-[17px] font-semibold text-gray-900 tracking-tight">Folder AI</SheetTitle>
          </div>
          <div className="flex items-center gap-1.5">
            {/* New Chat Button - Pill shaped */}
            <button
              onClick={handleNewChat}
              disabled={isSending || messages.length === 0}
              className="px-3 py-1.5 hover:bg-gray-100/80 rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              title="Start new conversation"
            >
              <SquarePen className="w-3.5 h-3.5 text-[#007AFF]" />
              <span className="text-[13px] font-medium text-[#007AFF]">New</span>
            </button>
            {/* Close Button - Pill shaped */}
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center hover:bg-gray-100/80 rounded-full transition-all"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </SheetHeader>

        {/* Folder Map (Collapsible) - Apple Style */}
        {folderContext && (
          <div className="border-b border-gray-200/60 bg-white/50 shrink-0">
            <button
              onClick={() => setShowFolderMap(!showFolderMap)}
              className="w-full px-6 py-2.5 flex items-center justify-between hover:bg-gray-50/80 transition-all"
            >
              <span className="text-[13px] font-medium text-gray-700 tracking-tight">
                Folder Contents ({
                  folderContext.documents.length + 
                  folderContext.journals.length + 
                  folderContext.conversations.length + 
                  folderContext.reports.length
                } items)
              </span>
              {showFolderMap ? (
                <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
              )}
            </button>
            
            {showFolderMap && (
              <div className="px-6 pb-4 space-y-3.5">
                {/* Documents - Apple Style */}
                {folderContext.documents.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#007AFF]" />
                      <span className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">Documents</span>
                    </div>
                    <div className="space-y-0.5">
                      {folderContext.documents.slice(0, 5).map((doc) => (
                        <div key={doc.id} className="text-[13px] text-gray-700 font-normal pl-5">
                          {doc.file_name}
                        </div>
                      ))}
                      {folderContext.documents.length > 5 && (
                        <div className="text-[12px] text-gray-500 font-medium pl-5 mt-1">
                          +{folderContext.documents.length - 5} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Journals - Apple Style */}
                {folderContext.journals.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-[#007AFF]" />
                      <span className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">Journals</span>
                    </div>
                    <div className="space-y-0.5">
                      {folderContext.journals.slice(0, 5).map((journal) => (
                        <div key={journal.id} className="text-[13px] text-gray-700 font-normal pl-5">
                          {journal.title || 'Untitled'}
                        </div>
                      ))}
                      {folderContext.journals.length > 5 && (
                        <div className="text-[12px] text-gray-500 font-medium pl-5 mt-1">
                          +{folderContext.journals.length - 5} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Conversations - Apple Style */}
                {folderContext.conversations.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-[#007AFF]" />
                      <span className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">Chats</span>
                    </div>
                    <div className="space-y-0.5">
                      {folderContext.conversations.slice(0, 5).map((conv) => (
                        <div key={conv.id} className="text-[13px] text-gray-700 font-normal pl-5">
                          {conv.title || 'Untitled'}
                        </div>
                      ))}
                      {folderContext.conversations.length > 5 && (
                        <div className="text-[12px] text-gray-500 font-medium pl-5 mt-1">
                          +{folderContext.conversations.length - 5} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Reports - Apple Style */}
                {folderContext.reports.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <BarChart3 className="w-3.5 h-3.5 text-[#007AFF]" />
                      <span className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">Reports</span>
                    </div>
                    <div className="space-y-0.5">
                      {folderContext.reports.slice(0, 5).map((report) => (
                        <div key={report.id} className="text-[13px] text-gray-700 font-normal pl-5">
                          {report.report_type || 'Insight'}
                        </div>
                      ))}
                      {folderContext.reports.length > 5 && (
                        <div className="text-[12px] text-gray-500 font-medium pl-5 mt-1">
                          +{folderContext.reports.length - 5} more
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

            {/* Sending indicator - Apple style */}
            {isSending && (
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-[#007AFF]/10 flex items-center justify-center shrink-0 mt-1">
                  <Sparkles className="w-3.5 h-3.5 text-[#007AFF]" />
                </div>
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  <span className="text-[15px] text-gray-500 font-light">Thinking...</span>
                </div>
              </div>
            )}

            {/* Error message - Apple style */}
            {error && (
              <div className="bg-red-50/80 border border-red-200/60 rounded-2xl px-4 py-3">
                <p className="text-[13px] text-red-700 font-medium">{error}</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area - Apple Style with pill-shaped input */}
        <div className="border-t border-gray-200/60 bg-white/80 backdrop-blur-xl px-4 py-3 shrink-0">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything..."
                disabled={isSending}
                rows={1}
                className="w-full resize-none rounded-[20px] border-2 border-gray-300/80 px-4 py-2.5 text-[15px] font-normal focus:outline-none focus:ring-0 focus:border-[#007AFF] disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 transition-all"
                style={{ minHeight: '40px', maxHeight: '120px', fontSize: '15px' }}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || isSending}
              className="w-9 h-9 rounded-full bg-[#007AFF] hover:bg-[#0051D5] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all shrink-0"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Send className="w-4 h-4 text-white" />
              )}
            </button>
          </div>
          
          {hasPendingDocumentRequest && (
            <div className="mt-2 text-xs text-gray-600 font-medium">
              Waiting for documents...
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
        <div className="bg-gray-100/60 rounded-full px-4 py-1.5 text-xs text-gray-600 font-medium">
          {message.plainText}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex items-start gap-3', isUser && 'flex-row-reverse justify-start')}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-[#007AFF]/10 flex items-center justify-center shrink-0 mt-1">
          <Sparkles className="w-3.5 h-3.5 text-[#007AFF]" />
        </div>
      )}
      
      <div className="flex-1 space-y-3 max-w-[85%]">
        {/* Text content - Apple style: plain AI, grey pill user */}
        {message.plainText && (
          <div
            className={cn(
              isUser
                ? 'bg-[#E5E5EA] text-gray-900 rounded-[20px] px-4 py-2.5 inline-block ml-auto'
                : 'text-gray-900 leading-relaxed'
            )}
          >
            <p className={cn(
              'text-[15px] whitespace-pre-wrap',
              isUser ? 'font-normal' : 'font-light tracking-tight'
            )}>
              {message.plainText}
            </p>
          </div>
        )}

        {/* Draft indicator - Apple style */}
        {message.draft && !isUser && (
          <div className="rounded-2xl bg-[#007AFF]/5 border border-[#007AFF]/20 px-4 py-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#007AFF]" />
              <span className="text-[13px] font-semibold text-gray-900">{message.draft.title}</span>
            </div>
            <p className="text-xs text-gray-600 mt-1 font-medium">
              Open in left panel to review
            </p>
          </div>
        )}

        {/* Update indicator - Apple style */}
        {message.update && !isUser && (
          <div className="rounded-2xl bg-[#007AFF]/5 border border-[#007AFF]/20 px-4 py-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#007AFF]" />
              <span className="text-[13px] font-semibold text-gray-900">Proposed Update</span>
            </div>
            <p className="text-xs text-gray-600 mt-1 font-medium">
              Review changes in panel
            </p>
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-7 h-7 rounded-full bg-gray-300/60 flex items-center justify-center shrink-0 mt-1">
          <span className="text-[11px] font-semibold text-gray-700">You</span>
        </div>
      )}
    </div>
  );
};

