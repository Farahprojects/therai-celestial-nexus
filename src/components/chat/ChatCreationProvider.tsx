import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { getBillingMode } from '@/utils/billingMode';
import { useChatStore } from '@/core/store';
import { useMessageStore } from '@/stores/messageStore';
import { InsightsModal } from '@/components/insights/InsightsModal';
import { AstroChartSelector } from '@/components/chat/AstroChartSelector';
import { AstroDataForm } from '@/components/chat/AstroDataForm';
import { ProfileSelectorModal } from '@/components/sync/ProfileSelectorModal';
import { ReportFormData } from '@/types/public-report';
import { AuthModal } from '@/components/auth/AuthModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type ChatMode = 'chat' | 'astro' | 'insight' | 'together' | 'sync_score';

interface ChatCreationContextValue {
  startChat: () => Promise<void>;
  startTogetherMode: () => Promise<void>;
  openAstroFlow: () => void;
  openInsightsFlow: () => void;
  openSyncScoreFlow: () => void;
}

const ChatCreationContext = createContext<ChatCreationContextValue | undefined>(undefined);

export const useChatCreation = (): ChatCreationContextValue => {
  const ctx = useContext(ChatCreationContext);
  if (!ctx) {
    throw new Error('useChatCreation must be used within a ChatCreationProvider');
  }
  return ctx;
};

export const ChatCreationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { isSubscriptionActive } = useSubscription();
  const billingMode = getBillingMode();
  const navigate = useNavigate();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showInsightsModal, setShowInsightsModal] = useState(false);
  const [showAstroChartSelector, setShowAstroChartSelector] = useState(false);
  const [showAstroModal, setShowAstroModal] = useState(false);
  const [showSyncScoreModal, setShowSyncScoreModal] = useState(false);
  const [isSyncScoreGenerating, setIsSyncScoreGenerating] = useState(false);
  const [selectedChartType, setSelectedChartType] = useState<string | null>(null);

  const requireEligibleUser = useCallback((requireSubscription: boolean = false): boolean => {
    if (!user) {
      setShowAuthModal(true);
      return false;
    }

    // Only block for premium features (Insights, Astro) - not for regular chat or Together Mode
    if (requireSubscription && billingMode === 'SUBSCRIPTION' && !isSubscriptionActive) {
      navigate('/subscription-paywall');
      return false;
    }

    return true;
  }, [billingMode, isSubscriptionActive, navigate, user]);

  const handleNewConversation = useCallback(async (mode: ChatMode) => {
    // ✅ NEW: Free users can create chats - limits enforced at message level
    if (!requireEligibleUser(false)) return;
    if (!user) return;

    try {
      // Set initial title based on mode
      const title =
        mode === 'insight'
          ? 'New Insight Chat'
          : mode === 'together'
          ? 'Together Mode'
          : 'Chat'; // Placeholder for standard chat - will be upgraded on first message

      const conversationMode: 'chat' | 'astro' | 'insight' | 'swiss' | 'together' = mode;

      const { addThread } = useChatStore.getState();
      const newChatId = await addThread(user.id, conversationMode, title);

      const { setChatId } = useMessageStore.getState();
      setChatId(newChatId);

      const { startConversation } = useChatStore.getState();
      startConversation(newChatId);

      const { chatController } = await import('@/features/chat/ChatController');
      await chatController.switchToChat(newChatId);

      navigate(`/c/${newChatId}`, { replace: true });
    } catch (error) {
      console.error('[ChatCreationProvider] Failed to create conversation:', error);
    }
  }, [navigate, requireEligibleUser, user]);

  const openAstroFlow = useCallback(() => {
    // ✅ Astro requires subscription
    if (!requireEligibleUser(true)) return;
    setShowAstroChartSelector(true);
  }, [requireEligibleUser]);

  const openInsightsFlow = useCallback(() => {
    // ✅ Insights require subscription
    if (!requireEligibleUser(true)) return;
    setShowInsightsModal(true);
  }, [requireEligibleUser]);

  const openSyncScoreFlow = useCallback(() => {
    // ✅ Sync Score requires subscription
    if (!requireEligibleUser(true)) return;
    setShowSyncScoreModal(true);
  }, [requireEligibleUser]);

  const handleProfileSelect = useCallback(async (selectedProfile: any) => {
    if (!user) return;

    try {
      setIsSyncScoreGenerating(true);

      // Get user's primary profile
      const { data: primaryProfile, error: primaryError } = await supabase
        .from('user_profile_list')
        .select('*')
        .eq('is_primary', true)
        .single();

      if (primaryError || !primaryProfile) {
        toast.error('Please set up your primary profile in Settings first');
        setIsSyncScoreGenerating(false);
        return;
      }

      // Create conversation title
      const title = `Sync Score: ${primaryProfile.name} & ${selectedProfile.name}`;

      // Create the conversation with profile data in metadata
      const { addThread } = useChatStore.getState();
      const newChatId = await addThread(user.id, 'sync_score', title);

      // Navigate to conversation immediately (give instant feedback)
      const { setChatId } = useMessageStore.getState();
      setChatId(newChatId);

      const { startConversation } = useChatStore.getState();
      startConversation(newChatId);

      const { chatController } = await import('@/features/chat/ChatController');
      await chatController.switchToChat(newChatId);

      setShowSyncScoreModal(false);
      setIsSyncScoreGenerating(false);
      navigate(`/c/${newChatId}`, { replace: true });

      // Prepare the data payload for initiate-auth-report
      const payload = {
        chat_id: newChatId,
        mode: 'sync_score',
        report_data: {
          request: 'synastry', // Tell translator this is a synastry request
          reportType: null, // No report needed, just Swiss data for synastry
          person_a: {
            name: primaryProfile.name,
            birth_date: primaryProfile.birth_date,
            birth_time: primaryProfile.birth_time,
            location: primaryProfile.birth_location,
            latitude: primaryProfile.birth_latitude,
            longitude: primaryProfile.birth_longitude,
            place_id: primaryProfile.birth_place_id,
            tz: primaryProfile.timezone,
          },
          person_b: {
            name: selectedProfile.name,
            birth_date: selectedProfile.birth_date,
            birth_time: selectedProfile.birth_time,
            location: selectedProfile.birth_location,
            latitude: selectedProfile.birth_latitude,
            longitude: selectedProfile.birth_longitude,
            place_id: selectedProfile.birth_place_id,
            tz: selectedProfile.timezone,
          },
        },
      };

      // 🚀 FIRE-AND-FORGET: Call initiate-auth-report in background
      supabase.functions.invoke('initiate-auth-report', {
        body: payload,
      }).then(({ error: reportError }) => {
        if (reportError) {
          console.error('[ProfileSelector] Error initiating sync score:', reportError);
          toast.error('Failed to process astrological data');
        }
      });
    } catch (error) {
      console.error('[ProfileSelector] Failed to create sync score:', error);
      toast.error('Failed to create Sync Score');
      setIsSyncScoreGenerating(false);
    }
  }, [user, navigate]);

  const handleSelectChart = useCallback((chartId: string) => {
    setSelectedChartType(chartId);
    setShowAstroChartSelector(false);
    setShowAstroModal(true);
  }, []);

  const handleAstroFormSubmit = useCallback(
    async (data: ReportFormData & { chat_id?: string }) => {
      if (!user) return;
      try {
        const newChatId = data.chat_id;
        if (!newChatId) {
          console.error('[ChatCreationProvider] Missing chat_id from astro submission');
          return;
        }

        const { setChatId } = useMessageStore.getState();
        setChatId(newChatId);

        const { startConversation } = useChatStore.getState();
        startConversation(newChatId);

        const { chatController } = await import('@/features/chat/ChatController');
        await chatController.switchToChat(newChatId);

        setShowAstroModal(false);
        setSelectedChartType(null);
        navigate(`/c/${newChatId}`, { replace: true });
      } catch (error) {
        console.error('[ChatCreationProvider] Failed to open astro conversation:', error);
      }
    },
    [navigate, user]
  );

  const closeAstroModal = useCallback(() => {
    setShowAstroModal(false);
    setSelectedChartType(null);
  }, []);

  const backToChartSelector = useCallback(() => {
    setShowAstroModal(false);
    setShowAstroChartSelector(true);
  }, []);

  const contextValue: ChatCreationContextValue = useMemo(
    () => ({
      startChat: () => handleNewConversation('chat'),
      startTogetherMode: () => handleNewConversation('together'),
      openAstroFlow,
      openInsightsFlow,
      openSyncScoreFlow,
    }),
    [handleNewConversation, openAstroFlow, openInsightsFlow, openSyncScoreFlow]
  );

  return (
    <ChatCreationContext.Provider value={contextValue}>
      {children}

      <InsightsModal
        isOpen={showInsightsModal}
        onClose={() => setShowInsightsModal(false)}
      />

      {showAstroChartSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <AstroChartSelector
              onSelectChart={handleSelectChart}
              onClose={() => setShowAstroChartSelector(false)}
            />
          </div>
        </div>
      )}

      {showAstroModal && selectedChartType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl">
            <AstroDataForm
              onClose={closeAstroModal}
              onSubmit={handleAstroFormSubmit}
              onBack={backToChartSelector}
              mode="astro"
              preselectedType={selectedChartType}
              reportType={selectedChartType}
            />
          </div>
        </div>
      )}

      <ProfileSelectorModal
        isOpen={showSyncScoreModal}
        onClose={() => setShowSyncScoreModal(false)}
        onSelect={handleProfileSelect}
        isGenerating={isSyncScoreGenerating}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultMode="login"
      />
    </ChatCreationContext.Provider>
  );
};

