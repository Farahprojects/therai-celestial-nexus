// Simple universal microphone hook - no chunks, no rolling buffer

import { useState, useCallback, useRef, useEffect } from 'react';
import { UniversalSTTRecorder } from '@/services/audio/UniversalSTTRecorder';
import { STTLimitExceededError } from '@/services/voice/stt-errors';
import { showToast } from '@/utils/notifications';
import { useAuth } from '@/contexts/AuthContext';
import { useUserData } from '@/hooks/useUserData';
import { useMode } from '@/contexts/ModeContext';
import { useAudioStore } from '@/stores/audioStore';

interface UseUniversalMicOptions {
  onTranscriptReady?: (transcript: string) => void;
  onError?: (error: Error) => void;
  silenceThreshold?: number;
  silenceDuration?: number;
  chat_id?: string; // optional chat_id (e.g., for journal entries using folder_id)
  chattype?: string;
  chatType?: string; // alias for compatibility
  mode?: string;
}

export const useUniversalMic = (options: UseUniversalMicOptions = {}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { user } = useAuth();
  const { displayName } = useUserData();
  const { mode } = useMode();
  const { audioContext } = useAudioStore();
  const [audioLevel, setAudioLevel] = useState(0);
  const recorderRef = useRef<UniversalSTTRecorder | null>(null);
  const levelRef = useRef(0);
  

  // Smooth UI animations
  useEffect(() => {
    const tick = () => {
      setAudioLevel(levelRef.current);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, []);

  const startRecording = useCallback(async (): Promise<boolean> => {
    if (isRecording || isProcessing) return false;

    try {
      const resolvedMode = options.mode ?? mode ?? 'chat';
      const resolvedChatType = options.chattype ?? options.chatType ?? 'text';

      // Check secure context
      if (!window.isSecureContext && location.hostname !== 'localhost') {
        throw new Error('Microphone requires HTTPS or localhost');
      }

      // Check getUserMedia support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia not supported');
      }

      // Check current permission state (for debugging)
      try {
        await navigator.permissions.query({ name: 'microphone' as PermissionName });
      } catch {
        // Ignore permission query errors
      }

      recorderRef.current = new UniversalSTTRecorder({
        chat_id: options.chat_id, // Pass through chat_id if provided
        chattype: resolvedChatType,
        audioContextProvider: () => audioContext,
        onTranscriptReady: (transcript) => {
          
          // 1. First: Turn off browser mic (dispose recorder)
          if (recorderRef.current) {
            recorderRef.current.dispose();
            recorderRef.current = null;
          }
          
          // 2. Second: Stop wave animation (set recording state)
          setIsRecording(false);
          setIsProcessing(false);
          
          // 3. Third: Show text in UI
          options.onTranscriptReady?.(transcript);
        },
        onError: (error) => {
          // Handle STTLimitExceededError specially
          if (error instanceof STTLimitExceededError) {
            // 1. Dispose recorder (turn off mic)
            if (recorderRef.current) {
              recorderRef.current.dispose();
              recorderRef.current = null;
            }
            
            // 2. Reset state
            setIsRecording(false);
            setIsProcessing(false);
            levelRef.current = 0;
            
            // 3. Pass error to parent component (ChatInput) to show upgrade modal
            options.onError?.(error);
            return;
          }
          
          console.error('[useUniversalMic] Recorder error:', error);
          
          let errorMessage = 'Could not access microphone.';
          if (error.message.includes('Permission denied') || error.message.includes('NotAllowedError')) {
            errorMessage = 'Microphone permission denied. Please allow microphone access in your browser settings.';
          } else if (error.message.includes('NotFoundError')) {
            errorMessage = 'No microphone found. Please connect a microphone and try again.';
          } else if (error.message.includes('NotReadableError')) {
            errorMessage = 'Microphone is being used by another application.';
          }
          
          showToast({
            title: 'Microphone Error',
            description: errorMessage,
            variant: 'destructive',
          });
          setIsRecording(false);
          setIsProcessing(false);
        },
        onLevel: (level) => {
          levelRef.current = level;
        },
        onProcessingStart: () => {
          // Silence detected - stop recording UI, show spinner for STT processing
          setIsRecording(false);
          setIsProcessing(true);
        },
        // Use smart defaults from recorder (600ms baseline with early voice detection)
        silenceMargin: 0.15, // 15% below baseline
        silenceHangover: 600, // 600ms silence detection (slight hang)
        user_id: user?.id, // Add user_id for message attribution
        user_name: displayName || 'User', // Add user_name for message attribution
        mode: resolvedMode, // Add mode for message context (defaults to chat)
      });

      await recorderRef.current.start();
      setIsRecording(true);
      return true;

    } catch (error) {
      console.error('[useUniversalMic] Start recording failed:', error);
      
      let errorMessage = 'Please allow microphone access and try again.';
      if (error instanceof Error) {
        if (error.message.includes('Permission denied') || error.message.includes('NotAllowedError')) {
          errorMessage = 'Microphone permission denied. Please allow microphone access in your browser settings.';
        } else if (error.message.includes('NotFoundError')) {
          errorMessage = 'No microphone found. Please connect a microphone and try again.';
        } else if (error.message.includes('NotReadableError')) {
          errorMessage = 'Microphone is being used by another application.';
        } else if (error.message.includes('HTTPS')) {
          errorMessage = 'Microphone access requires HTTPS. Please use a secure connection.';
        }
      }
      
      showToast({
        title: 'Microphone Access Failed',
        description: errorMessage,
        variant: 'destructive',
      });
      setIsProcessing(false);
      return false;
    }
  }, [isRecording, isProcessing, options, user?.id, displayName, mode, audioContext]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current) {
      // Fully stop media source for chat bar use-case
      recorderRef.current.dispose();
      recorderRef.current = null;
    }
    setIsRecording(false);
    setIsProcessing(false);
    levelRef.current = 0;
  }, []);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (recorderRef.current) {
        recorderRef.current.dispose();
        recorderRef.current = null;
      }
    };
  }, []);

  return {
    isRecording,
    isProcessing,
    audioLevel,
    startRecording,
    stopRecording,
    toggleRecording,
    audioLevelRef: levelRef
  };
};