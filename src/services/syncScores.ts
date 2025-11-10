import { supabase } from '@/integrations/supabase/client';

export interface MemeCaption {
  format: 'top_bottom' | 'quote' | 'text_only';
  topText?: string;
  bottomText?: string;
  quoteText?: string;
  attribution?: string;
}

export interface MemeData {
  caption: MemeCaption;
  pattern_category: string;
  theme_core: string;
  tone: string;
  calculated_at: string;
  image_url?: string | null;
}

/**
 * Generate sync meme for a conversation
 * @param conversationId - The conversation ID
 * @param placeholderMessageId - Optional pre-created placeholder message ID (avoids duplicate creation)
 */
export const calculateSyncScore = async (
  conversationId: string,
  placeholderMessageId?: string
): Promise<MemeData> => {
  const { data, error } = await supabase.functions.invoke('calculate-sync-score', {
    body: { 
      chat_id: conversationId,
      message_id: placeholderMessageId // Pass existing message ID if provided
    },
  });

  if (error) {
    console.error('[syncMeme] Error generating meme:', error);
    throw new Error('Failed to generate sync meme');
  }

  if (!data?.success || !data?.meme) {
    throw new Error('Invalid response from meme generation');
  }

  return data.meme;
};

/**
 * Get sync meme from conversation metadata
 */
export const getSyncScore = async (conversationId: string): Promise<MemeData | null> => {
  const { data, error } = await supabase
    .from('conversations')
    .select('meta')
    .eq('id', conversationId)
    .single();

  if (error) {
    console.error('[syncMeme] Error fetching conversation:', error);
    return null;
  }

  const syncMeme = (data?.meta as any)?.sync_meme;
  return syncMeme || null;
};

/**
 * Get person names from conversation metadata
 */
export const getConversationPersons = async (
  conversationId: string
): Promise<{ personA: string; personB: string } | null> => {
  const { data, error } = await supabase
    .from('conversations')
    .select('meta')
    .eq('id', conversationId)
    .single();

  if (error) {
    console.error('[syncScores] Error fetching conversation:', error);
    return null;
  }

  // Extract names from meta - they should be stored during conversation creation
  const meta = data?.meta as any;
  
  return {
    personA: meta?.person_a_name || 'Person A',
    personB: meta?.person_b_name || 'Person B',
  };
};

