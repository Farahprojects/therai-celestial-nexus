/**
 * 🎵 CONVERSATION REALTIME AUDIO LEVEL HOOK
 * 
 * Auto-attaches when microphone starts recording, auto-detaches when stops.
 * Uses the same Web Audio API + AnalyserNode approach as the main mic button flow.
 * Updates React state at a reasonable rate (not per frame) for smooth animation.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseConversationRealtimeAudioLevelOptions {
  updateIntervalMs?: number; // How often to update React state (default: 50ms = 20fps)
  smoothingFactor?: number;
}

export const useConversationRealtimeAudioLevel = ({
  updateIntervalMs = 50, // 20fps for React state updates
  smoothingFactor = 0.8
}: UseConversationRealtimeAudioLevelOptions = {}) => {
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const smoothedLevelRef = useRef<number>(0);
  const intervalRef = useRef<number | null>(null);

  // 🎵 Initialize (reuse existing AnalyserNode from microphone service)
  const initializeAudioContext = useCallback(async () => {
    if (analyserRef.current) {
      // Already initialized
      return;
    }

    try {
      // Service not available, return early
      return;
      
      // No need to create our own AudioContext or MediaStreamSource
      // We're just reading from the existing analysis chain
      
    } catch (error) {
      console.error('[useConversationRealtimeAudioLevel] ❌ Failed to initialize:', error);
    }
  }, []);

  // 🎵 Cleanup (no AudioContext to clean up since we reuse the service's)
  const cleanupAudioContext = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // No need to disconnect or close anything since we're reusing the service's AnalyserNode
    // Just clear our reference
    analyserRef.current = null;
    smoothedLevelRef.current = 0;
    lastUpdateTimeRef.current = 0;
  }, []);

  // 🎵 Real-time audio level detection loop
  const updateAudioLevel = useCallback(() => {
    if (!isEnabled || !analyserRef.current) {
      animationFrameRef.current = null;
      return;
    }

    try {
      // Get audio data
      const bufferLength = analyserRef.current.fftSize;
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteTimeDomainData(dataArray);

      // Calculate RMS (Root Mean Square) for audio level
      let sumSquares = 0;
      for (let i = 0; i < bufferLength; i++) {
        const centered = (dataArray[i] - 128) / 128; // Center around 0
        sumSquares += centered * centered;
      }
      const rms = Math.sqrt(sumSquares / bufferLength);

      // Apply smoothing to prevent jittery animations
      smoothedLevelRef.current = smoothedLevelRef.current * smoothingFactor + rms * (1 - smoothingFactor);

    } catch (error) {
      console.error('[useConversationRealtimeAudioLevel] ❌ Error reading audio data:', error);
    }

    // Continue the loop
    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  }, [isEnabled, smoothingFactor]);

  // 🎵 Update React state at reasonable interval
  const updateReactState = useCallback(() => {
    setAudioLevel(smoothedLevelRef.current);
  }, []);

  // 🎵 Effect: Auto-attach/detach based on microphone service state
  useEffect(() => {
    // Service not available, keep disabled
    setIsEnabled(false);
  }, []);

  // 🎵 Effect: Initialize when enabled
  useEffect(() => {
    if (isEnabled) {
      initializeAudioContext();
    } else {
      cleanupAudioContext();
      setAudioLevel(0);
    }

    return cleanupAudioContext;
  }, [isEnabled, initializeAudioContext, cleanupAudioContext]);

  // 🎵 Effect: Start/stop audio level detection
  useEffect(() => {
    if (isEnabled && analyserRef.current && !animationFrameRef.current) {
      updateAudioLevel();
    } else if (!isEnabled && animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isEnabled, updateAudioLevel]);

  // 🎵 Effect: Start/stop React state updates
  useEffect(() => {
    if (isEnabled && !intervalRef.current) {
      intervalRef.current = window.setInterval(updateReactState, updateIntervalMs);
    } else if (!isEnabled && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isEnabled, updateIntervalMs, updateReactState]);

  return audioLevel;
};
