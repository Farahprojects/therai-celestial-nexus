import { supabase } from '@/integrations/supabase/client';

export interface ScoreBreakdown {
  overall: number;
  astrological: number;
  breakdown: {
    harmonious_aspects: number;
    challenging_aspects: number;
    weighted_score: number;
    key_connections: string[];
    dominant_theme: string;
  };
  poetic_headline: string;
  ai_insight: string;
  calculated_at: string;
  rarity_percentile: number;
  card_image_url?: string | null;
}

/**
 * Calculate sync score for a conversation
 */
export const calculateSyncScore = async (conversationId: string): Promise<ScoreBreakdown> => {
  const { data, error } = await supabase.functions.invoke('calculate-sync-score', {
    body: { chat_id: conversationId },
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

