// src/services/conversations-static.ts
// Common conversation functions that are frequently statically imported
// This separation allows dynamic imports of other conversation functions without warnings

import { supabase } from '@/integrations/supabase/client';
import { safeConsoleError } from '@/utils/safe-logging';
import type { Database } from '@/integrations/supabase/types';

type Conversation = Database['public']['Tables']['conversations']['Row'];

/**
 * Get a conversation by ID
 */
export const getConversation = async (conversationId: string): Promise<Conversation | null> => {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single();

  if (error) {
    safeConsoleError('Error fetching conversation:', error);
    return null;
  }

  return data;
};

/**
 * Update conversation title
 */
export const updateConversationTitle = async (conversationId: string, title: string, userId: string): Promise<void> => {
  const { error } = await supabase
    .from('conversations')
    .update({ title })
    .eq('id', conversationId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to update conversation title: ${error.message}`);
  }
};

/**
 * Share a conversation
 */
export const shareConversation = async (conversationId: string, userId: string): Promise<void> => {
  const { error } = await supabase
    .from('conversations')
    .update({ is_public: true })
    .eq('id', conversationId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to share conversation: ${error.message}`);
  }
};

/**
 * Unshare a conversation
 */
export const unshareConversation = async (conversationId: string, userId: string): Promise<void> => {
  const { error } = await supabase
    .from('conversations')
    .update({ is_public: false })
    .eq('id', conversationId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to unshare conversation: ${error.message}`);
  }
};

/**
 * Clear primary profile ID cache for a user
 * Call this when a user's primary profile changes
 */
export const clearPrimaryProfileIdCache = (userId: string): void => {
  const cacheKey = `primary_profile_${userId}`;
  primaryProfileIdCache.delete(cacheKey);
};

// Cache for primary profile IDs to avoid repeated DB queries
const primaryProfileIdCache = new Map<string, string>();

/**
 * Get primary profile ID for a user (cached)
 */
export const getPrimaryProfileId = async (userId: string): Promise<string | null> => {
  const cacheKey = `primary_profile_${userId}`;

  // Check cache first
  if (primaryProfileIdCache.has(cacheKey)) {
    return primaryProfileIdCache.get(cacheKey)!;
  }

  try {
    const { data, error } = await supabase
      .from('user_profile_list')
      .select('id')
      .eq('user_id', userId)
      .eq('is_primary', true)
      .single();

    if (error) {
      safeConsoleError('Error fetching primary profile:', error);
      return null;
    }

    // Cache the result
    primaryProfileIdCache.set(cacheKey, data.id);
    return data.id;
  } catch (error) {
    safeConsoleError('Error in getPrimaryProfileId:', error);
    return null;
  }
};
