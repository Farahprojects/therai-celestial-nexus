import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, FileText, BookOpen, Loader2, ChevronDown, ChevronUp, MessageSquare, BarChart3, SquarePen, Mic, ArrowRight, Copy, Download } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFolderAI, ParsedMessage } from '@/hooks/useFolderAI';
import { DraftDocument, saveDocumentDraft } from '@/services/folder-ai';
import { clearFolderAIHistory } from '@/services/folder-ai';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import TextareaAutosize from 'react-textarea-autosize';

// Same robust markdown stripping logic as Gemini LLM handler, but preserves line breaks
function sanitizePlainText(input: string): string {
  return (typeof input === "string" ? input : "")
    .replace(/```[\s\S]*?```/g, "") // code blocks
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/!\[[^\]]+\]\([^)]+\)/g, "") // images
    .replace(/\[[^\]]+\]\([^)]+\)/g, "$1") // links
    .replace(/[>_~#*]+/g, "") // md symbols (including bold/italic *)
    .replace(/-{3,}/g, "\n") // horizontal rules -> line break
    .replace(/[ \t]+/g, " ") // multiple spaces/tabs -> single space (preserve newlines)
    .replace(/\n{3,}/g, "\n\n") // multiple newlines -> double newline (paragraph break)
    .trim();
}

interface FolderAIPanelProps {
  isOpen: boolean;
  onClose: () => void;
  folderId: string;
  userId: string;
  folderName: string;
  onDocumentCreated?: () => void;
  onDocumentUpdated?: () => void;
  onOpenDocumentCanvas?: (draft: DraftDocument, documentId?: string) => void;
  initialMessage?: string; // Message to auto-send when panel opens
}

export const FolderAIPanel: React.FC<FolderAIPanelProps> = ({
  isOpen,
  onClose,
  folderId,
  userId,
  folderName,
  onDocumentCreated,
  onDocumentUpdated,
  onOpenDocumentCanvas,
  initialMessage
}) => {
  const [inputText, setInputText] = useState('');
  const [showFolderMap, setShowFolderMap] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasAutoSentInitialMessage = useRef(false);

  const {
    messages,
    folderContext,
    isLoading,
    isSending,
    error,
    sendMessage,
    continueWithDocuments,
    hasPendingDocumentRequest,
    loadMessages,
    refreshContext
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

  // Handle initial message - show in input when panel opens
  useEffect(() => {
    if (isOpen && initialMessage && !hasAutoSentInitialMessage.current) {
      hasAutoSentInitialMessage.current = true;
      setInputText(initialMessage);
      // Auto-send the message after a brief delay so user sees it first
      setTimeout(() => {
        if (hasPendingDocumentRequest) {
          continueWithDocuments(initialMessage);
        } else {
          sendMessage(initialMessage);
        }
        setInputText('');
      }, 500);
    }
    // Reset flag when panel closes
    if (!isOpen) {
      hasAutoSentInitialMessage.current = false;
      // Clear input when closing if it was from initial message
      if (initialMessage) {
        setInputText('');
      }
    }
  }, [isOpen, initialMessage, hasPendingDocumentRequest, sendMessage, continueWithDocuments]);

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
      toast.success('New conversation started');
    } catch (err: any) {
      console.error('[FolderAIPanel] Error clearing history:', err);
      toast.error('Failed to start new conversation');
    }
  };

  // Open document canvas only when user explicitly selects a draft
  const handleOpenDraft = (draft: DraftDocument, documentId?: string) => {
    onOpenDocumentCanvas?.(draft, documentId);
  };

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
        className="w-full sm:max-w-2xl p-0 flex flex-col [&>button]:hidden"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Header - Apple Style */}
        <SheetHeader className="flex flex-row items-center justify-between px-6 py-3.5 border-b border-gray-200/80 bg-white/80 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-gray-700" />
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
              <SquarePen className="w-3.5 h-3.5 text-gray-700" />
              <span className="text-[13px] font-medium text-gray-700">New</span>
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
                      <FileText className="w-3.5 h-3.5 text-gray-600" />
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
                      <BookOpen className="w-3.5 h-3.5 text-gray-600" />
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
                      <MessageSquare className="w-3.5 h-3.5 text-gray-600" />
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
                      <BarChart3 className="w-3.5 h-3.5 text-gray-600" />
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
                onDraftSelect={handleOpenDraft}
              />
            ))}

            {/* Sending indicator - Apple style */}
            {isSending && (
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-1">
                  <Sparkles className="w-3.5 h-3.5 text-gray-600" />
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

        {/* Input Area - Same as main chat */}
        <div className="bg-white backdrop-blur-lg p-2 relative shrink-0" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0.5rem)' }}>
          <div className="flex items-end gap-2 max-w-3xl mx-auto">
            <div className="flex-1 relative">
              <TextareaAutosize
                ref={inputRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={isSending ? "Thinking..." : "Ask Folder AI about this folder..."}
                disabled={isSending}
                className={`w-full px-4 py-2.5 pr-24 text-base font-light bg-white border-2 rounded-3xl focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400 resize-none text-black placeholder-gray-500 overflow-y-auto ${
                  isSending
                    ? 'border-gray-200 bg-gray-50 cursor-not-allowed' 
                    : 'border-gray-300'
                }`}
                style={{ fontSize: '16px' }} // Prevents zoom on iOS
                maxRows={4}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !isSending) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <div className="absolute right-1 inset-y-0 flex items-center gap-1 z-10" style={{ transform: 'translateY(-4px) translateX(-4px)' }}>
                <button 
                  className={`mic-button w-8 h-8 transition-all duration-200 ease-in-out flex items-center justify-center ${
                    isSending 
                      ? 'text-gray-300 cursor-not-allowed' 
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                  disabled={isSending}
                  title="Voice input (coming soon)"
                >
                  <Mic className="w-4 h-4" />
                </button>
                <button
                  onClick={handleSend}
                  disabled={isSending || !inputText.trim()}
                  className={`w-8 h-8 rounded-full transition-all duration-200 flex items-center justify-center ${
                    inputText.trim() && !isSending
                      ? 'bg-black hover:bg-gray-800 text-white'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                  title="Send message"
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
          
          {hasPendingDocumentRequest && (
            <div className="mt-2 text-xs text-gray-600 font-medium text-center">
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
  onDraftSelect?: (draft: DraftDocument, documentId?: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  folderId,
  userId,
  onDraftSelect
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

  // Apply markdown stripping to content preview (treat draft and update the same)
  const contentToShow = message.draft?.content || message.update?.content || '';
  const draftPreview = contentToShow
    ? (() => {
        const sanitized = sanitizePlainText(contentToShow);
        return sanitized.length > 1200
          ? `${sanitized.slice(0, 1200)}…`
          : sanitized;
      })()
    : '';

  return (
    <div className={cn('flex items-start gap-3', isUser && 'flex-row-reverse justify-start')}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-1">
          <Sparkles className="w-3.5 h-3.5 text-gray-600" />
        </div>
      )}
      
      <div className="flex-1 space-y-3 max-w-[85%]">
        {/* Text content - Apple style: plain AI, grey pill user */}
        {/* Hide generic plainText when there's a draft or update - show actual content instead */}
        {message.plainText && !message.draft && !message.update && (
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
              {isUser ? message.plainText : sanitizePlainText(message.plainText)}
            </p>
          </div>
        )}

        {/* Document content - appears inside chat with actions (treat draft and update the same) */}
        {(message.draft || message.update) && !isUser && (
          <div className="w-full rounded-2xl px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-gray-600" />
              <span className="text-[13px] font-semibold text-gray-900 truncate">
                {message.draft?.title || 'Document'}
              </span>
            </div>
            {draftPreview && (
              <div className="mt-2 text-sm text-gray-900 font-light whitespace-pre-wrap max-h-60 overflow-y-auto">
                {draftPreview}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const content = message.draft?.content || message.update?.content || '';
                    await navigator.clipboard.writeText(content);
                    toast.success('Content copied to clipboard');
                  } catch (err) {
                    console.error('[FolderAIPanel] Failed to copy:', err);
                    toast.error('Unable to copy right now');
                  }
                }}
                className="inline-flex items-center gap-1 rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <Copy className="w-3 h-3" />
                Copy
              </button>
              <button
                type="button"
                onClick={() => {
                  // Treat both draft and update the same - just open editor
                  if (message.draft) {
                    onDraftSelect?.(message.draft);
                  } else if (message.update) {
                    // Convert update to draft format for editor, pass documentId if updating
                    onDraftSelect?.({
                      title: 'Document',
                      content: message.update.content
                    }, message.update.documentId);
                  }
                }}
                className="inline-flex items-center gap-1 rounded-full bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 transition-colors"
              >
                <SquarePen className="w-3 h-3" />
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    const content = message.draft?.content || message.update?.content || '';
                    const title = message.draft?.title || 'folder-ai-document';
                    const blob = new Blob([content], {
                      type: 'text/markdown',
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    const safeTitle = title.trim();
                    a.download = safeTitle.endsWith('.md')
                      ? safeTitle
                      : `${safeTitle}.md`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                  } catch (err) {
                    console.error('[FolderAIPanel] Failed to download:', err);
                    toast.error('Unable to download right now');
                  }
                }}
                className="inline-flex items-center gap-1 rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <Download className="w-3 h-3" />
                Download
          </button>
            </div>
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

