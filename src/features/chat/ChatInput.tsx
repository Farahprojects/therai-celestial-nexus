// src/features/chat/ChatInput.tsx
import React, { useState, useRef } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { Mic, AudioLines, ArrowRight, Loader2 } from 'lucide-react';
import { chatController } from './ChatController';
import { useUniversalMic } from '@/hooks/microphone/useUniversalMic';
import { VoiceWaveform } from './VoiceWaveform';
import { useAuth } from '@/contexts/AuthContext';
import { useUserData } from '@/hooks/useUserData';
import { useSearchParams } from 'react-router-dom';
import { useMode } from '@/contexts/ModeContext';
import { useChatInputState } from '@/hooks/useChatInputState';
import { useChatStore } from '@/core/store';
import { useFeatureUsage } from '@/hooks/useFeatureUsage';
import { useMessageStore } from '@/stores/messageStore';
import { unifiedWebSocketService } from '@/services/websocket/UnifiedWebSocketService';
import { supabase } from '@/integrations/supabase/client';
import { Message } from '@/core/types';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { getBillingMode } from '@/utils/billingMode';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { UpgradeNotification } from '@/components/subscription/UpgradeNotification';
import { STTLimitExceededError } from '@/services/voice/stt';
// Using unified message store for all message management

// Stop icon component
const StopIcon = () => (
  <div className="w-3 h-3 bg-black rounded-sm"></div>
);

export const ChatInput = () => {
  const [text, setText] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [showUpgradeNotification, setShowUpgradeNotification] = useState(false);
  const [showSTTLimitNotification, setShowSTTLimitNotification] = useState(false);
  const { mode } = useMode();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Scroll input into view when keyboard appears
  const handleFocus = () => {
    // Small delay to let keyboard animation start
    setTimeout(() => {
      textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };
  
  // Get chat locked state
  
  // Use isolated state management to prevent unnecessary re-renders
  const {
    status,
    isAssistantTyping,
    setAssistantTyping,
    chat_id,
    addThread,
    isPolling,
    isReportReady,
    isConversationOpen,
    openConversation,
    closeConversation,
    isAssistantGenerating,
    isRecording,
  } = useChatInputState();
  
  
  // Auth detection (still needed for user-specific logic)
  const { user } = useAuth();
  const { displayName } = useUserData();
  const { isSubscriptionActive } = useSubscription();
  const { usage } = useFeatureUsage();
  const billingMode = getBillingMode();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('user_id');
  const isAuthenticated = !!user;

  // Handle transcript ready - add to text area
  const handleTranscriptReady = (transcript: string) => {
    const currentText = text || '';
    const newText = currentText ? `${currentText} ${transcript}` : transcript;
    setText(newText);
  };

  // Handle STT errors (e.g., limit exceeded)
  const handleMicError = (error: Error) => {
    if (error instanceof STTLimitExceededError) {
      console.log('[ChatInput] STT limit exceeded, showing upgrade notification');
      setShowSTTLimitNotification(true);
    }
  };

  // Universal microphone pipeline
  const { 
    isRecording: isMicRecording, 
    isProcessing: isMicProcessing,
    toggleRecording: toggleMicRecording,
    audioLevelRef
  } = useUniversalMic({
    onTranscriptReady: handleTranscriptReady,
    onError: handleMicError,
  });

  const handleSend = async () => {
    if (!text.trim()) return;

    // Gate: Check subscription in subscription mode
    if (billingMode === 'SUBSCRIPTION' && isAuthenticated && !isSubscriptionActive) {
      toast.error('Subscription required to send messages');
      navigate('/subscription-paywall');
      return;
    }

      let currentChatId = chat_id;
      
      // For authenticated users: create conversation if no chat_id exists
      if (isAuthenticated && !chat_id && user) {
      // Gate: Check subscription before creating new thread
      if (billingMode === 'SUBSCRIPTION' && !isSubscriptionActive) {
        toast.error('Subscription required to create new conversations');
        navigate('/subscription-paywall');
        return;
      }

        try {
          console.log('[ChatInput] Creating new conversation for authenticated user');
          const newChatId = await addThread(user.id, 'chat', 'New Chat');
          
          // Initialize the conversation in chatController (store will handle state)
          await chatController.initializeConversation(newChatId);
          
          // Use the newly created chat_id for this message
          currentChatId = newChatId;
          
          console.log('[ChatInput] New conversation created and initialized:', newChatId);
        } catch (error) {
          console.error('[ChatInput] Failed to create conversation:', error);
          return; // Don't send message if conversation creation failed
        }
      }
      
      const messageText = text.trim();
      const client_msg_id = crypto.randomUUID();
      
      // INSTANT UI UPDATES (no delays)
      setText(''); // Clear input instantly
      setAssistantTyping(true); // Show stop icon
      
      // Show optimistic message immediately in UI
      const optimisticMessage: Message = {
        id: client_msg_id,
        chat_id: currentChatId!,
        role: 'user',
        text: messageText,
        createdAt: new Date().toISOString(),
        status: 'thinking',
        client_msg_id,
        mode: mode,
        user_id: user?.id,
        user_name: displayName || 'User'
      };
      
      const { addOptimisticMessage } = useMessageStore.getState();
      addOptimisticMessage(optimisticMessage);
      
      // Fire-and-forget invoke (truly non-blocking via queueMicrotask)
      queueMicrotask(() => {
        supabase.functions.invoke('chat-send', {
          body: {
            chat_id: currentChatId!,
            text: messageText,
            client_msg_id,
            mode: mode,
            user_id: user?.id,
            user_name: displayName || 'User'
          }
        }).catch((error) => {
          console.error('[ChatInput] Message send failed:', error);
        });
      });
  };

  const handleSpeakerClick = () => {
    if (!isConversationOpen) {
      if (!chat_id) {
        console.error('[ChatInput] Cannot open conversation - no chat_id available');
        return;
      }
      // Gate: Check subscription in subscription mode
      if (billingMode === 'SUBSCRIPTION' && isAuthenticated && !isSubscriptionActive) {
        setShowUpgradeNotification(true);
        return;
      }
      // Opening conversation
      openConversation();
      return;
    }
    if (status === 'recording') {
      return;
    } else {
      chatController.resetConversationService();
      closeConversation();
    }
  };

  const handleMicClick = () => {
    // Gate: Check subscription in subscription mode
    if (billingMode === 'SUBSCRIPTION' && isAuthenticated && !isSubscriptionActive) {
      setShowUpgradeNotification(true);
      return;
    }
    
    // Gate: Check STT limit (2 minutes = 120 seconds for free tier)
    if (usage && !usage.subscription_active) {
      const STT_FREE_LIMIT = 120; // 2 minutes
      if (usage.voice_seconds.used >= STT_FREE_LIMIT) {
        console.log('[ChatInput] STT limit reached, showing upgrade notification');
        setShowSTTLimitNotification(true);
        return;
      }
    }
    
    toggleMicRecording();
  };

  const handleRightButtonClick = () => {
    if (isAssistantTyping) {
      // Stop the typing animation
      setAssistantTyping(false);
    } else if (text.trim()) {
      handleSend();
    } else {
      // Open conversation mode when no text is entered
      // Gate: Check subscription in subscription mode
      if (billingMode === 'SUBSCRIPTION' && isAuthenticated && !isSubscriptionActive) {
        setShowUpgradeNotification(true);
        return;
      }
      handleSpeakerClick();
    }
  };

  // isRecording and isAssistantGenerating are now provided by useChatInputState

  // Custom solid black square component
  const SolidBlackSquare = () => (
    <div className="w-3 h-3 bg-black rounded-sm"></div>
  );

  // Determine mic button state and content
  const getMicButtonContent = () => {
    if (isMicProcessing) {
      return <Loader2 size={18} className="animate-spin text-gray-500" />;
    }
    if (isMicRecording) {
      return (
        <div className="w-4 h-4 flex items-center justify-center">
          <div className="w-3 h-0.5 bg-black transform rotate-45 absolute"></div>
          <div className="w-3 h-0.5 bg-black transform -rotate-45 absolute"></div>
        </div>
      );
    }
    return <Mic size={18} className="text-gray-500" />;
  };

  const getMicButtonTitle = () => {
    if (isMicProcessing) {
      return 'Processing audio...';
    }
    if (isMicRecording) {
      return 'Stop recording';
    }
    return 'Start voice recording';
  };

  return (
    <div className="bg-white backdrop-blur-lg border-t border-gray-100 p-2 relative mobile-input-container" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0.5rem)' }}>
      <div className="flex items-end gap-2 max-w-4xl mx-auto">
        <div className="flex-1 relative">
          {isMicRecording ? (
            <div className="w-full h-[46px] flex items-center justify-center bg-white border-2 border-gray-300 rounded-3xl overflow-hidden">
              <VoiceWaveform audioLevelRef={audioLevelRef} />
            </div>
          ) : (
            <TextareaAutosize
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onFocus={handleFocus}
              placeholder={isAssistantGenerating ? "Setting up your space..." : billingMode === 'SUBSCRIPTION' && isAuthenticated && !isSubscriptionActive ? "Subscription required to send messages" : "Share your thoughts..."}
              disabled={isAssistantGenerating || (billingMode === 'SUBSCRIPTION' && isAuthenticated && !isSubscriptionActive)}
              className={`w-full px-4 py-2.5 pr-24 text-base font-light bg-white border-2 rounded-3xl focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400 resize-none text-black placeholder-gray-500 overflow-y-auto ${
                isAssistantGenerating || (billingMode === 'SUBSCRIPTION' && isAuthenticated && !isSubscriptionActive)
                  ? 'border-gray-200 bg-gray-50 cursor-not-allowed' 
                  : 'border-gray-300'
              }`}
              style={{ fontSize: '16px' }} // Prevents zoom on iOS
              maxRows={4}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !isAssistantGenerating) {
                  e.preventDefault();
                  // Gate: Check subscription before sending
                  if (billingMode === 'SUBSCRIPTION' && isAuthenticated && !isSubscriptionActive) {
                    toast.error('Subscription required to send messages');
                    navigate('/subscription-paywall');
                    return;
                  }
                  handleSend();
                }
              }}
            />
          )}
          <div className="absolute right-1 inset-y-0 flex items-center gap-1 z-10" style={{ transform: 'translateY(-4px) translateX(-4px)' }}>
            <button 
              className={`mic-button w-8 h-8 transition-all duration-200 ease-in-out flex items-center justify-center ${
                isAssistantGenerating 
                  ? 'text-gray-300 cursor-not-allowed' 
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              onClick={handleMicClick}
              disabled={isMicProcessing || isAssistantGenerating}
              title={isAssistantGenerating ? "Setting up your space..." : getMicButtonTitle()}
            >
              {getMicButtonContent()}
            </button>
            <button 
              className={`audio-button transition-colors ${
                isAssistantTyping || isAssistantGenerating
                  ? 'w-8 h-8 bg-white border border-black rounded-full text-black flex items-center justify-center' 
                  : text.trim() 
                    ? 'w-8 h-8 bg-white border border-black rounded-full text-black hover:bg-gray-50 flex items-center justify-center' 
                    : 'w-8 h-8 text-gray-500 hover:text-gray-900 flex items-center justify-center'
              }`}
              onClick={handleRightButtonClick}
              disabled={isAssistantGenerating}
            >
              {isAssistantTyping ? (
                <StopIcon />
              ) : isAssistantGenerating ? (
                <SolidBlackSquare />
              ) : text.trim() ? (
                <ArrowRight size={16} className="text-black" />
              ) : (
                <AudioLines size={18} className={isRecording ? 'text-red-500' : ''} />
              )}
            </button>
          </div>
        </div>
      </div>
      <div className="max-w-4xl mx-auto mt-2">
        <p className="text-xs text-gray-600 font-light text-center">
          Therai can make mistakes. Check important info.
        </p>
      </div>
      <UpgradeNotification
        isVisible={showUpgradeNotification}
        onDismiss={() => setShowUpgradeNotification(false)}
        message="Subscription required"
      />
      
      {/* STT Limit Notification - pill-shaped popup above chat bar */}
      <UpgradeNotification
        isVisible={showSTTLimitNotification}
        onDismiss={() => setShowSTTLimitNotification(false)}
        message="Voice limit reached. Upgrade for unlimited."
      />
    </div>
  );
};
