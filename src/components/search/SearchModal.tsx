import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Search, MessageSquare, Clock, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { safeConsoleError } from '@/utils/safe-logging';
const hasConversationShape = (value: unknown): value is { id: string; title: string | null; created_at: string; mode?: string | null } => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { id?: unknown; title?: unknown; created_at?: unknown; mode?: unknown };
  return (
    typeof candidate.id === 'string' &&
    (typeof candidate.title === 'string' || candidate.title === null || typeof candidate.title === 'undefined') &&
    typeof candidate.created_at === 'string'
  );
};

const hasMessageShape = (value: unknown): value is { id: string; chat_id: string; text: string; role: string; created_at: string } => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { id?: unknown; chat_id?: unknown; text?: unknown; role?: unknown; created_at?: unknown };
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.chat_id === 'string' &&
    typeof candidate.text === 'string' &&
    typeof candidate.role === 'string' &&
    typeof candidate.created_at === 'string'
  );
};
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  chat_id: string;
  conversation_title: string;
  text: string;
  role: 'user' | 'assistant' | 'system';
  created_at: string;
  snippet: string;
}

interface ConversationGroup {
  chat_id: string;
  title: string;
  messages: SearchResult[];
  latest_message: string;
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMessage: (chatId: string, messageId: string) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  onSelectMessage
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ConversationGroup[]>([]);
  const [recentConversations, setRecentConversations] = useState<Array<{ id: string; title: string | null; created_at: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Fetch recent conversations when modal opens
  const fetchRecentConversations = useCallback(async () => {
    if (!user) return;
    
    setIsLoadingRecent(true);
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('id, title, created_at')
        .eq('user_id' as never, user.id)
        .neq('mode' as never, 'profile') // Exclude Profile conversations (internal use only)
        .order('created_at', { ascending: false })
        .limit(20); // Show last 20 conversations

      if (error) {
        safeConsoleError('Error fetching recent conversations:', error);
        return;
      }

      const normalized = (Array.isArray(data) ? data.filter(hasConversationShape) : []) as Array<{ id: string; title: string | null; created_at: string }>;
      setRecentConversations(normalized);
    } catch (error) {
      safeConsoleError('Error fetching recent conversations:', error);
    } finally {
      setIsLoadingRecent(false);
    }
  }, [user]);

  // Focus input when modal opens and fetch recent conversations
  useEffect(() => {
    if (isOpen) {
      if (inputRef.current) {
        inputRef.current.focus();
      }
      if (!query.trim()) {
        fetchRecentConversations();
      }
    }
  }, [isOpen, fetchRecentConversations, query]);

  const performSearch = useCallback(async (searchQuery: string) => {
    setIsLoading(true);
    try {
      if (!user?.id) {
        safeConsoleError('No user ID available for search', null);
        setIsLoading(false);
        return;
      }

      // First, get all user's conversations (excluding Profile conversations)
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select('id, title, created_at')
        .eq('user_id' as never, user.id)
        .neq('mode' as never, 'profile') // Exclude Profile conversations (internal use only)
        .order('created_at', { ascending: false });

      if (convError) {
        safeConsoleError('Conversations fetch error:', convError);
        return;
      }

      const conversationRows = (Array.isArray(conversations) ? conversations.filter(hasConversationShape) : []) as Array<{ id: string; title: string | null; created_at: string }>;

      if (conversationRows.length === 0) {
        setResults([]);
        return;
      }

      // Get conversation IDs
      const conversationIds = conversationRows.map(conv => conv.id);

      // Search messages in those conversations
      const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('id, chat_id, text, role, created_at')
        .in('chat_id', conversationIds)
        .ilike('text', `%${searchQuery}%`)
        .order('created_at', { ascending: false })
        .limit(50); // Limit results for performance

      if (msgError) {
        safeConsoleError('Messages search error:', msgError);
        return;
      }

      const messageRows = Array.isArray(messages) ? messages.filter(hasMessageShape) : [];

      // Group results by conversation
      const groupedResults = new Map<string, ConversationGroup>();

      // Create conversation lookup
      const conversationLookup = new Map(
        conversationRows.map(conv => [conv.id, conv])
      );

      for (const msg of messageRows) {
        const conversation = conversationLookup.get(msg.chat_id);
        if (!conversation) continue;

        if (!groupedResults.has(msg.chat_id)) {
          groupedResults.set(msg.chat_id, {
            chat_id: msg.chat_id,
            title: conversation.title ?? 'Untitled Chat',
            latest_message: conversation.created_at,
            messages: []
          });
        }

        const snippet = createSnippet(msg.text, searchQuery);
        const group = groupedResults.get(msg.chat_id)!;
        group.messages.push({
          id: msg.id,
          chat_id: msg.chat_id,
          conversation_title: conversation.title ?? 'Untitled Chat',
          text: msg.text,
          role: msg.role as 'user' | 'assistant' | 'system',
          created_at: msg.created_at,
          snippet
        });
      }

      // Convert to array and sort by latest message
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

      setResults(sortedResults);
    } catch (error) {
      safeConsoleError('Search failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Search function with debouncing
  useEffect(() => {
    if (!query.trim() || !user) {
      setResults([]);
      // Show recent conversations when not searching
      if (isOpen && recentConversations.length === 0) {
        fetchRecentConversations();
      }
      return;
    }

    const searchTimeout = setTimeout(async () => {
      await performSearch(query.trim());
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [query, user, isOpen, recentConversations.length, fetchRecentConversations, performSearch]);

  const createSnippet = (text: string, query: string, maxLength = 120) => {
    const queryIndex = text.toLowerCase().indexOf(query.toLowerCase());
    if (queryIndex === -1) return text.substring(0, maxLength) + '...';

    const start = Math.max(0, queryIndex - 50);
    const end = Math.min(text.length, queryIndex + query.length + 50);
    
    let snippet = text.substring(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';

    // Highlight the query in the snippet
    const regex = new RegExp(`(${query})`, 'gi');
    snippet = snippet.replace(regex, '<mark class="bg-yellow-200 px-0.5 rounded">$1</mark>');

    return snippet;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalItems = results.reduce((sum, group) => sum + group.messages.length, 0);
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, totalItems - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelectMessage();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleSelectMessage = () => {
    let currentIndex = 0;
    for (const group of results) {
      for (const message of group.messages) {
        if (currentIndex === selectedIndex) {
          // Navigate to conversation directly instead of using setChatId
          navigate(`/c/${message.chat_id}`);
          onSelectMessage(message.chat_id, message.id);
          onClose();
          return;
        }
        currentIndex++;
      }
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-start justify-center pt-16 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 h-[600px] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-gray-100">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search your conversations..."
              className="w-full pl-10 pr-4 py-3 text-base bg-gray-50 rounded-xl border-0 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all duration-200"
            />
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results */}
        <div 
          ref={resultsRef}
          className="flex-1 overflow-y-auto"
        >
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400"></div>
              <p className="mt-2 text-sm text-black">Searching...</p>
            </div>
          ) : query.trim() && results.length === 0 ? (
            <div className="p-8 text-center">
              <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-black">No messages found</p>
              <p className="text-sm text-gray-400 mt-1">Try different keywords</p>
            </div>
          ) : !query.trim() ? (
            <div className="p-2">
              {isLoadingRecent ? (
                <div className="p-8 text-center">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400"></div>
                  <p className="mt-2 text-sm text-black">Loading conversations...</p>
                </div>
              ) : recentConversations.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-black">No conversations found</p>
                </div>
              ) : (
                recentConversations.map((conv) => (
                <div key={conv.id} className="mb-3">
                  <div className="flex items-center gap-2 px-3 py-2 mb-1">
                    <MessageSquare className="w-4 h-4 text-gray-400" />
                    <span className="font-medium text-black">{conv.title}</span>
                    <span className="text-xs text-gray-500">•</span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(conv.created_at)}
                    </span>
                  </div>
                  
                  <button
                    onClick={() => {
                      navigate(`/c/${conv.id}`);
                      onSelectMessage(conv.id, '');
                      onClose();
                    }}
                    className="w-full text-left p-3 rounded-lg transition-colors group hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-600">Click to open conversation</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                </div>
                ))
              )}
            </div>
          ) : (
            <div className="p-2">
              {results.map((group) => (
                <div key={group.chat_id} className="mb-4">
                  <div className="flex items-center gap-2 px-3 py-2 mb-1">
                    <MessageSquare className="w-4 h-4 text-gray-400" />
                    <span className="font-medium text-black">{group.title}</span>
                    <span className="text-xs text-gray-500">•</span>
                    <span className="text-xs text-gray-500">{group.messages.length} result{group.messages.length !== 1 ? 's' : ''}</span>
                  </div>
                  
                  <div className="space-y-1">
                    {group.messages.map((message, messageIndex) => {
                      const globalIndex = results
                        .slice(0, results.indexOf(group))
                        .reduce((sum, g) => sum + g.messages.length, 0) + messageIndex;
                      
                      return (
                        <button
                          key={message.id}
                          onClick={() => {
                            navigate(`/c/${message.chat_id}`);
                            onSelectMessage(message.chat_id, message.id);
                            onClose();
                          }}
                          className={cn(
                            "w-full text-left p-3 rounded-lg transition-colors group",
                            "hover:bg-blue-50 focus:bg-blue-50 focus:outline-none",
                            selectedIndex === globalIndex && "bg-blue-50 border border-blue-200"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-black">
                                  {message.role === 'user' ? 'You' : 
                                   message.role === 'assistant' ? 'AI' : 'System'}
                                </span>
                                <span className="text-xs text-gray-400">•</span>
                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDate(message.created_at)}
                                </span>
                              </div>
                              
                              <p 
                                className="text-sm text-black leading-relaxed"
                              >
                                {message.snippet.replace(/<[^>]*>/g, '')}
                              </p>
                            </div>
                            
                            <ChevronRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {query.trim() && results.length > 0 && (
          <div className="border-t border-gray-100 p-3 bg-gray-50">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{results.reduce((sum, group) => sum + group.messages.length, 0)} results</span>
              <div className="flex items-center gap-4">
                <span>↑↓ Navigate</span>
                <span>↵ Select</span>
                <span>⎋ Close</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
