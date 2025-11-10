import { supabase } from '@/integrations/supabase/client';

export interface ScoreBreakdown {
  overall: number;
  archetype_name: string;
  ai_insight: string;
  ai_challenge: string;
  calculated_at: string;
  rarity_percentile: number;
  card_image_url?: string | null;
}

/**
 * Calculate sync score for a conversation
 * @param conversationId - The conversation ID
 * @param placeholderMessageId - Optional pre-created placeholder message ID (avoids duplicate creation)
 */
export const calculateSyncScore = async (
  conversationId: string,
  placeholderMessageId?: string
): Promise<ScoreBreakdown> => {
  const { data, error } = await supabase.functions.invoke('calculate-sync-score', {
    body: { 
      chat_id: conversationId,
      message_id: placeholderMessageId // Pass existing message ID if provided
    },
  });

  if (error) {
    console.error('[syncScores] Error calculating score:', error);
    throw new Error('Failed to calculate sync score');
  }

  if (!data?.success || !data?.score) {
    throw new Error('Invalid response from score calculation');
  }

  return data.score;
};

/**
 * Get sync score from conversation metadata
 */
export const getSyncScore = async (conversationId: string): Promise<ScoreBreakdown | null> => {
  const { data, error } = await supabase
    .from('conversations')
    .select('meta')
    .eq('id', conversationId)
    .single();

  if (error) {
    console.error('[syncScores] Error fetching conversation:', error);
    return null;
  }

  const syncScore = (data?.meta as any)?.sync_score;
  return syncScore || null;
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

