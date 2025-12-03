import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useConversationUIStore } from '@/features/chat/conversation-ui-store';
import { useChatStore } from '@/core/store';
import { useAudioStore } from '@/stores/audioStore';
import { useMode } from '@/contexts/ModeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUserData } from '@/hooks/useUserData';
import { useMessageStore } from '@/stores/messageStore';
// Old audio level hook removed - using AudioWorklet + WebWorker pipeline
import { VoiceBubble } from './VoiceBubble';
import { AudioRouteControls } from './AudioRouteControls';
// Universal audio pipeline
import { UniversalSTTRecorder } from '@/services/audio/UniversalSTTRecorder';
import { ttsPlaybackService } from '@/services/voice/TTSPlaybackService';
import { STTLimitExceededError } from '@/services/voice/stt-errors';
// llmService import removed - not used in this file
import { unifiedChannel } from '@/services/websocket/UnifiedChannelService';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic } from 'lucide-react';
import { UpgradeNotification } from '@/components/subscription/UpgradeNotification';
import { Capacitor } from '@capacitor/core';
import BluetoothAudio from '@/plugins/BluetoothAudio';
// Lazy import for audio arbitrator to avoid circular dependencies
const audioArbitratorImport = () => import('@/services/audio/AudioArbitrator');

type ConversationState = 'listening' | 'thinking' | 'replying' | 'connecting' | 'establishing';

export const ConversationOverlay: React.FC = () => {
  const { isConversationOpen, closeConversation, setShouldKeepClosed } = useConversationUIStore();
  const chat_id = useChatStore((state) => state.chat_id);
  const { mode } = useMode();
  const { user } = useAuth();
  const { displayName } = useUserData();
  const addMessage = useMessageStore((state) => state.addMessage);
  const [state, setState] = useState<ConversationState>('connecting');
  const [showSTTLimitNotification, setShowSTTLimitNotification] = useState(false);

  // Audio context management
  const { audioContext, isAudioUnlocked, initializeAudioContext, resumeAudioContext } = useAudioStore();

  // Realtime level driven by worker (not React polling) - use ref for smooth animation
  const audioLevelRef = useRef<number>(0);

  const hasStarted = useRef(false);
  const isShuttingDown = useRef(false);
  const connectionRef = useRef<WebSocket | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const recorderRef = useRef<UniversalSTTRecorder | null>(null);
  const isStartingRef = useRef(false);
  const isActiveRef = useRef(false);
  const wasSubscribedRef = useRef(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // 🚨 RESET TO TAP TO START - ROBUST cleanup with validation
  const resetToTapToStart = useCallback(async () => {

    // 1. IMMEDIATE GUARDS - Stop all operations
    isShuttingDown.current = true;
    isProcessingRef.current = false;
    isStartingRef.current = false;
    isActiveRef.current = false;
    wasSubscribedRef.current = false;

    // 2. DISABLE TTS MODE - Flush buffered messages back to text mode
    try {
      const { chatController } = await import('@/features/chat/ChatController');
      chatController.setTtsMode(false);

      // 🔄 CRITICAL: Refetch messages after conversation mode to ensure UI consistency
      if (chat_id) {
        const { fetchMessages } = useMessageStore.getState();
        // Small delay to ensure all async message operations complete
        await new Promise(resolve => setTimeout(resolve, 300));
        await fetchMessages();
        console.log('[ConversationOverlay] ✅ Messages resynced after reset');
      }
    } catch (e) {
      console.error('[ConversationOverlay] Failed to disable TTS mode:', e);
    }

    // Force cleanup all resources (fire-and-forget)
    ttsPlaybackService.destroy().catch((error) => {
      console.warn('[ConversationOverlay] Failed to destroy TTS playback service:', error);
    });
    try { recorderRef.current?.dispose(); } catch (error) {
      console.warn('[ConversationOverlay] Failed to dispose recorder:', error);
    }

    // Cleanup WebSocket connection
    if (connectionRef.current) {
      try {
        connectionRef.current.close();
      } catch {
        // Ignore WebSocket cleanup errors
      }
      connectionRef.current = null;
    }

    // Reset audio arbitrator
    try {
      const { audioArbitrator } = await audioArbitratorImport();
      audioArbitrator.forceReleaseAll();
    } catch {
      // Ignore arbitrator errors
    }

    // Always return to tap-to-start state (no error UI)
    setState('connecting');
    hasStarted.current = false;
    isShuttingDown.current = false;
  }, [chat_id]);

  // 🎵 AUDIOCONTEXT USER GESTURE LISTENER - Critical for Chrome
  useEffect(() => {
    if (!overlayRef.current || isAudioUnlocked) return;

    const handleUserGesture = async () => {
      // Initialize AudioContext if not exists
      if (!audioContext) {
        initializeAudioContext();
      }

      // Resume AudioContext
      const success = await resumeAudioContext();
      if (!success) {
        console.error('[ConversationOverlay] ❌ Failed to unlock AudioContext');
      }
    };

    // Add event listeners for user gestures
    overlayRef.current.addEventListener('click', handleUserGesture, { once: true });
    overlayRef.current.addEventListener('touchstart', handleUserGesture, { once: true });

    return () => {
      if (overlayRef.current) {
        overlayRef.current.removeEventListener('click', handleUserGesture);
        overlayRef.current.removeEventListener('touchstart', handleUserGesture);
      }
    };
  }, [audioContext, isAudioUnlocked, initializeAudioContext, resumeAudioContext]);

  // WebSocket connection setup - now uses unified channel
  const establishConnection = useCallback(async () => {
    if (!chat_id || !user) {
      console.error('[ConversationOverlay] ❌ No chat_id or user available for unified channel');
      return false;
    }

    if (connectionRef.current) {
      return true;
    }

    try {
      // Use unified channel - subscribe if not already subscribed
      await unifiedChannel.subscribe(user.id);

      // Register voice event listeners
      const handleTTSReady = (payload: { audioBase64: string }) => {
        if (isShuttingDown.current) return;
        if (payload.audioBase64) {
          setState('replying');
          // Try TTS service first, fallback to direct playback
          ttsPlaybackService.playBase64(payload.audioBase64, () => {
            setState('listening');
            if (!isShuttingDown.current) {
              setTimeout(() => {
                if (!isShuttingDown.current) {
                  try {
                    recorderRef.current?.resumeInput();
                    recorderRef.current?.startNewRecording();
                    // eslint-disable-next-line no-empty
                  } catch {
                    // Silently ignore recording resume/start errors
                  }
                }
              }, 200);
            }
          }).catch((e) => {
            console.error('[ConversationOverlay] ❌ TTS base64 playback failed:', e);
            // Fallback: just continue without audio playback for now
          });
        }
      };

      const handleThinking = () => {
        if (!isShuttingDown.current) {
          setState('thinking');
        }
      };

      const handleMessageInsert = (payload: { message?: unknown; chat_id?: string }) => {
        if (isShuttingDown.current) return;
        if (payload.message && payload.chat_id === chat_id) {
          console.log('[ConversationOverlay] Received message-insert, adding to store:', payload.message);
          addMessage(payload.message);
        }
      };

      // Register listeners
      const unsubscribeTTS = unifiedChannel.on('voice-tts-ready', handleTTSReady);
      const unsubscribeThinking = unifiedChannel.on('voice-thinking', handleThinking);
      const unsubscribeMessageInsert = unifiedChannel.on('message-insert', handleMessageInsert);

      // Store cleanup functions
      connectionRef.current = {
        cleanup: () => {
          unsubscribeTTS();
          unsubscribeThinking();
          unsubscribeMessageInsert();
        }
      };

      wasSubscribedRef.current = true;
      return true;
    } catch (error) {
      console.error('[ConversationOverlay] Connection failed:', error);
      resetToTapToStart();
      return false;
    }
  }, [chat_id, user, addMessage]);

  // TTS playback
  const playAudioImmediately = useCallback(async (audioBytes: number[]) => {
    if (isShuttingDown.current) return;

    try {
      // Set state to 'replying' immediately when TTS starts
      // Animation will be driven by actual audio output from TTS service
      setState('replying');

      await ttsPlaybackService.play(audioBytes, () => {
        setState('listening');

        // Resume mic for next turn
        if (!isShuttingDown.current) {
          setTimeout(() => {
            if (!isShuttingDown.current) {
              try {
                // Ensure mic input is on and immediately start a fresh recording segment
                recorderRef.current?.resumeInput();
                recorderRef.current?.startNewRecording();
                // eslint-disable-next-line no-empty
              } catch {
                // Silently ignore recording resume/start errors
              }
            }
          }, 200);
        }
      });
    } catch (error) {
      console.error('[ConversationOverlay] ❌ TTS playback failed:', error);
      resetToTapToStart();
    }
  }, [resetToTapToStart]);

  // Start conversation - ROBUST SEQUENCE with validation
  const handleStart = useCallback(async () => {
    // 1. IDEMPOTENT GUARD - Prevent multiple simultaneous starts
    if (isStartingRef.current || isActiveRef.current || !chat_id || !mode) {
      if (!mode) {
        console.error('[ConversationOverlay] Cannot start: mode is not set');
      }
      return;
    }

    isStartingRef.current = true;
    setState('establishing');

    try {
      // 2. BLUETOOTH ROUTING - SESSION LEVEL (ONCE for entire conversation)
      if (Capacitor.isNativePlatform()) {
        try {
          console.log('[ConversationOverlay] 🔵 Starting Bluetooth SCO for conversation session...');
          const result = await BluetoothAudio.startBluetoothAudio();
          console.log('[ConversationOverlay] ✅ Bluetooth audio session established:', result);

          // Wait for routing to stabilize
          await new Promise(resolve => setTimeout(resolve, 500));

          const status = await BluetoothAudio.isBluetoothConnected();
          console.log('[ConversationOverlay] Bluetooth connection status:', status);
        } catch (error) {
          console.warn('[ConversationOverlay] Bluetooth audio setup failed:', error);
          // Continue anyway - might not have Bluetooth connected
        }
      }

      // 3. MIC PERMISSION PREFLIGHT - Android requires this before AudioContext
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Immediately stop tracks to release mic
        stream.getTracks().forEach(track => track.stop());
      } catch (error) {
        console.error('[ConversationOverlay] Mic permission denied:', error);
        throw new Error('Microphone permission required for conversation mode');
      }

      // 4. AUDIOCONTEXT UNLOCK - Ensure unlock happens within this user gesture
      const ctx = audioContext || initializeAudioContext();
      await resumeAudioContext();

      // 3. STEP 1: Audio Warmup with validation
      const { ttsPlaybackService } = await import('@/services/voice/TTSPlaybackService');
      // Provide shared/unlocked AudioContext to TTS service
      ttsPlaybackService.setAudioContextProvider(() => ctx);
      await ttsPlaybackService.warmup();

      // 4. STEP 2: WebSocket connection with validation
      const connectionEstablished = await establishConnection();
      if (!connectionEstablished) {
        throw new Error('Failed to establish TTS WebSocket connection');
      }

      // 5. STEP 3: Enable TTS mode with validation (pauses DB realtime)
      const { chatController } = await import('@/features/chat/ChatController');
      chatController.setTtsMode(true);

      // 6. STEP 4: Initialize Universal Recorder
      recorderRef.current = new UniversalSTTRecorder({
        chattype: 'voice',
        mode: mode,
        silenceHangover: 600,
        user_id: user?.id,
        user_name: displayName || 'User',
        audioContextProvider: () => audioContext,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        onTranscriptReady: (_transcript: string) => {
          if (isShuttingDown.current || isProcessingRef.current) {
            return;
          }
          isProcessingRef.current = true;
          setState('thinking');
          // TTS will arrive over WS and change UI to "speaking" asynchronously
          isProcessingRef.current = false;
        },
        onLevel: (level) => {
          if (!isShuttingDown.current) audioLevelRef.current = level;
        },
        onError: (error: Error) => {
          // Check if this is an STT limit exceeded error FIRST - don't log it
          if (error instanceof STTLimitExceededError) {
            console.log('[ConversationOverlay] STT limit exceeded, showing upgrade notification');

            // Close overlay immediately
            closeConversation();

            // Set flag to keep overlay closed
            setShouldKeepClosed(true);

            // Show upgrade notification
            setShowSTTLimitNotification(true);

            // Reset state
            resetToTapToStart();
            return;
          }

          // Log other errors normally
          console.error('[ConversationOverlay] Audio recorder error:', error);
          resetToTapToStart();
        }
      });

      // 7. STEP 5: Start recorder
      await recorderRef.current.start();

      // 8. STEP 6: Final validation - All systems ready
      if (!connectionRef.current) {
        throw new Error('TTS WebSocket connection lost during setup');
      }
      if (!recorderRef.current) {
        throw new Error('Audio recorder not initialized');
      }

      // 9. SUCCESS - Mark active only after everything is ready
      isActiveRef.current = true;
      hasStarted.current = true;
      setState('listening');

    } catch (error) {
      console.error('[ConversationOverlay] Start failed:', error);
      resetToTapToStart();
    } finally {
      isStartingRef.current = false;
    }
  }, [chat_id, mode, user, displayName, establishConnection, initializeAudioContext, resumeAudioContext, audioContext, closeConversation, resetToTapToStart, setShouldKeepClosed]);

  // Cleanup on modal close - graceful release with fire-and-forget
  const handleModalClose = useCallback(async () => {
    isShuttingDown.current = true;

    // IMMEDIATE audio stop - no race condition
    ttsPlaybackService.stop();
    ttsPlaybackService.destroy().catch((error) => {
      console.warn('[ConversationOverlay] Failed to destroy TTS service on modal close:', error);
    });

    // Fire-and-forget microphone release
    try { recorderRef.current?.dispose(); } catch {
      // eslint-disable-next-line no-empty
    }

    // BLUETOOTH ROUTING - SESSION LEVEL CLEANUP (ONCE when conversation ends)
    if (Capacitor.isNativePlatform()) {
      try {
        console.log('[ConversationOverlay] 🔴 Stopping Bluetooth SCO session...');
        await BluetoothAudio.stopBluetoothAudio();
        console.log('[ConversationOverlay] ✅ Bluetooth audio session ended');
      } catch (error) {
        console.warn('[ConversationOverlay] Bluetooth audio stop failed:', error);
      }
    }

    // Fire-and-forget WebSocket cleanup
    if (connectionRef.current) {
      try {
        connectionRef.current.close();
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_e) {
        // Ignore WebSocket cleanup errors
      }
      connectionRef.current = null;
    }

    // ▶️ DISABLE TTS MODE: Flush buffered messages back to text mode
    // 🔥 FIX: Wait for TTS mode to disable, then refetch messages to ensure consistency
    try {
      const { chatController } = await import('@/features/chat/ChatController');
      chatController.setTtsMode(false);

      // 🔄 CRITICAL: Refetch messages after conversation mode to ensure UI consistency
      // This handles any race conditions or missed messages during voice mode
      if (chat_id) {
        const { fetchMessages } = useMessageStore.getState();
        // Small delay to ensure all async message operations complete
        await new Promise(resolve => setTimeout(resolve, 300));
        await fetchMessages();
        console.log('[ConversationOverlay] ✅ Messages resynced after conversation mode');
      }
    } catch (error) {
      console.error('[ConversationOverlay] Error during cleanup:', error);
    }

    // Reset state
    setState('connecting');
    hasStarted.current = false;
    isShuttingDown.current = false;

    closeConversation();
  }, [closeConversation, chat_id]);

  // Reset to tap-to-start when entering connecting state (idempotent cleanup)
  useEffect(() => {
    if (state === 'connecting') {
      // Hard-reset flags to avoid stuck guards
      isStartingRef.current = false;
      isActiveRef.current = false;
      isProcessingRef.current = false;
      isShuttingDown.current = false;
      wasSubscribedRef.current = false;
      hasStarted.current = false;

      // Disable TTS mode proactively
      import('@/features/chat/ChatController').then(({ chatController }) => {
        try { chatController.setTtsMode(false); } catch (error) {
          console.warn('[ConversationOverlay] Failed to disable TTS mode:', error);
        }
      }).catch((error) => {
        console.warn('[ConversationOverlay] Failed to import ChatController:', error);
      });

      // Idempotent cleanup when returning to tap-to-start
      if (connectionRef.current) {
        try {
          connectionRef.current.close();
        } catch {
          // eslint-disable-next-line no-empty
        }
        connectionRef.current = null;
      }

      // Clean up ChatController resources
      import('@/features/chat/ChatController').then(({ chatController }) => {
        try {
          chatController.cleanup();
        } catch (e) {
          console.error('[ConversationOverlay] Failed to cleanup ChatController:', e);
        }
      }).catch((error) => {
        console.warn('[ConversationOverlay] Failed to import ChatController for cleanup:', error);
      });

      try { recorderRef.current?.dispose(); } catch {
        // eslint-disable-next-line no-empty
      }
      ttsPlaybackService.destroy().catch(() => { });
    }
  }, [state]);

  // Manage mic state based on conversation UI state
  useEffect(() => {
    if (!recorderRef.current) return;

    if (state === 'listening') {
      // Resume mic input so user can speak
      try { recorderRef.current.resumeInput(); } catch {
        // eslint-disable-next-line no-empty
      }
    } else {
      // Pause mic input during thinking/replying/connecting/establishing
      try { recorderRef.current.pauseInput(); } catch {
        // eslint-disable-next-line no-empty
      }
    }
  }, [state]);

  // Cleanup on unmount to prevent WebSocket race condition
  useEffect(() => {
    return () => {
      resetToTapToStart();
    };
  }, [resetToTapToStart]);

  // SSR guard
  if (!isConversationOpen || typeof document === 'undefined') return null;

  return (
    <>
      {createPortal(
        <div
          ref={overlayRef}
          className="fixed inset-0 z-50 bg-white pt-safe pb-safe"
          data-conversation-overlay
        >
          <div className="h-full w-full flex items-center justify-center px-6">
            {state === 'connecting' ? (
              <div className="text-center text-gray-800 flex flex-col items-center gap-4">
                <div
                  className="flex flex-col items-center gap-4 cursor-pointer"
                  onClick={() => {
                    handleStart();
                  }}
                >
                  <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center transition-colors hover:bg-gray-200 relative">
                    <Mic className="w-10 h-10 text-gray-600" />
                  </div>
                  <h2 className="text-2xl font-light">
                    Tap to Start
                  </h2>
                </div>
                <button
                  onClick={handleModalClose}
                  aria-label="Close conversation"
                  className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-white hover:bg-gray-800 transition-colors"
                >
                  ✕
                </button>
              </div>
            ) : state === 'establishing' ? (
              <div className="text-center text-gray-800 flex flex-col items-center gap-4">
                <div className="relative flex items-center justify-center">
                  {/* Slow single-rotation spinner ring around the grey circle */}
                  <div className="absolute -inset-2 rounded-full border-2 border-gray-300 border-t-gray-600" style={{ animation: 'spin 2s linear 1' }}></div>
                  <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center relative z-10">
                    <Mic className="w-10 h-10 text-gray-600" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-6 relative">
                {/* Audio routing controls in top-right */}
                <AudioRouteControls />

                <AnimatePresence mode="wait">
                  <motion.div
                    key={state}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                  >
                    <VoiceBubble state={state} audioLevelRef={audioLevelRef} />
                  </motion.div>
                </AnimatePresence>

                <div className="flex flex-col items-center gap-2">
                  <p className="text-gray-500 font-light">
                    {state === 'listening'
                      ? 'Listening…'
                      : state === 'thinking'
                        ? 'Thinking…'
                        : 'Speaking…'}
                  </p>
                </div>

                <button
                  onClick={handleModalClose}
                  aria-label="Close conversation"
                  className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-white hover:bg-gray-800 transition-colors"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* STT Limit Notification - pill-shaped popup above chat bar */}
      <UpgradeNotification
        isVisible={showSTTLimitNotification}
        onDismiss={() => {
          setShowSTTLimitNotification(false);
          // Reset the flag when user dismisses notification (allows reopening)
          setShouldKeepClosed(false);
        }}
        message="Voice limit reached. Upgrade for unlimited."
      />
    </>
  );
};