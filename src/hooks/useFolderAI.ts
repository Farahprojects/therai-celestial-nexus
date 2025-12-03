import { useState, useCallback, useEffect } from 'react';
import { safeConsoleError, safeConsoleWarn } from '@/utils/safe-logging';
import {
  sendMessageToFolderAI,
  getFolderAIMessages,
  getFolderContext,
  parseAIResponse,
  FolderAIMessage,
  FolderMap,
  DraftDocument,
  DocumentUpdate
} from '@/services/folder-ai';

export interface ParsedMessage extends FolderAIMessage {
  draft?: DraftDocument;
  update?: DocumentUpdate;
  requestDocuments?: { ids: string[]; reason: string };
  plainText: string;
}

export function useFolderAI(folderId: string | null, userId: string | null) {
  const [messages, setMessages] = useState<ParsedMessage[]>([]);
  const [folderContext, setFolderContext] = useState<FolderMap | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDocumentRequest, setPendingDocumentRequest] = useState<string[] | null>(null);

  // Load folder context
  const loadFolderContext = useCallback(async () => {
    if (!folderId) return;

    try {
      setIsLoading(true);
      setError(null);
      const context = await getFolderContext(folderId);
      setFolderContext(context);
    } catch (err: unknown) {
      safeConsoleError('[useFolderAI] Error loading context:', err);
      setError(err instanceof Error ? err.message : 'Failed to load folder context');
    } finally {
      setIsLoading(false);
    }
  }, [folderId]);

  // Load conversation history
  const loadMessages = useCallback(async () => {
    if (!folderId) return;

    try {
      setIsLoading(true);
      setError(null);
      const rawMessages = await getFolderAIMessages(folderId);
      
      // Parse messages for structured content
      const parsedMessages: ParsedMessage[] = rawMessages.map(msg => {
        try {
          if (msg.role === 'assistant') {
            const parsed = parseAIResponse(msg.content || '');
            return {
              ...msg,
              plainText: parsed.plainText || msg.content || '',
              draft: parsed.draft,
              update: parsed.update,
              requestDocuments: parsed.requestDocuments
            };
          }
          return {
            ...msg,
            plainText: msg.content || ''
          };
        } catch (err) {
          // Handle old message formats gracefully
          safeConsoleWarn('[useFolderAI] Error parsing message', err);
          return {
            ...msg,
            plainText: msg.content || '',
            draft: undefined,
            update: undefined,
            requestDocuments: undefined
          };
        }
      });

      setMessages(parsedMessages);
    } catch (err: unknown) {
      safeConsoleError('[useFolderAI] Error loading messages:', err);
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  }, [folderId]);

  // Send message to AI
  const sendMessage = useCallback(async (
    message: string,
    requestDocuments?: string[]
  ): Promise<void> => {
    if (!folderId || !userId || !message.trim()) return;

    try {
      setIsSending(true);
      setError(null);

      // Add user message optimistically
      const userMessage: ParsedMessage = {
        id: crypto.randomUUID(),
        folder_id: folderId,
        user_id: userId,
        role: 'user',
        content: message,
        plainText: message,
        metadata: {},
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, userMessage]);

      // Send to AI
      const response = await sendMessageToFolderAI(
        folderId,
        userId,
        message,
        requestDocuments
      );

      // If there's a tool call (document request), store it for next request
      if (response.tool_call && response.tool_call.type === 'fetch_documents') {
        setPendingDocumentRequest(response.tool_call.ids);
      } else {
        setPendingDocumentRequest(null);
      }

      // Parse AI response
      const parsed = parseAIResponse(response.text);

      // Add assistant message
      const assistantMessage: ParsedMessage = {
        id: crypto.randomUUID(),
        folder_id: folderId,
        user_id: userId,
        role: 'assistant',
        content: response.text,
        plainText: parsed.plainText,
        draft: parsed.draft,
        update: parsed.update,
        requestDocuments: parsed.requestDocuments,
        metadata: response.tool_call ? { tool_call: response.tool_call } : {},
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, assistantMessage]);

    } catch (err: unknown) {
      safeConsoleError('[useFolderAI] Error sending message:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
      
      // Add error message to chat
      const errorMessage: ParsedMessage = {
        id: crypto.randomUUID(),
        folder_id: folderId,
        user_id: userId,
        role: 'system',
        content: `Error: ${err.message}`,
        plainText: `Error: ${err.message}`,
        metadata: { error: true },
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
    }
  }, [folderId, userId]);

  // Continue conversation with fetched documents
  const continueWithDocuments = useCallback(async (message: string = "Please continue with the analysis.") => {
    if (!pendingDocumentRequest) return;

    await sendMessage(message, pendingDocumentRequest);
    setPendingDocumentRequest(null);
  }, [pendingDocumentRequest, sendMessage]);

  // Initialize on mount
  useEffect(() => {
    if (folderId && userId) {
      loadFolderContext();
      loadMessages();
    }
  }, [folderId, userId, loadFolderContext, loadMessages]);

  // Refresh context (after document changes)
  const refreshContext = useCallback(() => {
    loadFolderContext();
  }, [loadFolderContext]);

  return {
    messages,
    folderContext,
    isLoading,
    isSending,
    error,
    sendMessage,
    continueWithDocuments,
    refreshContext,
    hasPendingDocumentRequest: !!pendingDocumentRequest,
    pendingDocumentRequest,
    loadMessages
  };
}

