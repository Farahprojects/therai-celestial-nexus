import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useChatStore, ReportData } from '@/core/store';
import { chatController } from '@/features/chat/ChatController';
import { supabase } from '@/integrations/supabase/client';
import { safeConsoleError } from '@/utils/safe-logging';
export const useAstroConversation = () => {
  const { user } = useAuth();
  const { addThread } = useChatStore();

  const createConversation = useCallback(
    async (
      mode: 'astro' | 'insight' | 'swiss' | 'sync_score',
      title: string,
      reportData: {
        reportType?: string;
        report_data?: ReportData;
        email?: string;
        name?: string;
      }
    ) => {
      if (!user) throw new Error('User not authenticated');

      const conversationId = await addThread(user.id, mode, title, reportData);
      await chatController.initializeConversation(conversationId);

      // If insight mode, add to pending map
      if (mode === 'insight') {
        const { pendingInsightThreads } = useChatStore.getState();
        const newPendingMap = new Map(pendingInsightThreads);
        newPendingMap.set(conversationId, {
          reportType: reportData.reportType || '',
          timestamp: Date.now(),
        });
        useChatStore.setState({ pendingInsightThreads: newPendingMap });
      }

      return conversationId;
    },
    [user, addThread]
  );

  const cleanupEmptyConversation = useCallback(
    async (chatId: string) => {
      if (!user?.id || !chatId) return;

      try {
        const { count, error: countError } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('chat_id', chatId);

        if (countError || (count ?? 0) > 0) return;

        // Delete empty conversation
        await supabase
          .from('conversations')
          .delete()
          .eq('id', chatId)
          .eq('user_id', user.id);

        const { removeThread, clearChat } = useChatStore.getState();
        removeThread(chatId, user!.id);
        clearChat();
      } catch (error) {
        safeConsoleError('[useAstroConversation] Cleanup error:', error);
      }
    },
    [user]
  );

  return { createConversation, cleanupEmptyConversation };
};
