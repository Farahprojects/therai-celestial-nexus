import { supabase } from '@/integrations/supabase/client';
import { safeConsoleError } from '@/utils/safe-logging';
export interface JournalEntry {
  id: string;
  client_id: string;
  user_id: string;
  folder_id: string | null;
  title: string | null;
  entry_text: string;
  tags: string[] | null;
  linked_report_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Create a new journal entry
 */
export async function createJournalEntry(
  userId: string,
  folderId: string,
  entryText: string,
  title?: string,
  tags?: string[]
): Promise<JournalEntry> {
  const { data, error } = await supabase
    .from('journal_entries')
    .insert({
      client_id: userId,
      user_id: userId,
      folder_id: folderId,
      entry_text: entryText,
      title: title || null,
      tags: tags || null,
    })
    .select()
    .single();

  if (error) {
    safeConsoleError('[Journal] Failed to create journal entry:', error);
    throw new Error(error.message || 'Failed to create journal entry');
  }

  return data;
}

/**
 * Get all journal entries for a folder
 */
export async function getJournalEntries(folderId: string): Promise<JournalEntry[]> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('folder_id', folderId)
    .order('created_at', { ascending: false });

  if (error) {
    safeConsoleError('[Journal] Failed to fetch journal entries:', error);
    throw new Error(error.message || 'Failed to fetch journal entries');
  }

  return data || [];
}

/**
 * Get a single journal entry by ID
 */
export async function getJournalEntry(entryId: string): Promise<JournalEntry | null> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('id', entryId)
    .single();

  if (error) {
    safeConsoleError('[Journal] Failed to fetch journal entry:', error);
    return null;
  }

  return data;
}

/**
 * Update a journal entry
 */
export async function updateJournalEntry(
  entryId: string,
  updates: {
    title?: string;
    entry_text?: string;
    tags?: string[];
  }
): Promise<JournalEntry> {
  const { data, error } = await supabase
    .from('journal_entries')
    .update(updates)
    .eq('id', entryId)
    .select()
    .single();

  if (error) {
    safeConsoleError('[Journal] Failed to update journal entry:', error);
    throw new Error(error.message || 'Failed to update journal entry');
  }

  return data;
}

/**
 * Delete a journal entry
 */
export async function deleteJournalEntry(entryId: string): Promise<void> {
  const { error } = await supabase
    .from('journal_entries')
    .delete()
    .eq('id', entryId);

  if (error) {
    safeConsoleError('[Journal] Failed to delete journal entry:', error);
    throw new Error(error.message || 'Failed to delete journal entry');
  }
}

/**
 * Get all journal entries for a user (across all folders)
 */
export async function getUserJournalEntries(userId: string): Promise<JournalEntry[]> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('client_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    safeConsoleError('[Journal] Failed to fetch user journal entries:', error);
    throw new Error(error.message || 'Failed to fetch user journal entries');
  }

  return data || [];
}

