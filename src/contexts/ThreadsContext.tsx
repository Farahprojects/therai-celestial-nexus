import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { Conversation } from '@/core/types';

interface ThreadsContextType {
  threads: Conversation[];
  loading: boolean;
  error: string | null;
  loadThreads: () => Promise<void>;
  addThread: (userId: string, mode: 'chat' | 'astro' | 'insight' | 'swiss' | 'together', title?: string) => Promise<string>;
  removeThread: (threadId: string) => Promise<void>;
  updateThreadTitle: (threadId: string, title: string) => Promise<void>;
  clearThreadsError: () => void;
}

const ThreadsContext = createContext<ThreadsContextType | undefined>(undefined);

interface ThreadsProviderProps {
  children: ReactNode;
}

export const ThreadsProvider: React.FC<ThreadsProviderProps> = ({ children }) => {
  // Guard against useAuth being called before AuthProvider is ready
  let authContext;
  try {
    authContext = useAuth();
  } catch (error) {
    // AuthProvider not ready yet, render children without threads functionality
    return <>{children}</>;
  }
  
  const { user, isAuthenticated } = authContext;
  const [threads, setThreads] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadThreads = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { listConversations } = await import('@/services/conversations');
      const conversations = await listConversations(user.id);
      
      // Sort by updated_at desc for proper ordering
      const sortedConversations = conversations.sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      
      setThreads(sortedConversations);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load threads';
      setError(errorMessage);
      console.error('[ThreadsProvider] Error loading threads:', err);
    } finally {
      setLoading(false);
    }
  };

  const addThread = async (userId: string, mode: 'chat' | 'astro' | 'insight' | 'swiss' | 'together', title?: string) => {
    if (!user) throw new Error('User not authenticated');
    
    setLoading(true);
    setError(null);
    
    try {
      const { createConversation } = await import('@/services/conversations');
      const conversationId = await createConversation(userId, mode, title);
      
      // Add new thread to local state immediately for instant UI feedback
      const newThread: Conversation = {
        id: conversationId,
        user_id: userId,
        title: title || 'New Chat',
        mode: mode, // Include mode in local state
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        meta: null
      };
      
      setThreads(prev => [newThread, ...prev]);
      return conversationId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create thread';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const removeThread = async (threadId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const { deleteConversation } = await import('@/services/conversations');
      await deleteConversation(threadId);
      
      // Update local state immediately for instant UI feedback
      setThreads(prev => prev.filter(thread => thread.id !== threadId));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete thread';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateThreadTitle = async (threadId: string, title: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const { updateConversationTitle } = await import('@/services/conversations');
      await updateConversationTitle(threadId, title);
      
      // Update local state
      setThreads(prev => prev.map(thread => 
        thread.id === threadId 
          ? { ...thread, title, updated_at: new Date().toISOString() } 
          : thread
      ));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update thread title';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const clearThreadsError = () => setError(null);

  // Clear threads when user logs out (loading handled by useChatInitialization)
  useEffect(() => {
    if (!isAuthenticated || !user) {
      // Clear threads when user logs out
      setThreads([]);
      setError(null);
    }
  }, [isAuthenticated, user?.id]);

  const value: ThreadsContextType = {
    threads,
    loading,
    error,
    loadThreads,
    addThread,
    removeThread,
    updateThreadTitle,
    clearThreadsError,
  };

  return (
    <ThreadsContext.Provider value={value}>
      {children}
    </ThreadsContext.Provider>
  );
};

export const useThreads = () => {
  const context = useContext(ThreadsContext);
  if (context === undefined) {
    throw new Error('useThreads must be used within a ThreadsProvider');
  }
  return context;
};
