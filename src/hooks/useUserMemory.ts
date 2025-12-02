import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type Memory = {
  id: string;
  memory_text: string;
  memory_type: string;
  confidence_score: number;
  created_at: string;
  reference_count: number;
};

type MonthlySummary = {
  id: string;
  year: number;
  month: number;
  emotional_summary: string;
  key_themes: string[];
  created_at: string;
};

export function useUserMemory() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [summaries, setSummaries] = useState<MonthlySummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMemories = async () => {
    setLoading(true);
    
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      setLoading(false);
      return;
    }

    const [memoriesResult, summariesResult] = await Promise.all([
      supabase
        .from('user_memory')
        .select('id, memory_text, memory_type, confidence_score, created_at, reference_count')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(100),
      
      supabase
        .from('user_memory_monthly_summaries')
        .select('id, year, month, emotional_summary, key_themes, created_at')
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(12)
    ]);

    if (memoriesResult.data) setMemories(memoriesResult.data);
    if (summariesResult.data) setSummaries(summariesResult.data);
    
    setLoading(false);
  };

  useEffect(() => {
    fetchMemories();
  }, []);

  return { memories, summaries, loading, refetch: fetchMemories };
}

