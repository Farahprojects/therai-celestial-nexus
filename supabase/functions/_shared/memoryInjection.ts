// Shared memory injection logic for LLM handlers with smart caching
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { queryCache } from './queryCache.ts';

type Memory = {
  id: string;
  memory_text: string;
  memory_type: 'goal' | 'pattern' | 'emotion' | 'fact' | 'relationship';
  confidence_score: number;
  created_at: string;
  reference_count: number;
};

type MemoryResult = {
  memoryContext: string;
  memoryIds: string[];
};

const TYPE_WEIGHTS = {
  goal: 1.0,
  pattern: 0.9,
  emotion: 0.8,
  fact: 0.7,
  relationship: 0.6
};

export async function fetchAndFormatMemories(
  supabase: SupabaseClient,
  chatId: string
): Promise<MemoryResult> {
  try {
    // Use cache to avoid repeated memory fetches (2 minute TTL)
    return await queryCache.get(
      `memories:${chatId}`,
      2 * 60 * 1000, // 2 minutes
      async () => {
        // Check if conversation has profile_id
        const { data: conv } = await supabase
          .from('conversations')
          .select('profile_id, user_id')
          .eq('id', chatId)
          .single();

        if (!conv?.profile_id) {
          return { memoryContext: '', memoryIds: [] };
        }

        // Fetch user memories
        const { data: memories } = await supabase
          .from('user_memory')
          .select('id, memory_text, memory_type, confidence_score, created_at, reference_count')
          .eq('user_id', conv.user_id)
          .eq('profile_id', conv.profile_id)
          .eq('is_active', true)
          .order('reference_count', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(20);

        if (!memories || memories.length === 0) {
          return { memoryContext: '', memoryIds: [] };
        }

        // Score and rank memories
        const now = Date.now();
        const scoredMemories = memories.map(m => {
          const typeWeight = TYPE_WEIGHTS[m.memory_type] || 0.5;
          const recencyFactor = 1 / (1 + (now - new Date(m.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30));
          const usageBoost = 1 + Math.log(1 + m.reference_count);
          
          return {
            ...m,
            score: typeWeight * m.confidence_score * usageBoost * recencyFactor
          };
        });

        scoredMemories.sort((a, b) => b.score - a.score);
        const topMemories = scoredMemories.slice(0, 10);
        
        const memoryContext = topMemories.map(m => `• ${m.memory_text}`).join('\n');
        const memoryIds = topMemories.map(m => m.id);

        return { memoryContext, memoryIds };
      }
    );
  } catch (error) {
    console.error('[memoryInjection] Error fetching memories:', error);
    return { memoryContext: '', memoryIds: [] };
  }
}

export async function updateMemoryUsage(
  supabase: SupabaseClient,
  memoryIds: string[]
): Promise<void> {
  if (memoryIds.length === 0) return;

  try {
    const now = new Date().toISOString();
    
    // Update all memories at once
    for (const id of memoryIds) {
      const { data: current } = await supabase
        .from('user_memory')
        .select('reference_count')
        .eq('id', id)
        .single();
      
      await supabase
        .from('user_memory')
        .update({
          last_referenced_at: now,
          reference_count: (current?.reference_count || 0) + 1
        })
        .eq('id', id);
    }
    
    console.log(`[memoryInjection] Updated ${memoryIds.length} memory usage counts`);
  } catch (error) {
    console.error('[memoryInjection] Error updating memory usage:', error);
  }
}

