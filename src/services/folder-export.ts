import { supabase } from '@/integrations/supabase/client';
import { getJournalEntries } from './journal';

interface ExportData {
  folderName: string;
  exportDate: string;
  journals?: unknown[];
  conversations?: unknown[];
  documents?: unknown[];
}

/**
 * Export journal entries from a folder
 */
export async function exportJournals(folderId: string, folderName: string): Promise<void> {
  try {
    const journals = await getJournalEntries(folderId);
    
    const exportData: ExportData = {
      folderName,
      exportDate: new Date().toISOString(),
      journals: journals.map(j => ({
        title: j.title,
        content: j.entry_text,
        tags: j.tags,
        createdAt: j.created_at,
        updatedAt: j.updated_at,
      })),
    };

    downloadAsJSON(exportData, `${folderName}-journals-${Date.now()}.json`);
  } catch (error) {
    console.error('[Export] Failed to export journals:', error);
    throw error;
  }
}

/**
 * Export conversations and messages from a folder
 */
export async function exportChats(folderId: string, folderName: string): Promise<void> {
  try {
    // Fetch conversations directly with all needed fields
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id, title, mode, created_at, updated_at')
      .eq('folder_id', folderId)
      .neq('mode', 'profile')
      .order('updated_at', { ascending: false });
    
    if (!conversations) {
      throw new Error('No conversations found');
    }
    
    // Fetch messages for each conversation
    const conversationsWithMessages = await Promise.all(
      conversations.map(async (conv) => {
        const { data: messages } = await supabase
          .from('messages')
          .select('*')
          .eq('chat_id', conv.id)
          .order('created_at', { ascending: true });

        return {
          id: conv.id,
          title: conv.title,
          mode: conv.mode,
          createdAt: conv.created_at,
          updatedAt: conv.updated_at,
          messages: messages?.map(m => ({
            role: m.role,
            content: m.text,
            createdAt: m.created_at,
          })) || [],
        };
      })
    );

    const exportData: ExportData = {
      folderName,
      exportDate: new Date().toISOString(),
      conversations: conversationsWithMessages,
    };

    downloadAsJSON(exportData, `${folderName}-chats-${Date.now()}.json`);
  } catch (error) {
    console.error('[Export] Failed to export chats:', error);
    throw error;
  }
}

/**
 * Export all folder contents (journals, chats, and document metadata)
 */
export async function exportAll(folderId: string, folderName: string): Promise<void> {
  try {
    // Get journals
    const journals = await getJournalEntries(folderId);
    
    // Fetch conversations directly with all needed fields
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id, title, mode, created_at, updated_at')
      .eq('folder_id', folderId)
      .neq('mode', 'profile')
      .order('updated_at', { ascending: false });
    
    if (!conversations) {
      throw new Error('No conversations found');
    }
    
    // Get conversations with messages
    const conversationsWithMessages = await Promise.all(
      conversations.map(async (conv) => {
        const { data: messages } = await supabase
          .from('messages')
          .select('*')
          .eq('chat_id', conv.id)
          .order('created_at', { ascending: true });

        return {
          id: conv.id,
          title: conv.title,
          mode: conv.mode,
          createdAt: conv.created_at,
          updatedAt: conv.updated_at,
          messages: messages?.map(m => ({
            role: m.role,
            content: m.text,
            createdAt: m.created_at,
          })) || [],
        };
      })
    );

    // Get documents metadata
    const { data: documents } = await supabase
      .from('folder_documents')
      .select('*')
      .eq('folder_id', folderId);

    const exportData: ExportData = {
      folderName,
      exportDate: new Date().toISOString(),
      journals: journals.map(j => ({
        title: j.title,
        content: j.entry_text,
        tags: j.tags,
        createdAt: j.created_at,
        updatedAt: j.updated_at,
      })),
      conversations: conversationsWithMessages,
      documents: documents?.map(d => ({
        fileName: d.file_name,
        fileType: d.file_type,
        fileSize: d.file_size,
        contentText: d.content_text,
        createdAt: d.created_at,
      })) || [],
    };

    downloadAsJSON(exportData, `${folderName}-complete-${Date.now()}.json`);
  } catch (error) {
    console.error('[Export] Failed to export all data:', error);
    throw error;
  }
}

/**
 * Helper function to download data as JSON file
 */
function downloadAsJSON(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}


