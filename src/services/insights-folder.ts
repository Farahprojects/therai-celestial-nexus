import { supabase } from '@/integrations/supabase/client';

export interface FolderInsight {
  id: string;
  user_id: string | null;
  folder_id: string | null;
  report_type: string;
  status: string | null;
  is_ready: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  completed_at: string | null;
  metadata: any;
}

/**
 * Get all insights for a folder
 */
export async function getFolderInsights(folderId: string): Promise<FolderInsight[]> {
  const { data, error } = await supabase
    .from('insights')
    .select('*')
    .eq('folder_id', folderId)
    .eq('is_ready', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[FolderInsights] Failed to fetch folder insights:', error);
    throw new Error(error.message || 'Failed to fetch folder insights');
  }

  return data || [];
}

/**
 * Get insight content/conversation by ID
 * Insights are stored as conversations with mode='insight'
 */
export async function getInsightConversation(insightId: string) {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', insightId)
    .eq('mode', 'insight')
    .single();

  if (error) {
    console.error('[FolderInsights] Failed to fetch insight conversation:', error);
    return null;
  }

  return data;
}

/**
 * Delete an insight
 */
export async function deleteInsight(insightId: string): Promise<void> {
  const { error } = await supabase
    .from('insights')
    .delete()
    .eq('id', insightId);

  if (error) {
    console.error('[FolderInsights] Failed to delete insight:', error);
    throw new Error(error.message || 'Failed to delete insight');
  }
}

