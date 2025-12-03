/**
 * 🎵 REALTIME AUDIO LEVEL HOOK
 * 
 * Custom hook that provides real-time audio level detection without React state updates per frame.
 * Uses MediaStream → AudioContext → AnalyserNode for fluid, mobile-friendly audio visualization.
 * 
 * Key benefits:
 * - No React state updates per frame (mobile-friendly)
 * - Direct DOM manipulation for smooth animations
 * - Works independently of microphone service state
 * - Real-time audio level detection
 */

import { useEffect, useRef, useCallback } from 'react';
import { safeConsoleError } from '@/utils/safe-logging';
interface UseRealtimeAudioLevelOptions {
  stream: MediaStream | null;
  enabled: boolean;
  onAudioLevel?: (level: number) => void;
  targetFPS?: number;
  smoothingFactor?: number;
}

export const useRealtimeAudioLevel = ({
  stream,
  enabled,
  onAudioLevel,
  targetFPS = 30,
  smoothingFactor = 0.8
}: UseRealtimeAudioLevelOptions) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const smoothedLevelRef = useRef<number>(0);

  // 🎵 Initialize AudioContext and AnalyserNode
  const initializeAudioContext = useCallback(async () => {
    if (!stream || audioContextRef.current) return;

    try {
      // Create AudioContext with mobile-optimized settings
      audioContextRef.current = new AudioContext({ 
        sampleRate: 16000, // Mobile-first: 16kHz for faster processing
        latencyHint: 'interactive'
      });

      // Create AnalyserNode with mobile-optimized settings
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 1024; // Mobile-first: Smaller FFT for faster analysis
      analyserRef.current.smoothingTimeConstant = smoothingFactor;

      // Create MediaStreamSource and connect to analyser
      mediaStreamSourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      mediaStreamSourceRef.current.connect(analyserRef.current);

      // Resume AudioContext if suspended (helps on iOS)
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
    } catch (error) {
      safeConsoleError('[useRealtimeAudioLevel] ❌ Failed to initialize AudioContext:', error);
    }
  }, [stream, smoothingFactor]);

  // 🎵 Cleanup AudioContext
  const cleanupAudioContext = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (mediaStreamSourceRef.current) {
      mediaStreamSourceRef.current.disconnect();
      mediaStreamSourceRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    smoothedLevelRef.current = 0;
    lastUpdateTimeRef.current = 0;
  }, []);

  // 🎵 Real-time audio level detection loop
  const updateAudioLevel = useCallback(() => {
    if (!enabled || !analyserRef.current) {
      animationFrameRef.current = null;
      return;
    }

    const now = performance.now();
    const frameInterval = 1000 / targetFPS;

    // Throttle to target FPS
    if (now - lastUpdateTimeRef.current < frameInterval) {
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      return;
    }

    lastUpdateTimeRef.current = now;

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

      // Call callback with smoothed level (0-1 range)
      if (onAudioLevel) {
        onAudioLevel(smoothedLevelRef.current);
      }

    } catch (error) {
      safeConsoleError('[useRealtimeAudioLevel] ❌ Error reading audio data:', error);
    }

    // Continue the loop
    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  }, [enabled, targetFPS, smoothingFactor, onAudioLevel]);

  // 🎵 Effect: Initialize when stream is available
  useEffect(() => {
    if (stream && enabled) {
      initializeAudioContext();
    } else {
      cleanupAudioContext();
    }

    return cleanupAudioContext;
  }, [stream, enabled, initializeAudioContext, cleanupAudioContext]);

  // 🎵 Effect: Start/stop audio level detection
  useEffect(() => {
    if (enabled && analyserRef.current && !animationFrameRef.current) {
      updateAudioLevel();
    } else if (!enabled && animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [enabled, updateAudioLevel]);

  // 🎵 Return current audio level (for debugging or one-time reads)
  const getCurrentAudioLevel = useCallback(() => {
    return smoothedLevelRef.current;
  }, []);

  return {
    getCurrentAudioLevel,
    isActive: enabled && !!analyserRef.current
  };
};
