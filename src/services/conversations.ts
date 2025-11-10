import { supabase } from '@/integrations/supabase/client';
import { Conversation } from '@/core/types';

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
  reportData?: {
    reportType?: string;
    report_data?: any;
    email?: string;
    name?: string;
  }
): Promise<string> => {
  // Fetch primary profile for memory tracking
  const { data: primaryProfile } = await supabase
    .from('user_profile_list')
    .select('id')
    .eq('user_id', userId)
    .eq('is_primary', true)
    .maybeSingle();

  const { data, error } = await supabase.functions.invoke('conversation-manager?action=create_conversation', {
    body: {
      user_id: userId,
      title: title || 'New Chat',
      mode: mode,
      profile_id: primaryProfile?.id || null, // Pass profile_id for memory tracking
      ...(reportData?.report_data && {
        report_data: reportData.report_data,
        email: reportData.email,
        name: reportData.name
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
export const deleteConversation = async (conversationId: string): Promise<void> => {
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { error } = await supabase.functions.invoke('conversation-manager?action=delete_conversation', {
    body: {
      user_id: user.id,
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
export const updateConversationTitle = async (conversationId: string, title: string): Promise<void> => {
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { error } = await supabase.functions.invoke('conversation-manager?action=update_conversation_title', {
    body: {
      user_id: user.id,
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
export const shareConversation = async (conversationId: string): Promise<void> => {
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase.functions.invoke('conversation-manager?action=share_conversation', {
    body: {
      user_id: user.id,
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
export const unshareConversation = async (conversationId: string): Promise<void> => {
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { error } = await supabase.functions.invoke('conversation-manager?action=unshare_conversation', {
    body: {
      user_id: user.id,
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
export const joinConversation = async (conversationId: string): Promise<void> => {
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { error } = await supabase.functions.invoke('conversation-manager?action=join_conversation', {
    body: {
      user_id: user.id,
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
  mode: string
): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('conversations')
    .update({ 
      mode: mode,
      updated_at: new Date().toISOString()
    })
    .eq('id', conversationId)
    .eq('owner_user_id', user.id); // Only owner can change mode

  if (error) throw new Error('Failed to update conversation mode');
};

