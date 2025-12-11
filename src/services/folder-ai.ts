import { supabase } from '@/integrations/supabase/client';
import { safeConsoleError } from '@/utils/safe-logging';
export interface FolderAIMessage {
  id: string;
  folder_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface FolderMap {
  documents: {
    id: string;
    file_name: string;
    file_type: string;
    file_extension: string;
    created_at: string;
  }[];
  journals: {
    id: string;
    title: string | null;
    created_at: string;
  }[];
  conversations: {
    id: string;
    title: string | null;
    mode: string | null;
    created_at: string | null;
  }[];
  reports: {
    id: string;
    chat_id: string | null;
    report_type: string | null;
    created_at: string | null;
    status: string | null;
  }[];
  folderName: string;
}

export interface FolderAIResponse {
  text: string;
  tool_call?: {
    type: string;
    ids: string[];
    reason: string;
  };
  request_id: string;
  latency_ms: number;
}

export interface DraftDocument {
  title: string;
  content: string;
  messageId?: string;
}

export interface DocumentUpdate {
  documentId: string;
  changeType: 'overwrite' | 'append' | 'revision';
  content: string;
  messageId?: string;
}

/**
 * Send a message to the Folder AI
 */
export async function sendMessageToFolderAI(
  folderId: string,
  userId: string,
  message: string,
  requestDocuments?: string[]
): Promise<FolderAIResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('folder-ai-handler', {
      body: {
        folder_id: folderId,
        user_id: userId,
        message,
        request_documents: requestDocuments
      }
    });

    if (error) {
      throw new Error(error.message || 'Failed to send message to Folder AI');
    }

    return data as FolderAIResponse;
  } catch (err) {
    safeConsoleError('[FolderAI] Error sending message:', err);
    throw err;
  }
}

/**
 * Get conversation history for a folder
 */
export async function getFolderAIMessages(folderId: string): Promise<FolderAIMessage[]> {
  try {
    const { data, error } = await supabase
      .from('folder_ai_messages')
      .select('*')
      .eq('folder_id', folderId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(error.message || 'Failed to fetch messages');
    }

    return (data || []) as unknown as FolderAIMessage[];
  } catch (err) {
    safeConsoleError('[FolderAI] Error fetching messages:', err);
    throw err;
  }
}

/**
 * Build folder context map (for initial display)
 */
export async function getFolderContext(folderId: string): Promise<FolderMap> {
  try {
    // Get folder details
    const { data: folder, error: folderError } = await supabase
      .from('chat_folders')
      .select('name')
      .eq('id', folderId)
      .single();

    if (folderError) throw folderError;

    // Get documents
    const { data: documents, error: docsError } = await supabase
      .from('folder_documents')
      .select('id, file_name, file_type, file_extension, created_at')
      .eq('folder_id', folderId)
      .eq('upload_status', 'completed')
      .order('created_at', { ascending: false });

    if (docsError) throw docsError;

    // Get journals
    const { data: journals, error: journalsError } = await supabase
      .from('journal_entries')
      .select('id, title, created_at')
      .eq('folder_id', folderId)
      .order('created_at', { ascending: false });

    if (journalsError) throw journalsError;

    // Get conversations
    const { data: conversations, error: convsError } = await supabase
      .from('conversations')
      .select('id, title, mode, created_at')
      .eq('folder_id', folderId)
      .neq('mode', 'profile') // Exclude internal profile conversations
      .order('created_at', { ascending: false });

    if (convsError) throw convsError;

    // Get reports associated with conversations in this folder
    const conversationIds = (conversations || []).map(c => c.id);
    let reports: Array<{ id: string; chat_id: string | null; report_type: string | null; created_at: string | null; status: string | null }> = [];
    
    if (conversationIds.length > 0) {
      const { data: reportsData, error: reportsError } = await supabase
        .from('report_logs')
        .select('id, chat_id, report_type, created_at, status')
        .in('chat_id', conversationIds)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (!reportsError && reportsData) {
        reports = reportsData;
      }
    }

    return {
      documents: documents || [],
      journals: journals || [],
      conversations: conversations || [],
      reports: reports || [],
      folderName: folder?.name || 'Untitled Folder'
    };
  } catch (err) {
    safeConsoleError('[FolderAI] Error getting folder context:', err);
    throw err;
  }
}

/**
 * Save an AI-generated draft as a document
 */
export async function saveDraft(
  folderId: string,
  userId: string,
  title: string,
  content: string,
  messageId?: string
): Promise<string> {
  try {
    // Create a text file from the draft content
    const blob = new Blob([content], { type: 'text/markdown' });
    const fileName = `${title}.md`;

    // Create document record
    const { data: document, error: createError } = await supabase
      .from('folder_documents')
      .insert({
        user_id: userId,
        folder_id: folderId,
        file_name: fileName,
        file_type: 'text/markdown',
        file_size: blob.size,
        file_extension: 'md',
        content_text: content,
        upload_status: 'completed',
        ai_generated: true,
        ai_metadata: {
          source: 'folder_ai',
          message_id: messageId,
          created_via: 'draft',
          timestamp: new Date().toISOString()
        }
      })
      .select('id')
      .single();

    if (createError) {
      throw new Error(createError.message || 'Failed to save draft');
    }

    return document.id;
  } catch (err) {
    safeConsoleError('[FolderAI] Error saving draft:', err);
    throw err;
  }
}

/**
 * Update an existing document with AI-proposed changes
 */
export async function updateDocumentContent(
  documentId: string,
  content: string,
  changeType: 'overwrite' | 'append' | 'revision' = 'overwrite',
  messageId?: string
): Promise<void> {
  try {
    if (changeType === 'revision') {
      // For revisions, we create a new document and link it
      const { data: originalDoc, error: fetchError } = await supabase
        .from('folder_documents')
        .select('folder_id, user_id, file_name, version')
        .eq('id', documentId)
        .single();

      if (fetchError) throw fetchError;

      const newVersion = (originalDoc.version || 1) + 1;
      const newFileName = originalDoc.file_name.replace(/\.[^.]+$/, '') + `_v${newVersion}.md`;

      const { error: createError } = await supabase
        .from('folder_documents')
        .insert({
          user_id: originalDoc.user_id,
          folder_id: originalDoc.folder_id,
          file_name: newFileName,
          file_type: 'text/markdown',
          file_size: content.length,
          file_extension: 'md',
          content_text: content,
          upload_status: 'completed',
          ai_generated: true,
          version: newVersion,
          parent_document_id: documentId,
          ai_metadata: {
            source: 'folder_ai',
            message_id: messageId,
            change_type: 'revision',
            timestamp: new Date().toISOString()
          }
        });

      if (createError) throw createError;
    } else if (changeType === 'append') {
      // Append to existing content
      const { data: existingDoc, error: fetchError } = await supabase
        .from('folder_documents')
        .select('content_text')
        .eq('id', documentId)
        .single();

      if (fetchError) throw fetchError;

      const updatedContent = (existingDoc.content_text || '') + '\n\n' + content;

      const { error: updateError } = await supabase
        .from('folder_documents')
        .update({
          content_text: updatedContent,
          ai_metadata: {
            source: 'folder_ai',
            message_id: messageId,
            change_type: 'append',
            timestamp: new Date().toISOString()
          }
        })
        .eq('id', documentId);

      if (updateError) throw updateError;
    } else {
      // Overwrite content
      const { error: updateError } = await supabase
        .from('folder_documents')
        .update({
          content_text: content,
          ai_metadata: {
            source: 'folder_ai',
            message_id: messageId,
            change_type: 'overwrite',
            timestamp: new Date().toISOString()
          }
        })
        .eq('id', documentId);

      if (updateError) throw updateError;
    }
  } catch (err) {
    safeConsoleError('[FolderAI] Error updating document:', err);
    throw err;
  }
}

/**
 * Clear conversation history for a folder (reset working memory)
 */
export async function clearFolderAIHistory(folderId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('folder_ai_messages')
      .delete()
      .eq('folder_id', folderId);

    if (error) {
      throw new Error(error.message || 'Failed to clear history');
    }
  } catch (err) {
    safeConsoleError('[FolderAI] Error clearing history:', err);
    throw err;
  }
}

/**
 * Save a document - creates new or updates existing
 */
export async function saveDocumentDraft(
  folderId: string,
  userId: string,
  title: string,
  content: string,
  documentId?: string // If provided, update existing; otherwise create new
): Promise<void> {
  try {
    // Calculate file size from content (in bytes)
    const fileSize = new Blob([content]).size;
    const fileName = title.endsWith('.md') ? title : `${title}.md`;

    if (documentId) {
      // Update existing document
      const { error } = await supabase
        .from('folder_documents')
        .update({
          file_name: fileName,
          file_size: fileSize,
          content_text: content,
          ai_metadata: {
            generated_at: new Date().toISOString(),
            source: 'folder_ai',
            updated: true
          }
        })
        .eq('id', documentId);

      if (error) {
        throw new Error(error.message || 'Failed to update document');
      }
    } else {
      // Create new document
    const { error } = await supabase
      .from('folder_documents')
      .insert({
        folder_id: folderId,
        user_id: userId,
          file_name: fileName,
          file_size: fileSize,
          file_extension: 'md',
        content_text: content,
        file_type: 'text/markdown',
          upload_status: 'completed',
        ai_generated: true,
        ai_metadata: {
          generated_at: new Date().toISOString(),
          source: 'folder_ai'
        }
      });

    if (error) {
      throw new Error(error.message || 'Failed to save document');
      }
    }
  } catch (err) {
    safeConsoleError('[FolderAI] Error saving document:', err);
    throw err;
  }
}

/**
 * Get user's folder AI usage stats
 */
export async function getFolderAIUsage(userId: string): Promise<{
  operationCount: number;
  lastResetAt: string;
  limit: number;
}> {
  try {
    const { data, error } = await supabase
      .from('folder_ai_usage')
      .select('operation_count, last_reset_at')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      throw error;
    }

    const typedData = data as unknown as { operation_count: number; last_reset_at: string } | null;

    return {
      operationCount: typedData?.operation_count || 0,
      lastResetAt: typedData?.last_reset_at || new Date().toISOString(),
      limit: 50 // Free tier limit
    };
  } catch (err) {
    safeConsoleError('[FolderAI] Error getting usage:', err);
    throw err;
  }
}

/**
 * Parse AI response for structured actions (draft, update, etc.)
 */
export function parseAIResponse(text: string): {
  plainText: string;
  draft?: DraftDocument;
  update?: DocumentUpdate;
  requestDocuments?: { ids: string[]; reason: string };
} {
  let plainText = text;
  let draft: DraftDocument | undefined;
  let update: DocumentUpdate | undefined;
  let requestDocuments: { ids: string[]; reason: string } | undefined;

  // Parse draft_document tags - robust multiline matching
  const draftMatch = text.match(/<draft_document>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<content>([\s\S]*?)<\/content>[\s\S]*?<\/draft_document>/);
  if (draftMatch) {
    draft = {
      title: draftMatch[1].trim(),
      content: draftMatch[2].trim()
    };
    plainText = plainText.replace(draftMatch[0], '').trim();
  }

  // Parse propose_update tags - robust multiline matching
  const updateMatch = text.match(/<propose_update>[\s\S]*?<document_id>([\s\S]*?)<\/document_id>[\s\S]*?<change_type>([\s\S]*?)<\/change_type>[\s\S]*?<content>([\s\S]*?)<\/content>[\s\S]*?<\/propose_update>/);
  if (updateMatch) {
    update = {
      documentId: updateMatch[1].trim(),
      changeType: updateMatch[2].trim() as 'overwrite' | 'append' | 'revision',
      content: updateMatch[3].trim()
    };
    plainText = plainText.replace(updateMatch[0], '').trim();
  }

  // Parse request_documents tags - robust multiline matching
  const requestMatch = text.match(/<request_documents>[\s\S]*?<ids>\s*\[([\s\S]*?)\]\s*<\/ids>[\s\S]*?<reason>([\s\S]*?)<\/reason>[\s\S]*?<\/request_documents>/);
  if (requestMatch) {
    try {
      const idsString = requestMatch[1];
      const ids = idsString.split(',').map(id => id.trim().replace(/['"]/g, ''));
      requestDocuments = {
        ids,
        reason: requestMatch[2].trim()
      };
      plainText = plainText.replace(requestMatch[0], '').trim();
    } catch (err) {
      safeConsoleError('[FolderAI] Error parsing request_documents:', err);
    }
  }

  return {
    plainText: plainText || text,
    draft,
    update,
    requestDocuments
  };
}

