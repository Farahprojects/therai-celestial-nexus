import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useMessageStore } from '@/stores/messageStore';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

export type ChatMode = 'chat' | 'astro' | 'insight' | 'together' | 'sync_score';

interface ModeContextType {
  mode: ChatMode | null;
  setMode: (mode: ChatMode) => void;
  isModeLocked: boolean;
  isLoading: boolean;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

export const useMode = () => {
  const context = useContext(ModeContext);
  if (context === undefined) {
    throw new Error('useMode must be used within a ModeProvider');
  }
  return context;
};

interface ModeProviderProps {
  children: React.ReactNode;
}

export const ModeProvider: React.FC<ModeProviderProps> = ({ children }) => {
  const [mode, setMode] = useState<ChatMode | null>(null);
  const [isModeLocked, setIsModeLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const { messages, chat_id } = useMessageStore();
  const { user } = useAuth();

  // Load mode from conversations.mode column when chat_id changes
  useEffect(() => {
    if (chat_id && user) {
      setIsLoading(true);
      
      // Simple load: mode is already set on creation, just read it
      const loadMode = async () => {
        try {
          const { data } = await supabase
            .from('conversations')
            .select('mode')
            .eq('id', chat_id)
            .maybeSingle();
          
          // Mode must exist on conversation - no defaults
          setMode((data?.mode as ChatMode) || null);
        } catch {
          // On any error, set to null (no mode selected)
          setMode(null);
        } finally {
          setIsLoading(false);
        }
      };
      
      loadMode();
    } else {
      setIsLoading(false);
    }
  }, [chat_id, user]);

  // Reset mode when user is not authenticated
  useEffect(() => {
    if (!user) {
      setMode(null);
      setIsModeLocked(false);
      setIsLoading(false);
    }
  }, [user]);

  // Lock mode when user sends their first message in the current chat
  useEffect(() => {
    const userMessages = messages.filter(m => m.role === 'user' && m.chat_id === chat_id);
    if (userMessages.length > 0 && !isModeLocked) {
      setIsModeLocked(true);
    }
  }, [messages, chat_id, isModeLocked]);

  // Reset mode lock when switching to a new chat (no messages yet)
  useEffect(() => {
    if (chat_id) {
      const userMessages = messages.filter(m => m.role === 'user' && m.chat_id === chat_id);
      if (userMessages.length === 0) {
        setIsModeLocked(false);
      }
    }
  }, [chat_id, messages]);

  const handleSetMode = useCallback((newMode: ChatMode) => {
    // Mode is immutable after creation (locked after first message)
    // No need to save changes since dropdown is disabled when locked
    if (!isModeLocked) {
      setMode(newMode);
    }
  }, [isModeLocked]);

  const contextValue = useMemo(() => ({
    mode,
    setMode: handleSetMode,
    isModeLocked,
    isLoading
  }), [
    mode,
    handleSetMode,
    isModeLocked,
    isLoading
  ]);

  return (
    <ModeContext.Provider value={contextValue}>
      {children}
    </ModeContext.Provider>
  );
};
