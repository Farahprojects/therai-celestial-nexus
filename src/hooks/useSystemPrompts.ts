import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { safeConsoleError } from '@/utils/safe-logging';
export interface SystemPrompt {
  id: string;
  category: string;
  subcategory: string;
  prompt_text: string;
  display_order: number;
}

export interface GroupedPrompts {
  [category: string]: SystemPrompt[];
}

export function useSystemPrompts() {
  const [prompts, setPrompts] = useState<GroupedPrompts>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPrompts();
  }, []);

  const fetchPrompts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('system_prompts')
        .select('id, category, subcategory, prompt_text, display_order')
        .eq('is_active', true)
        .order('category')
        .order('display_order');

      if (error) throw error;

      // Group prompts by category
      const grouped: GroupedPrompts = {};
      data?.forEach((prompt) => {
        if (!grouped[prompt.category]) {
          grouped[prompt.category] = [];
        }
        grouped[prompt.category].push(prompt);
      });

      setPrompts(grouped);
      setError(null);
    } catch (err) {
      safeConsoleError('[useSystemPrompts] Error fetching prompts:', err);
      setError('Failed to load system prompts');
    } finally {
      setLoading(false);
    }
  };

  return { prompts, loading, error };
}
