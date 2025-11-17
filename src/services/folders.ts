// src/services/folders.ts
import { supabase } from '@/integrations/supabase/client';

export interface ChatFolder {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  is_public?: boolean;
  profile_id?: string | null;
  has_profile_setup?: boolean;
}

/**
 * Fetch all folders for the current user
 * Includes owned folders and folders where user is a participant
 */
export async function getUserFolders(userId: string): Promise<ChatFolder[]> {
  // Step 1: Get folders user owns (RLS allows this)
  const { data: ownedFolders, error: ownedError } = await supabase
    .from('chat_folders')
    .select('*')
    .eq('user_id', userId);

  if (ownedError) {
    console.error('[folders] Failed to fetch owned folders:', ownedError);
    throw ownedError;
  }

  // Step 2: Get folder IDs where user is a participant
  const { data: participantRecords, error: participantError } = await supabase
    .from('chat_folder_participants')
    .select('folder_id')
    .eq('user_id', userId);

  if (participantError) {
    console.error('[folders] Failed to fetch participant folders:', participantError);
    // Return owned folders only if participant fetch fails
    return (ownedFolders || []).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }

  // Step 3: Get participant folders by ID (only if there are any)
  let participantFolders: ChatFolder[] = [];
  const participantFolderIds = (participantRecords || []).map(p => p.folder_id);
  
  if (participantFolderIds.length > 0) {
    const { data: folders, error: foldersError } = await supabase
      .from('chat_folders')
      .select('*')
      .in('id', participantFolderIds);

    if (!foldersError && folders) {
      participantFolders = folders;
    }
  }

  // Step 4: Combine and deduplicate
  const allFolders = [...(ownedFolders || []), ...participantFolders];
  const uniqueFolders = Array.from(
    new Map(allFolders.map(f => [f.id, f])).values()
  );

  // Sort by created_at
  return uniqueFolders.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
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
  // ✅ First check if this is a sync_score conversation - they cannot be moved to folders
  const { data: conversation } = await supabase
    .from('conversations')
    .select('mode')
    .eq('id', conversationId)
    .single();

  if (conversation?.mode === 'sync_score') {
    throw new Error('sync_score conversations cannot be moved to folders. They can only be created from the meme button in the left panel.');
  }

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
 * Excludes Profile conversations (mode: 'profile') as they are for internal use
 * Excludes sync_score conversations (should never be in folders per design)
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
    .neq('mode', 'profile') // Exclude Profile conversations (internal use only)
    .neq('mode', 'sync_score') // Exclude sync_score (can only be created from meme button)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[folders] Failed to fetch folder conversations:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get folder statistics (chat count)
 * Excludes Profile conversations (mode: 'profile') as they are for internal use
 */
export async function getFolderStats(folderId: string): Promise<{ chatsCount: number }> {
  const { count, error } = await supabase
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .eq('folder_id', folderId)
    .neq('mode', 'profile'); // Exclude Profile conversations (internal use only)

  if (error) {
    console.error('[folders] Failed to fetch folder stats:', error);
    throw error;
  }

  return { chatsCount: count || 0 };
}

/**
 * Share a folder publicly (no auth required)
 */
export async function shareFolderPublic(folderId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('chat_folders')
    .update({ is_public: true, updated_at: new Date().toISOString() })
    .eq('id', folderId)
    .eq('user_id', user.id);

  if (error) {
    console.error('[folders] Error sharing folder publicly:', error);
    throw new Error('Failed to share folder');
  }
}

/**
 * Share a folder privately (requires sign-in, adds user as participant)
 */
export async function shareFolderPrivate(folderId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Just set is_public to false (private sharing uses participants)
  const { error } = await supabase
    .from('chat_folders')
    .update({ is_public: false, updated_at: new Date().toISOString() })
    .eq('id', folderId)
    .eq('user_id', user.id);

  if (error) {
    console.error('[folders] Error setting folder to private:', error);
    throw new Error('Failed to update folder');
  }

  // Add owner as participant
  await addFolderParticipant(folderId, user.id, 'owner');
}

/**
 * Stop sharing a folder
 */
export async function unshareFolder(folderId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

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
 * Get shared folder by ID (public or participant)
 */
export async function getSharedFolder(folderId: string): Promise<ChatFolder | null> {
  const { data, error } = await supabase
    .from('chat_folders')
    .select('*')
    .eq('id', folderId)
    .maybeSingle();

  if (error) {
    console.error('[folders] Error fetching folder:', error);
    throw error;
  }

  return data;
}

/**
 * Add user as participant to a folder
 */
export async function addFolderParticipant(
  folderId: string,
  userId: string,
  role: 'owner' | 'member' = 'member'
): Promise<void> {
  console.log('[addFolderParticipant] Starting', { folderId, userId, role });
  
  const { data, error } = await supabase
    .from('chat_folder_participants')
    .upsert(
      {
        folder_id: folderId,
        user_id: userId,
        role,
        invited_by: null,
      },
      { onConflict: 'folder_id,user_id' }
    )
    .select();

  if (error) {
    console.error('[addFolderParticipant] Error:', error);
    throw new Error(`Failed to add participant: ${error.message}`);
  }
  
  console.log('[addFolderParticipant] Success:', data);
}

/**
 * Check if user is a participant in a folder
 */
export async function isFolderParticipant(folderId: string, userId: string): Promise<boolean> {
  console.log('[isFolderParticipant] Checking', { folderId, userId });
  
  const { data, error } = await supabase
    .from('chat_folder_participants')
    .select('folder_id')
    .eq('folder_id', folderId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[isFolderParticipant] Error:', error);
    return false;
  }

  const isParticipant = !!data;
  console.log('[isFolderParticipant] Result:', isParticipant);
  return isParticipant;
}

/**
 * Update folder's linked profile
 */
export async function updateFolderProfile(folderId: string, profileId: string | null): Promise<void> {
  const { error } = await supabase
    .from('chat_folders')
    .update({
      profile_id: profileId,
      has_profile_setup: profileId !== null,
    })
    .eq('id', folderId);

  if (error) {
    console.error('[folders] Failed to update folder profile:', error);
    throw error;
  }
}

/**
 * Get folder with its linked profile data
 */
export async function getFolderWithProfile(folderId: string): Promise<{
  folder: ChatFolder;
  profile: any | null;
}> {
  const { data: folder, error: folderError } = await supabase
    .from('chat_folders')
    .select('*')
    .eq('id', folderId)
    .single();

  if (folderError) {
    console.error('[folders] Failed to fetch folder:', folderError);
    throw folderError;
  }

  // Cast to ChatFolder to ensure profile_id is recognized
  const folderData = folder as ChatFolder;

  let profile = null;
  if (folderData.profile_id) {
    const { data: profileData, error: profileError } = await supabase
      .from('user_profile_list')
      .select('*')
      .eq('id', folderData.profile_id)
      .single();

    if (!profileError && profileData) {
      profile = profileData;
    }
  }

  return { folder: folderData, profile };
}

/**
 * Get folder's profile ID
 */
export async function getFolderProfileId(folderId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('chat_folders')
    .select('profile_id')
    .eq('id', folderId)
    .single();

  if (error) {
    console.error('[folders] Failed to fetch folder profile ID:', error);
    return null;
  }

  return data?.profile_id || null;
}

