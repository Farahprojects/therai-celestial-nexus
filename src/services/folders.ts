// src/services/folders.ts
import { supabase } from '@/integrations/supabase/client';

export interface ChatFolder {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch all folders for the current user
 */
export async function getUserFolders(userId: string): Promise<ChatFolder[]> {
  const { data, error } = await supabase
    .from('chat_folders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[folders] Failed to fetch folders:', error);
    throw error;
  }

  return data || [];
}

/**
 * Create a new folder
 */
export async function createFolder(userId: string, name: string): Promise<ChatFolder> {
  const { data, error } = await supabase
    .from('chat_folders')
    .insert({
      user_id: userId,
      name: name.trim(),
    })
    .select()
    .single();

  if (error) {
    console.error('[folders] Failed to create folder:', error);
    throw error;
  }

  return data;
}

/**
 * Update folder name
 */
export async function updateFolderName(folderId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('chat_folders')
    .update({ name: name.trim() })
    .eq('id', folderId);

  if (error) {
    console.error('[folders] Failed to update folder:', error);
    throw error;
  }
}

/**
 * Delete a folder (sets folder_id to null for all conversations in that folder)
 */
export async function deleteFolder(folderId: string): Promise<void> {
  const { error } = await supabase
    .from('chat_folders')
    .delete()
    .eq('id', folderId);

  if (error) {
    console.error('[folders] Failed to delete folder:', error);
    throw error;
  }
}

/**
 * Move a conversation to a folder
 */
export async function moveConversationToFolder(conversationId: string, folderId: string | null): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ folder_id: folderId })
    .eq('id', conversationId);

  if (error) {
    console.error('[folders] Failed to move conversation to folder:', error);
    throw error;
  }
}

/**
 * Get all conversations in a folder with their details
 */
export async function getFolderConversations(folderId: string): Promise<Array<{
  id: string;
  title: string;
  updated_at: string;
  mode: string | null;
}>> {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, title, updated_at, mode')
    .eq('folder_id', folderId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[folders] Failed to fetch folder conversations:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get folder statistics (chat count)
 */
export async function getFolderStats(folderId: string): Promise<{ chatsCount: number }> {
  const { count, error } = await supabase
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .eq('folder_id', folderId);

  if (error) {
    console.error('[folders] Failed to fetch folder stats:', error);
    throw error;
  }

  return { chatsCount: count || 0 };
}

// Note: Folder sharing has been removed. To share conversations, use conversation-level sharing.
// Set conversations.is_public = true to share individual conversations.

