// Simple universal microphone hook - no chunks, no rolling buffer

import { useState, useCallback, useRef, useEffect } from 'react';
import { UniversalSTTRecorder } from '@/services/audio/UniversalSTTRecorder';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useUserData } from '@/hooks/useUserData';
import { useMode } from '@/contexts/ModeContext';

interface UseUniversalMicOptions {
  onTranscriptReady?: (transcript: string) => void;
  onError?: (error: Error) => void;
  silenceThreshold?: number;
  silenceDuration?: number;
}

export const useUniversalMic = (options: UseUniversalMicOptions = {}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { user } = useAuth();
  const { displayName } = useUserData();
  const { mode } = useMode();
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

      // Check secure context
      if (!window.isSecureContext && location.hostname !== 'localhost') {
        throw new Error('Microphone requires HTTPS or localhost');
      }

      // Check getUserMedia support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia not supported');
      }

      // Check current permission state
      let permissionState = 'unknown';
      try {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        permissionState = result.state;
      } catch (permError) {
      }

      recorderRef.current = new UniversalSTTRecorder({
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
          console.error('[useUniversalMic] Recorder error:', error);
          
          // Dispose recorder and reset state
          if (recorderRef.current) {
            recorderRef.current.dispose();
            recorderRef.current = null;
          }
          setIsRecording(false);
          setIsProcessing(false);
          levelRef.current = 0;
          
          // Pass error to parent - parent decides whether to show toast or notification pill
          if (options.onError) {
            options.onError(error);
            return;
          }
          
          // Fallback: Show toast for microphone errors (when not handled by parent)
          let errorMessage = error.message;
          if (error.message.includes('Permission denied') || error.message.includes('NotAllowedError')) {
            errorMessage = 'Microphone permission denied. Please allow microphone access in your browser settings.';
          } else if (error.message.includes('NotFoundError')) {
            errorMessage = 'No microphone found. Please connect a microphone and try again.';
          } else if (error.message.includes('NotReadableError')) {
            errorMessage = 'Microphone is being used by another application.';
          } else if (!error.message.includes('Voice limit reached') && !error.message.includes('voice transcription')) {
            errorMessage = 'Could not access microphone.';
          }
          
          toast.error(errorMessage);
        },
        onLevel: (level) => {
          levelRef.current = level;
        },
        onProcessingStart: () => {
          // Silence detected - stop recording UI, show spinner for STT processing
          setIsRecording(false);
          setIsProcessing(true);
        },
        baselineCaptureDuration: 1000, // 1 second baseline capture
        silenceMargin: 0.15, // 15% below baseline
        silenceHangover: 600, // 600ms silence detection (slight hang)
        user_id: user?.id, // Add user_id for message attribution
        user_name: displayName || 'User', // Add user_name for message attribution
        mode: mode, // Add mode for message context
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
      
      toast({
        title: 'Microphone Access Failed',
        description: errorMessage,
        variant: 'destructive',
      });
      setIsProcessing(false);
      return false;
    }
  }, [isRecording, isProcessing, options, toast, user?.id, displayName, mode]);

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