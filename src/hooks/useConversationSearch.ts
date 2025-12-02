import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ConversationSearchResult {
  id: string;
  title: string | null;
  created_at: string;
  messages: Array<{
    id: string;
    text: string;
    role: string;
    created_at: string;
  }>;
}

export interface SearchResult {
  id: string;
  chat_id: string;
  conversation_title: string;
  text: string;
  role: 'user' | 'assistant' | 'system';
  created_at: string;
  snippet: string;
}

export interface ConversationGroup {
  chat_id: string;
  title: string;
  messages: SearchResult[];
  latest_message: string;
}

export const useConversationSearch = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ConversationGroup[]>([]);

  const createSnippet = useCallback((text: string, query: string, maxLength = 120) => {
    const queryIndex = text.toLowerCase().indexOf(query.toLowerCase());
    if (queryIndex === -1) return text.substring(0, maxLength) + '...';

    const start = Math.max(0, queryIndex - 50);
    const end = Math.min(text.length, queryIndex + query.length + 50);
    
    let snippet = text.substring(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';

    return snippet;
  }, []);

  const highlightQuery = useCallback((text: string, query: string) => {
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 px-0.5 rounded">$1</mark>');
  }, []);

  const searchConversations = useCallback(async (query: string): Promise<ConversationGroup[]> => {
    if (!query.trim() || !user) {
      return [];
    }

    setIsLoading(true);
    try {
      // Use full-text search for better performance
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          title,
          created_at,
          messages!inner (
            id,
            text,
            role,
            created_at
          )
        `)
        .eq('user_id', user.id)
        .neq('mode', 'profile') // Exclude Profile conversations (internal use only)
        .ilike('messages.text', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(100); // Increased limit for better results

      if (error) {
        console.error('Search error:', error);
        return [];
      }

      // Group results by conversation
      const groupedResults = new Map<string, ConversationGroup>();

      data?.forEach((conv: ConversationSearchResult) => {
        const chatId = conv.id;

        conv.messages?.forEach((msg: ConversationSearchResult['messages'][0]) => {
          if (msg.text.toLowerCase().includes(query.toLowerCase())) {
            if (!groupedResults.has(chatId)) {
              groupedResults.set(chatId, {
                chat_id: chatId,
                title: conv.title,
                messages: [],
                latest_message: conv.created_at
              });
            }

            const snippet = createSnippet(msg.text, query);
            const highlightedSnippet = highlightQuery(snippet, query);
            
            groupedResults.get(chatId)!.messages.push({
              id: msg.id,
              chat_id: chatId,
              conversation_title: conv.title,
              text: msg.text,
              role: msg.role,
              created_at: msg.created_at,
              snippet: highlightedSnippet
            });
          }
        });
      });

      // Convert to array and sort
      const sortedResults = Array.from(groupedResults.values())
        .map(group => ({
          ...group,
          messages: group.messages.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
        }))
        .sort((a, b) => 
          new Date(b.latest_message).getTime() - new Date(a.latest_message).getTime()
        );

      return sortedResults;
    } catch (error) {
      console.error('Search failed:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [user, createSnippet, highlightQuery]);

  const debouncedSearch = useCallback((query: string) => {
    const timeoutId = setTimeout(() => {
      searchConversations(query).then(setResults);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchConversations]);

  return {
    results,
    isLoading,
    searchConversations,
    debouncedSearch
  };
};
