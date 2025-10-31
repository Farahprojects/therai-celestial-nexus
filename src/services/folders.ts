// src/services/folders.ts
import { supabase } from '@/integrations/supabase/client';

export interface ChatFolder {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  is_public?: boolean;
  share_mode?: 'private' | 'public';
}

/**
 * Fetch all folders for the current user
 */
export async function getUserFolders(userId: string): Promise<ChatFolder[]> {
  // Get folders user owns OR folders where user is a participant
  // This avoids RLS recursion by doing participant check in application code
  
  // Step 1: Get owned folders (simple query, no recursion)
  const { data: ownedFolders, error: ownedError } = await supabase
    .from('chat_folders')
    .select('*')
    .eq('user_id', userId);

  if (ownedError) {
    console.error('[folders] Failed to fetch owned folders:', ownedError);
    throw ownedError;
  }

  // Step 2: Get folder IDs where user is a participant (simple query, no recursion)
  const { data: participantRecords, error: participantError } = await supabase
    .from('chat_folder_participants')
    .select('folder_id')
    .eq('user_id', userId);

  if (participantError) {
    console.error('[folders] Failed to fetch participant folder IDs:', participantError);
    // Return owned folders only if participant fetch fails
    return (ownedFolders || []).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }

  // Step 3: Get participant folders by ID (separate query avoids join recursion)
  const participantFolderIds = (participantRecords || []).map((p) => p.folder_id);
  
  let participantFolders: ChatFolder[] = [];
  if (participantFolderIds.length > 0) {
    const { data: folders, error: foldersError } = await supabase
      .from('chat_folders')
      .select('*')
      .in('id', participantFolderIds)
      .eq('is_public', true); // Only get shared folders

    if (!foldersError && folders) {
      participantFolders = folders;
    }
  }

  // Combine and deduplicate by id
  const allFolders = [...(ownedFolders || []), ...participantFolders];
  const uniqueFolders = Array.from(
    new Map(allFolders.map((f: ChatFolder) => [f.id, f])).values()
  );

  // Sort by created_at
  return uniqueFolders.sort(
    (a: ChatFolder, b: ChatFolder) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
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

/**
 * Share a folder (private/invite-only or public)
 * @param folderId - The folder ID to share
 * @param mode - 'private' (invite-only, requires sign-in) or 'public' (no sign-in required)
 */
export async function shareFolder(folderId: string, mode: 'private' | 'public' = 'private'): Promise<void> {
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Set is_public = true and share_mode
  // Private mode: invite-only, uses participants (trigger will add owner as participant)
  // Public mode: truly public, no sign-in required
  const { error } = await supabase
    .from('chat_folders')
    .update({ 
      is_public: true, 
      share_mode: mode,
      updated_at: new Date().toISOString() 
    })
    .eq('id', folderId)
    .eq('user_id', user.id);

  if (error) {
    console.error('[folders] Error sharing folder:', error);
    throw new Error('Failed to share folder');
  }

  // For private mode, ensure owner is added as participant (trigger should handle this)
  // For public mode, participants are not required
}

/**
 * Stop sharing a folder (make it private)
 */
export async function unshareFolder(folderId: string): Promise<void> {
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { error } = await supabase
    .from('chat_folders')
    .update({ is_public: false, updated_at: new Date().toISOString() })
    .eq('id', folderId)
    .eq('user_id', user.id);

  if (error) {
    console.error('[folders] Error unsharing folder:', error);
    throw new Error('Failed to unshare folder');
  }
}

/**
 * Get shared folder by ID (must be is_public = true)
 * Works for both private (invite-only) and public (no sign-in) folders
 */
export async function getSharedFolder(folderId: string): Promise<ChatFolder | null> {
  const { data, error } = await supabase
    .from('chat_folders')
    .select('*')
    .eq('id', folderId)
    .eq('is_public', true)
    .maybeSingle();

  if (error) {
    console.error('[folders] Error fetching shared folder:', error);
    throw error;
  }

  return data;
}

/**
 * Add user as participant to a shared folder
 */
export async function joinFolder(folderId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('chat_folder_participants')
    .upsert(
      {
        folder_id: folderId,
        user_id: userId,
        role: 'member',
        invited_by: null, // Self-joined via link
      },
      { onConflict: 'folder_id,user_id' }
    );

  if (error) {
    console.error('[folders] Error joining folder:', error);
    throw new Error('Failed to join folder');
  }
}

/**
 * Check if user is a participant in a folder
 */
export async function isFolderParticipant(folderId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('chat_folder_participants')
    .select('folder_id')
    .eq('folder_id', folderId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[folders] Error checking folder participant:', error);
    return false;
  }

  return !!data;
}

