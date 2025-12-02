import { supabase } from '@/integrations/supabase/client';
import { Conversation } from '@/core/types';
import { ReportData } from '@/core/store';

// Simple in-memory cache for primary profile ID
interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

class SimpleCache {
  private cache: Map<string, CacheEntry<any>>;
  private readonly ttlMs = 300000; // 5 minutes

  constructor() {
    this.cache = new Map();
  }

  async get<T>(key: string, fetchFn: () => Promise<T>): Promise<T> {
    const entry = this.cache.get(key);

    // Check if cached and not expired
    if (entry && Date.now() - entry.cachedAt < this.ttlMs) {
      return entry.data as T;
    }

    // Fetch and cache
    const data = await fetchFn();
    this.set(key, data);
    return data;
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      cachedAt: Date.now()
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

const primaryProfileIdCache = new SimpleCache();

/**
 * Fetch user's primary profile ID for memory tracking
 * Returns null if no primary profile exists
 * Uses in-memory caching to avoid N+1 database queries
 */
export const getPrimaryProfileId = async (userId: string): Promise<string | null> => {
  const cacheKey = `primary_profile_${userId}`;

  return primaryProfileIdCache.get(cacheKey, async () => {
    try {
      const { data, error } = await supabase
        .from('user_profile_list')
        .select('id')
        .eq('user_id', userId)
        .eq('is_primary', true)
        .maybeSingle();

      if (error) {
        console.error('[Conversations] Error fetching primary profile:', error);
        return null;
      }

      return data?.id || null;
    } catch (error) {
      console.error('[Conversations] Error fetching primary profile:', error);
      return null;
    }
  });
};

/**
 * Clear primary profile ID cache for a user
 * Call this when a user's primary profile changes
 */
export const clearPrimaryProfileIdCache = (userId: string): void => {
  const cacheKey = `primary_profile_${userId}`;
  primaryProfileIdCache.delete(cacheKey);
};

/**
 * Clear all primary profile ID caches
 * Useful for testing or when bulk operations affect multiple users
 */
export const clearAllPrimaryProfileIdCaches = (): void => {
  primaryProfileIdCache.clear();
};

/**
 * Create a new conversation with AI-generated title from first message
 */
export const createConversationWithTitle = async (
  message: string,
  mode: 'chat' | 'astro' | 'insight' | 'swiss' | 'together' | 'sync_score' = 'chat',
  reportData?: any
): Promise<string> => {
  const { data, error } = await supabase.functions.invoke('create-conversation-with-title', {
    body: {
      message,
      mode,
      report_data: reportData
    }
  });

  if (error) {
    console.error('[Conversations] Error creating conversation with title:', error);
    throw new Error('Failed to create conversation');
  }

  return data.conversation_id;
};

/**
 * Create a new conversation for an authenticated user using edge function
 */
export const createConversation = async (
  userId: string,
  mode: 'chat' | 'astro' | 'insight' | 'swiss' | 'together' | 'sync_score',
  title?: string,
  reportData?: ReportData,
  folderId?: string
): Promise<string> => {
  // ✅ sync_score can only be created from UI left panel (meme button) - NOT from folders
  if (mode === 'sync_score' && folderId) {
    throw new Error('sync_score conversations cannot be created in folders. Please use the meme button from the left panel.');
  }

  // ✅ Fetch primary profile for memory tracking
  const profileId = await getPrimaryProfileId(userId);
  
  console.log('[Conversations] Creating conversation with profile_id:', profileId);
  
  const { data, error } = await supabase.functions.invoke('conversation-manager?action=create_conversation', {
    body: {
      user_id: userId,
      title: title || 'New Chat',
      mode: mode,
      profile_id: profileId, // Pass profile_id for memory extraction
      folder_id: folderId,
      ...(reportData?.report_data && {
        report_data: reportData.report_data,
        email: reportData.email,
        name: reportData.name,
        reportType: reportData.reportType,
      })
    }
  });

  // Handle network/HTTP errors
  if (error) {
    console.error('[Conversations] Error creating conversation:', error);
    throw new Error(error.message || 'Failed to create conversation');
  }

  // Check for application-level errors (returned as 200 with success: false)
  if (data && !data.success) {
    throw new Error(data.error || 'Failed to create conversation');
  }

  // Return conversation ID from data.data (wrapped in success response)
  return data?.data?.id || data?.id;
};

/**
 * Get a single conversation by ID (works for public conversations or authenticated users)
 */
export const getConversation = async (conversationId: string): Promise<Conversation | null> => {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .maybeSingle();

  if (error) {
    console.error('[Conversations] Error fetching conversation:', error);
    return null;
  }

  return data;
};

/**
 * List all conversations for an authenticated user using edge function
 */
export const listConversations = async (userId: string, limit?: number, offset?: number): Promise<Conversation[]> => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  const { data, error } = await supabase.functions.invoke('conversation-manager?action=list_conversations', {
    body: {
      user_id: userId,
      limit: limit || 50, // Default to 50 conversations
      offset: offset || 0
    }
  });

  if (error) {
    console.error('[Conversations] Error listing conversations:', error);
    throw new Error('Failed to load conversations');
  }

  return data || [];
};

/**
 * Delete a conversation and all its messages using edge function
 */
export const deleteConversation = async (conversationId: string, userId: string): Promise<void> => {
  const { error } = await supabase.functions.invoke('conversation-manager?action=delete_conversation', {
    body: {
      user_id: userId,
      conversation_id: conversationId
    }
  });

  if (error) {
    console.error('[Conversations] Error deleting conversation:', error);
    throw new Error('Failed to delete conversation');
  }
};

/**
 * Update conversation title using edge function
 */
export const updateConversationTitle = async (conversationId: string, title: string, userId: string): Promise<void> => {
  const { error } = await supabase.functions.invoke('conversation-manager?action=update_conversation_title', {
    body: {
      user_id: userId,
      conversation_id: conversationId,
      title
    }
  });

  if (error) {
    console.error('[Conversations] Error updating conversation title:', error);
    throw new Error('Failed to update conversation title');
  }
};

/**
 * Share a conversation publicly using edge function
 */
export const shareConversation = async (conversationId: string, userId: string): Promise<void> => {
  const { data, error } = await supabase.functions.invoke('conversation-manager?action=share_conversation', {
    body: {
      user_id: userId,
      conversation_id: conversationId
    }
  });

  if (error) {
    console.error('[Conversations] Error sharing conversation:', error);
    throw new Error('Failed to share conversation');
  }

  return data;
};

/**
 * Stop sharing a conversation using edge function
 */
export const unshareConversation = async (conversationId: string, userId: string): Promise<void> => {
  const { error } = await supabase.functions.invoke('conversation-manager?action=unshare_conversation', {
    body: {
      user_id: userId,
      conversation_id: conversationId
    }
  });

  if (error) {
    console.error('[Conversations] Error unsharing conversation:', error);
    throw new Error('Failed to unshare conversation');
  }
};

/**
 * Join a public conversation using edge function
 */
export const joinConversation = async (conversationId: string, userId: string): Promise<void> => {
  const { error } = await supabase.functions.invoke('conversation-manager?action=join_conversation', {
    body: {
      user_id: userId,
      conversation_id: conversationId
    }
  });

  if (error) {
    console.error('[Conversations] Error joining conversation:', error);
    throw new Error('Failed to join conversation');
  }
};

/**
 * Update conversation mode (Standard, Together, Daily Nudge, etc.)
 */
export const updateConversationMode = async (
  conversationId: string,
  mode: string,
  userId: string
): Promise<void> => {
  const { error } = await supabase
    .from('conversations')
    .update({
      mode: mode,
      updated_at: new Date().toISOString()
    })
    .eq('id', conversationId)
    .eq('owner_user_id', userId); // Only owner can change mode

  if (error) throw new Error('Failed to update conversation mode');
};

