// Production-Ready Universal STT Recorder
// Optimized for scale with robust VAD and cleanup

import { STTLimitExceededError } from '@/services/voice/stt';
import { Capacitor } from '@capacitor/core';
import BluetoothAudio from '@/plugins/BluetoothAudio';

export interface STTRecorderOptions {
  onTranscriptReady?: (transcript: string) => void;
  onError?: (error: Error) => void;
  onLevel?: (level: number) => void;
  baselineCaptureDuration?: number;
  silenceMargin?: number;
  silenceHangover?: number;
  chattype?: string;
  mode?: string;
  onProcessingStart?: () => void;
  triggerPercent?: number;
  preRollMs?: number;
  user_id?: string;
  user_name?: string;
}

export class UniversalSTTRecorder {
  // Recording components
  private mediaStream: MediaStream | null = null;
  
  // Audio processing chain
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animationFrame: number | null = null;
  private dataArray: Float32Array | null = null;
  private freqData: Uint8Array | null = null;
  private spectralFlatness: number = 1;
  private highPassFilter: BiquadFilterNode | null = null;
  private lowPassFilter: BiquadFilterNode | null = null;
  private bandpassFilter: BiquadFilterNode | null = null;
  private adaptiveGain: GainNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private silentGain: GainNode | null = null;
  
  // VAD state management
  private silenceTimer: NodeJS.Timeout | null = null;
  private isRecording = false;
  private options: STTRecorderOptions;
  private baselineEnergy: number = 0;
  private baselineStartTime: number = 0;
  private baselineCapturing = false;
  private baselineEnergySum = 0;
  private baselineEnergyCount = 0;
  private vadArmUntilTs: number = 0;
  private earlyVoiceDetected: boolean = false;
  private currentGain: number = 1;
  private desktopTargetRMS: number = 0.12;
  
  // Persistent baseline adaptation
  private ambientEma: number = 0;
  private ambientStableSince: number = 0;
  private baselineLastUpdated: number = 0;
  private readonly desktopBaselineTrigger = 0.18;
  private readonly mobileBaselineTrigger = 0.22;
  private readonly desktopAmbientStableMs = 600;
  private readonly mobileAmbientStableMs = 700;
  private readonly desktopBaselineFloor = 0.002;
  private readonly desktopBaselineCeiling = 0.08;
  private readonly mobileBaselineFloor = 0.003;
  private readonly mobileBaselineCeiling = 0.10;

  // VAD state
  private vadActive: boolean = false;
  private isInputPaused: boolean = false;

  // PCM capture buffers
  private preRollSampleChunks: Float32Array[] = [];
  private preRollTotalSamples: number = 0;
  private preRollMaxSamples: number = 0;
  private activeSampleChunks: Float32Array[] = [];
  private activeTotalSamples: number = 0;

  // 🔥 NEW: Segment finalization guard to prevent leftover triggers
  private isFinalizingSegment: boolean = false;
  private lastSegmentFinalizedAt: number = 0;
  private readonly minSegmentGapMs = 400; // minimum time between segments

  // 🔥 NEW: Enhanced zero-detection for production reliability
  private consecutiveZeroFrames: number = 0;
  private readonly maxConsecutiveZeroFrames = 15; // ~250ms at 60fps

  // 🔥 NEW: Memory management for long sessions
  private readonly maxPreRollChunks = 50; // prevent unbounded growth
  private readonly maxActiveChunks = 300; // ~12s at 4096 samples/48kHz
  
  // 🔥 NEW: Disposed state to prevent use-after-dispose
  private isDisposed: boolean = false;

  constructor(options: STTRecorderOptions = {}) {
    this.options = {
      baselineCaptureDuration: 600,
      silenceMargin: 0.15,
      silenceHangover: 300,
      triggerPercent: 0.2,
      preRollMs: 800,
      ...options
    };

    // Apply mobile-specific defaults
    if (this.isMobileDevice()) {
      if (options.silenceMargin === undefined) {
        this.options.silenceMargin = 0.10;
      }
      if (options.silenceHangover === undefined) {
        this.options.silenceHangover = 500;
      }
      if (options.baselineCaptureDuration === undefined) {
        this.options.baselineCaptureDuration = 700;
      }
    }
  }

  async start(): Promise<void> {
    if (this.isDisposed) {
      throw new Error('Cannot start disposed recorder');
    }
    if (this.isRecording) return;

    try {
      // Step 0: Configure Bluetooth on native platforms
      if (Capacitor.isNativePlatform()) {
        try {
          console.log('[STTRecorder] 🔵 Starting Bluetooth SCO...');
          // Check minimum segment length
    const inputSampleRate = this.audioContext?.sampleRate || 48000;
    const minSamples = Math.floor(inputSampleRate * 0.1); // 100ms
    
    if (totalSamples < minSamples) {
      console.log('[VAD] Ignoring short segment (<100ms)');
      this.isFinalizingSegment = false;
      this.lastSegmentFinalizedAt = Date.now();
      return;
    }
    
    // Merge PCM chunks
    const merged = new Float32Array(totalSamples);
    let offset = 0;
    for (const ch of sampleChunks) {
      merged.set(ch, offset);
      offset += ch.length;
    }
    
    // Resample and encode
    const resampled16k = this.resampleTo16k(merged, inputSampleRate);
    const blob = this.encodeWavPCM16Mono(resampled16k, 16000);
    
    console.log(`[VAD] 📦 Segment finalized: ${(totalSamples / inputSampleRate).toFixed(2)}s`);
    
    // Signal processing start
    try {
      this.options.onProcessingStart?.();
    } catch (e) {
      console.error('[STTRecorder] onProcessingStart error:', e);
    }
    
    // Mark finalization complete and record timestamp
    this.isFinalizingSegment = false;
    this.lastSegmentFinalizedAt = Date.now();
    
    // Send to STT without blocking UI
    try {
      if (typeof queueMicrotask === 'function') {
        queueMicrotask(() => {
          this.sendToSTT(blob).catch(e => {
            console.error('[STTRecorder] STT failed:', e);
          });
        });
      } else {
        setTimeout(() => {
          this.sendToSTT(blob).catch(e => {
            console.error('[STTRecorder] STT failed:', e);
          });
        }, 0);
      }
    } catch (e) {
      setTimeout(() => {
        this.sendToSTT(blob).catch(e => {
          console.error('[STTRecorder] STT failed:', e);
        });
      }, 0);
    }
  }

  private async sendToSTT(audioBlob: Blob): Promise<void> {
    try {
      // Dynamic import to avoid circular dependencies
      const sttModule = await import('@/services/voice/stt');
      const storeModule = await import('@/core/store');
      const { sttService } = sttModule;
      const { chat_id } = storeModule.useChatStore.getState();

      if (!chat_id) {
        throw new Error('No chat_id available for STT');
      }
      
      // Voice mode: fire-and-forget
      if (this.options.chattype === 'voice') {
        // Trigger thinking state immediately
        if (this.options.onTranscriptReady) {
          this.options.onTranscriptReady('');
        }
        
        // Fire-and-forget STT call
        sttService.transcribe(
          audioBlob, 
          chat_id, 
          {}, 
          this.options.chattype, 
          this.options.mode, 
          this.options.user_id, 
          this.options.user_name
        ).catch((error) => {
          if (!(error instanceof STTLimitExceededError)) {
            console.error('[STTRecorder] STT failed:', error);
          }
          this.options.onError?.(error as Error);
        });
        return;
      }
      
      // Text mode: await transcript
      const { transcript } = await sttService.transcribe(
        audioBlob,
        chat_id,
        {},
        this.options.chattype,
        this.options.mode,
        this.options.user_id,
        this.options.user_name
      );
      
      if (transcript && transcript.trim().length > 0 && this.options.onTranscriptReady) {
        this.options.onTranscriptReady(transcript.trim());
      }
    } catch (error) {
      if (!(error instanceof STTLimitExceededError)) {
        console.error('[STTRecorder] STT failed:', error);
      }
      this.options.onError?.(error as Error);
    }
  }

  private async attemptMicRecovery(): Promise<void> {
    try {
      console.log('[STTRecorder] 🔄 Starting mic recovery...');
      
      // Stop current tracks
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(t => t.stop());
        this.mediaStream = null;
      }
      
      // Close current context
      if (this.audioContext) {
        await this.audioContext.close().catch(() => {});
        this.audioContext = null;
      }
      
      // Request new stream with default device
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: false,
          channelCount: 1
        }
      });
      
      console.log('[STTRecorder] ✅ Mic recovery successful');
      this.mediaStream = stream;
      this.setupEnergyMonitoring();
    } catch (error) {
      console.error('[STTRecorder] ❌ Mic recovery failed:', error);
      throw error;
    }
  }

  private resampleTo16k(input: Float32Array, inputSampleRate: number): Int16Array {
    const targetRate = 16000;
    
    if (inputSampleRate === targetRate) {
      // Direct conversion
      const out = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        out[i] = (s < 0 ? s * 0x8000 : s * 0x7FFF) | 0;
      }
      return out;
    }
    
    // Linear interpolation resampling
    const ratio = inputSampleRate / targetRate;
    const newLength = Math.floor(input.length / ratio);
    const out = new Int16Array(newLength);
    
    for (let i = 0; i < newLength; i++) {
      const idx = i * ratio;
      const i0 = Math.floor(idx);
      const i1 = Math.min(i0 + 1, input.length - 1);
      const frac = idx - i0;
      const s = input[i0] + (input[i1] - input[i0]) * frac;
      const clamped = Math.max(-1, Math.min(1, s));
      out[i] = (clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF) | 0;
    }
    
    return out;
  }

  private encodeWavPCM16Mono(pcm: Int16Array, sampleRate: number): Blob {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const dataSize = pcm.length * 2;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    let offset = 0;
    const writeString = (s: string) => {
      for (let i = 0; i < s.length; i++) {
        view.setUint8(offset + i, s.charCodeAt(i));
      }
      offset += s.length;
    };
    const writeUint32 = (v: number) => {
      view.setUint32(offset, v, true);
      offset += 4;
    };
    const writeUint16 = (v: number) => {
      view.setUint16(offset, v, true);
      offset += 2;
    };

    // RIFF header
    writeString('RIFF');
    writeUint32(36 + dataSize);
    writeString('WAVE');
    
    // fmt chunk
    writeString('fmt ');
    writeUint32(16);
    writeUint16(1); // PCM
    writeUint16(numChannels);
    writeUint32(sampleRate);
    writeUint32(byteRate);
    writeUint16(blockAlign);
    writeUint16(bitsPerSample);
    
    // data chunk
    writeString('data');
    writeUint32(dataSize);
    
    // PCM data
    let p = 44;
    for (let i = 0; i < pcm.length; i++, p += 2) {
      view.setInt16(p, pcm[i], true);
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  private cleanup(): void {
    console.log('[STTRecorder] 🧹 Cleaning up...');
    
    // Clear all timers
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    // Cancel animation frame
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    // Disconnect audio nodes
    const nodesToDisconnect = [
      this.scriptProcessor,
      this.silentGain,
      this.adaptiveGain,
      this.analyser,
      this.lowPassFilter,
      this.highPassFilter
    ];
    
    for (const node of nodesToDisconnect) {
      if (node) {
        try {
          node.disconnect();
        } catch (e) {
          // Ignore disconnect errors
        }
      }
    }
    
    // Clear scriptProcessor callback
    if (this.scriptProcessor) {
      this.scriptProcessor.onaudioprocess = null;
      this.scriptProcessor = null;
    }
    
    this.silentGain = null;
    this.adaptiveGain = null;
    this.analyser = null;
    this.highPassFilter = null;
    this.lowPassFilter = null;
    this.bandpassFilter = null;

    // Stop and release microphone
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => {
        track.stop();
      });
      this.mediaStream = null;
    }

    // Close AudioContext
    if (this.audioContext) {
      this.audioContext.close().catch(() => {
        // Ignore close errors
      });
      this.audioContext = null;
    }

    // Clear all buffers
    this.dataArray = null;
    this.freqData = null;
    this.preRollSampleChunks = [];
    this.preRollTotalSamples = 0;
    this.activeSampleChunks = [];
    this.activeTotalSamples = 0;
    this.vadActive = false;
    this.isFinalizingSegment = false;
    
    // Reset baseline state
    this.baselineEnergy = 0;
    this.baselineCapturing = false;
    this.baselineEnergySum = 0;
    this.baselineEnergyCount = 0;
    this.earlyVoiceDetected = false;
    this.consecutiveZeroFrames = 0;
    this.lastSegmentFinalizedAt = 0;
    
    console.log('[STTRecorder] ✅ Cleanup complete');
  }

  dispose(): void {
    if (this.isDisposed) {
      console.warn('[STTRecorder] Already disposed');
      return;
    }
    
    console.log('[STTRecorder] 🗑️ Disposing recorder...');
    this.stop();
    this.cleanup();
    this.isDisposed = true;
    console.log('[STTRecorder] ✅ Recorder disposed');
  }

  private isMobileDevice(): boolean {
    if (typeof navigator === 'undefined' || typeof navigator.userAgent !== 'string') {
      return false;
    }
    const ua = navigator.userAgent;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  }

  // 🔥 NEW: Public getter for monitoring health
  public getHealth(): {
    isRecording: boolean;
    isDisposed: boolean;
    vadActive: boolean;
    baselineEnergy: number;
    consecutiveZeroFrames: number;
    hasStream: boolean;
    hasContext: boolean;
  } {
    return {
      isRecording: this.isRecording,
      isDisposed: this.isDisposed,
      vadActive: this.vadActive,
      baselineEnergy: this.baselineEnergy,
      consecutiveZeroFrames: this.consecutiveZeroFrames,
      hasStream: this.mediaStream !== null,
      hasContext: this.audioContext !== null
    };
  }
} result = await BluetoothAudio.startBluetoothAudio();
          console.log('[STTRecorder] ✅ Bluetooth routing enabled:', result);
          
          // Wait for SCO stabilization
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Verify connection
          try {
            const status = await BluetoothAudio.isBluetoothConnected();
            console.log('[STTRecorder] Bluetooth status:', status);
          } catch (e) {
            console.warn('[STTRecorder] Could not check Bluetooth status:', e);
          }
        } catch (error) {
          console.warn('[STTRecorder] Bluetooth unavailable:', error);
        }
      }
      
      // Step 1: Request microphone
      console.log('[STTRecorder] 🎤 Requesting microphone...');
      this.mediaStream = await this.requestMicrophoneAccess();
      console.log('[STTRecorder] ✅ Microphone granted');
      
      // Step 2: Setup audio processing
      this.setupEnergyMonitoring();
      
      // Step 3: Mark as recording
      this.isRecording = true;
      this.lastSegmentFinalizedAt = 0; // Reset gap timer

    } catch (error) {
      this.cleanup();
      this.options.onError?.(error as Error);
      throw error;
    }
  }

  private async requestMicrophoneAccess(): Promise<MediaStream> {
    // Security checks
    if (!window.isSecureContext && location.hostname !== 'localhost') {
      throw new Error('Microphone requires HTTPS or localhost');
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('getUserMedia not supported');
    }

    // Attempt to prefer Bluetooth device
    let preferredDeviceId: string | undefined;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter(d => d.kind === 'audioinput');
      const bluetoothLike = inputs.find(d =>
        /bluetooth|headset|buds|sco|le/i.test(d.label)
      );
      
      if (bluetoothLike?.deviceId) {
        preferredDeviceId = bluetoothLike.deviceId;
        console.log('[STTRecorder] 🎯 Preferring Bluetooth device:', bluetoothLike.label);
      }
    } catch (e) {
      console.warn('[STTRecorder] Device enumeration failed:', e);
    }

    // Request with optimal constraints
    const audioConstraints: MediaTrackConstraints = {
      noiseSuppression: true,
      echoCancellation: true,
      autoGainControl: false,
      channelCount: 1,
      sampleRate: 48000
    };
    
    if (preferredDeviceId) {
      (audioConstraints as any).deviceId = { exact: preferredDeviceId };
    }

    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: audioConstraints 
    });
    
    console.log('[STTRecorder] 🎤 Stream acquired');
    return stream;
  }

  stop(): void {
    if (!this.isRecording) return;
    this.isRecording = false;
    
    // 🔥 CRITICAL: Finalize any active segment before stopping
    if (this.vadActive && !this.isFinalizingSegment) {
      this.finalizeActiveSegment();
    }
  }

  startNewRecording(): void {
    if (this.isDisposed) {
      throw new Error('Cannot start new recording on disposed recorder');
    }
    if (this.isRecording) return;
    
    try {
      this.resumeInput();
      this.resetBaselineCapture();
      this.vadActive = false;
      
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
      
      // 🔥 NEW: Reset finalization guard
      this.isFinalizingSegment = false;
      this.lastSegmentFinalizedAt = 0;
      
      this.isRecording = true;
    } catch (e) {
      console.error('[STTRecorder] Failed to start new recording:', e);
      this.options.onError?.(e as Error);
    }
  }

  pauseInput(): void {
    if (!this.mediaStream) return;
    this.isInputPaused = true;
    this.mediaStream.getAudioTracks().forEach(track => {
      track.enabled = false;
    });
  }

  resumeInput(): void {
    if (!this.mediaStream) return;
    this.isInputPaused = false;
    this.mediaStream.getAudioTracks().forEach(track => {
      track.enabled = true;
    });
  }

  private setupEnergyMonitoring(): void {
    if (!this.mediaStream) {
      console.error('[STTRecorder] No mediaStream for monitoring');
      return;
    }

    console.log('[STTRecorder] 🎧 Setting up audio monitoring...');

    // Create AudioContext
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    console.log('[STTRecorder] AudioContext created, SR:', this.audioContext.sampleRate);
    
    const sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

    // High-pass filter (remove low-frequency noise)
    this.highPassFilter = this.audioContext.createBiquadFilter();
    this.highPassFilter.type = 'highpass';
    this.highPassFilter.frequency.value = 80;
    this.highPassFilter.Q.value = 0.8;

    // Low-pass filter (speech band)
    this.lowPassFilter = this.audioContext.createBiquadFilter();
    this.lowPassFilter.type = 'lowpass';
    this.lowPassFilter.frequency.value = 4000;
    this.lowPassFilter.Q.value = 0.7;
    
    this.highPassFilter.connect(this.lowPassFilter);

    // Adaptive gain (desktop only)
    this.adaptiveGain = this.audioContext.createGain();
    this.adaptiveGain.gain.value = 1;
    this.lowPassFilter.connect(this.adaptiveGain);

    // Analyser for VAD
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0;

    sourceNode.connect(this.highPassFilter);
    this.adaptiveGain.connect(this.analyser);

    // ScriptProcessor for PCM capture
    try {
      this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.silentGain = this.audioContext.createGain();
      this.silentGain.gain.value = 0;
      
      this.adaptiveGain.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.silentGain);
      this.silentGain.connect(this.audioContext.destination);

      this.preRollMaxSamples = Math.max(1, 
        Math.floor((this.options.preRollMs || 800) * (this.audioContext.sampleRate / 1000))
      );
      
      this.preRollSampleChunks = [];
      this.preRollTotalSamples = 0;
      this.activeSampleChunks = [];
      this.activeTotalSamples = 0;

      this.scriptProcessor.onaudioprocess = (ev: any) => {
        if (!ev?.inputBuffer || this.isDisposed) return;
        
        const input: Float32Array = ev.inputBuffer.getChannelData(0);
        const copy = new Float32Array(input.length);
        copy.set(input);
        
        if (this.vadActive) {
          // 🔥 NEW: Enforce max active chunks to prevent memory issues
          if (this.activeSampleChunks.length < this.maxActiveChunks) {
            this.activeSampleChunks.push(copy);
            this.activeTotalSamples += copy.length;
          } else {
            console.warn('[STTRecorder] Active buffer full, dropping samples');
          }
        } else {
          // 🔥 NEW: Enforce max pre-roll chunks
          if (this.preRollSampleChunks.length < this.maxPreRollChunks) {
            this.preRollSampleChunks.push(copy);
            this.preRollTotalSamples += copy.length;
          }
          
          // Trim pre-roll to max samples
          while (this.preRollTotalSamples > this.preRollMaxSamples && 
                 this.preRollSampleChunks.length > 0) {
            const removed = this.preRollSampleChunks.shift()!;
            this.preRollTotalSamples -= removed.length;
          }
        }
      };
    } catch (e) {
      console.warn('[STTRecorder] PCM capture unavailable:', e);
    }

    this.dataArray = new Float32Array(this.analyser.fftSize);
    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    
    // Initialize baseline
    if (this.baselineEnergy > 0) {
      this.baselineCapturing = false;
      this.vadArmUntilTs = Date.now() + 150;
    } else {
      this.resetBaselineCapture();
    }
    
    this.startEnergyMonitoring();
  }

  private resetBaselineCapture(): void {
    this.baselineEnergy = 0;
    this.baselineStartTime = Date.now();
    this.baselineCapturing = true;
    this.baselineEnergySum = 0;
    this.baselineEnergyCount = 0;
    this.earlyVoiceDetected = false;
    this.consecutiveZeroFrames = 0; // Reset zero detection
  }

  private startEnergyMonitoring(): void {
    if (!this.analyser || !this.dataArray) return;

    let lastLevel = 0;
    let lastSpeechLikeTs = Date.now();
    let lowRmsSinceTs: number | null = null;
    let zeroCheckCount = 0;
    let hasLoggedZeroWarning = false;
    let attemptedDeadInputRecovery = false;
    
    const updateAnimation = () => {
      // 🔥 CRITICAL: Check if disposed
      if (this.isDisposed || !this.analyser || !this.dataArray) {
        return;
      }

      // Skip processing if input is paused
      const tracks = this.mediaStream?.getAudioTracks() || [];
      const allTracksDisabled = tracks.length > 0 && tracks.every(t => !t.enabled);
      
      if (this.isInputPaused || allTracksDisabled) {
        zeroCheckCount = 0;
        hasLoggedZeroWarning = false;
        attemptedDeadInputRecovery = false;
        this.consecutiveZeroFrames = 0;
        this.options.onLevel?.(0);
        this.animationFrame = requestAnimationFrame(updateAnimation);
        return;
      }

      // Get audio data
      const tempArray = new Float32Array(this.analyser.fftSize);
      this.analyser.getFloatTimeDomainData(tempArray);
      this.dataArray = tempArray;
      
      // 🔥 ENHANCED: Zero-input detection with consecutive frame counting
      const allZeros = this.dataArray.every(sample => sample === 0);
      if (allZeros) {
        this.consecutiveZeroFrames++;
        zeroCheckCount++;
        
        if (this.consecutiveZeroFrames > this.maxConsecutiveZeroFrames && !hasLoggedZeroWarning) {
          console.error('[STTRecorder] ⚠️ Sustained zero audio input detected');
          hasLoggedZeroWarning = true;
        }
        
        // Attempt recovery on web platforms
        if (zeroCheckCount > 60 && !attemptedDeadInputRecovery && 
            !(window as any).Capacitor?.isNativePlatform?.()) {
          attemptedDeadInputRecovery = true;
          console.warn('[STTRecorder] ♻️ Attempting mic recovery');
          this.attemptMicRecovery().catch(e => {
            console.error('[STTRecorder] Recovery failed:', e);
          });
        }
      } else {
        if (this.consecutiveZeroFrames > this.maxConsecutiveZeroFrames && hasLoggedZeroWarning) {
          console.log('[STTRecorder] ✅ Audio input recovered');
        }
        this.consecutiveZeroFrames = 0;
        zeroCheckCount = 0;
        hasLoggedZeroWarning = false;
      }

      // Get frequency data for spectral analysis
      if (this.freqData) {
        const freqView = new Uint8Array(this.freqData.buffer as ArrayBuffer, 
                                       this.freqData.byteOffset, 
                                       this.freqData.byteLength);
        this.analyser.getByteFrequencyData(freqView);
        this.spectralFlatness = this.computeSpectralFlatness(freqView);
      }
      
      // Calculate RMS energy
      let sum = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        sum += this.dataArray[i] * this.dataArray[i];
      }
      const rms = Math.sqrt(sum / this.dataArray.length);
      
      // Calculate peak for headroom
      let peak = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        const v = Math.abs(this.dataArray[i]);
        if (v > peak) peak = v;
      }
      
      // Baseline capture
      const now = Date.now();
      if (this.baselineCapturing) {
        this.baselineEnergySum += rms;
        this.baselineEnergyCount++;
        
        const elapsedMs = now - this.baselineStartTime;
        const conservativeBaseline = this.isMobileDevice() ? 0.008 : 0.006;
        const earlyVoiceThreshold = conservativeBaseline * 3.5;
        
        // Early voice detection (skip baseline if user speaks immediately)
        if (elapsedMs >= 200 && elapsedMs < 500 && 
            rms > earlyVoiceThreshold && !this.earlyVoiceDetected) {
          console.log(`[VAD] Early voice detected (${rms.toFixed(4)}), skipping baseline`);
          this.earlyVoiceDetected = true;
          this.baselineEnergy = conservativeBaseline;
          this.baselineCapturing = false;
          this.vadArmUntilTs = 0;
          this.beginActiveSegment();
          
          // Initialize adaptive gain (desktop)
          if (!this.isMobileDevice() && this.adaptiveGain) {
            const target = this.desktopTargetRMS;
            const rawGain = target / Math.max(1e-6, this.baselineEnergy);
            this.currentGain = Math.max(0.5, Math.min(6, rawGain));
            this.adaptiveGain.gain.value = this.currentGain;
          }
        } else if (now - this.baselineStartTime >= this.options.baselineCaptureDuration!) {
          // Normal baseline completion
          this.baselineEnergy = this.baselineEnergySum / this.baselineEnergyCount;
          this.baselineCapturing = false;
          console.log(`[VAD] 🎯 Baseline: ${this.baselineEnergy.toFixed(5)}`);
          this.vadArmUntilTs = now + 150;
          
          // Initialize adaptive gain (desktop)
          if (!this.isMobileDevice() && this.adaptiveGain) {
            const target = this.desktopTargetRMS;
            const rawGain = target / Math.max(1e-6, this.baselineEnergy);
            this.currentGain = Math.max(0.5, Math.min(6, rawGain));
            this.adaptiveGain.gain.value = this.currentGain;
          }
        }
      }
      
      // Smooth level for UI
      const rawLevel = Math.min(1, rms * 15);
      const smoothedLevel = lastLevel * 0.7 + rawLevel * 0.3;
      lastLevel = smoothedLevel;
      this.options.onLevel?.(smoothedLevel);

      // Update adaptive gain (desktop only)
      if (!this.isMobileDevice() && this.adaptiveGain) {
        const target = this.desktopTargetRMS;
        const desired = target / Math.max(1e-6, rms);
        const headroom = peak > 0 ? 0.9 / peak : 6;
        const clamped = Math.max(0.5, Math.min(6, Math.min(desired, headroom)));
        this.currentGain = this.currentGain * 0.9 + clamped * 0.1;
        this.adaptiveGain.gain.value = this.currentGain;
      }

      // VAD logic (only when recording and baseline captured)
      if (this.isRecording && !this.baselineCapturing && this.baselineEnergy > 0) {
        const startThreshold = this.baselineEnergy * (1 + (this.options.triggerPercent || 0.2));
        const stopThreshold = this.baselineEnergy * (1 - this.options.silenceMargin!);
        
        if (!this.vadActive) {
          // Don't arm until guard window passes
          if (Date.now() < this.vadArmUntilTs) {
            this.animationFrame = requestAnimationFrame(updateAnimation);
            return;
          }
          
          // 🔥 NEW: Enforce minimum gap between segments to prevent leftover triggers
          if (this.lastSegmentFinalizedAt > 0 && 
              (Date.now() - this.lastSegmentFinalizedAt) < this.minSegmentGapMs) {
            this.animationFrame = requestAnimationFrame(updateAnimation);
            return;
          }
          
          // Start new segment if energy exceeds threshold
          if (rms > startThreshold) {
            console.log(`[VAD] 🎙️ Speech start (${rms.toFixed(5)} > ${startThreshold.toFixed(5)})`);
            this.beginActiveSegment();
          }
        } else {
          // Monitor for silence while active
          const isSpeaking = rms > stopThreshold;
          const noiseLike = this.spectralFlatness >= 0.4;

          // Track last speech-like time
          if (isSpeaking || !noiseLike) {
            lastSpeechLikeTs = now;
          }

          // Very-low RMS escape hatch
          const lowFloor = 0.005;
          if (rms < lowFloor) {
            if (lowRmsSinceTs === null) lowRmsSinceTs = now;
          } else {
            lowRmsSinceTs = null;
          }

          const lowFloorSatisfied = lowRmsSinceTs !== null && (now - lowRmsSinceTs >= 180);
          const spectralOrTimeSatisfied = noiseLike || (now - lastSpeechLikeTs >= 250);

          if (!isSpeaking && (lowFloorSatisfied || spectralOrTimeSatisfied)) {
            if (!this.silenceTimer) {
              console.log(`[VAD] 🔇 Silence detected, starting ${this.options.silenceHangover}ms timer`);
              this.silenceTimer = setTimeout(() => {
                console.log(`[VAD] ✅ Silence timer completed`);
                this.finalizeActiveSegment();
              }, this.options.silenceHangover);
            }
          } else {
            if (this.silenceTimer) {
              console.log(`[VAD] 🔊 Speech resumed, canceling timer`);
              clearTimeout(this.silenceTimer);
              this.silenceTimer = null;
            }
          }
        }

        // Baseline adaptation (during silence only)
        const isSilent = rms <= stopThreshold;
        const noiseLike = this.spectralFlatness >= 0.4;
        
        if (isSilent && noiseLike) {
          const ambientAlpha = 0.1;
          this.ambientEma = this.ambientEma === 0 ? rms : 
            (this.ambientEma * (1 - ambientAlpha) + rms * ambientAlpha);
          
          const trigger = this.isMobileDevice() ? this.mobileBaselineTrigger : this.desktopBaselineTrigger;
          const stableMs = this.isMobileDevice() ? this.mobileAmbientStableMs : this.desktopAmbientStableMs;
          const dev = Math.abs(this.ambientEma - this.baselineEnergy) / Math.max(1e-6, this.baselineEnergy);
          
          if (dev > trigger) {
            if (this.ambientStableSince === 0) this.ambientStableSince = Date.now();
            
            if (Date.now() - this.ambientStableSince >= stableMs) {
              const upward = this.ambientEma > this.baselineEnergy;
              const alpha = upward ? 0.38 : 0.14;
              let newBaseline = this.baselineEnergy * (1 - alpha) + this.ambientEma * alpha;
              
              const floor = this.isMobileDevice() ? this.mobileBaselineFloor : this.desktopBaselineFloor;
              const ceil = this.isMobileDevice() ? this.mobileBaselineCeiling : this.desktopBaselineCeiling;
              newBaseline = Math.min(Math.max(newBaseline, floor), ceil);
              
              this.baselineEnergy = newBaseline;
              this.baselineLastUpdated = Date.now();
              this.vadArmUntilTs = Date.now() + 200;
              this.ambientStableSince = 0;
            }
          } else {
            this.ambientStableSince = 0;
          }
        } else {
          this.ambientStableSince = 0;
        }
      }

      this.animationFrame = requestAnimationFrame(updateAnimation);
    };

    updateAnimation();
  }

  private computeSpectralFlatness(freq: ArrayLike<number>): number {
    if (!freq || freq.length === 0) return 1;
    
    const N = freq.length;
    let sum = 0;
    let sumLog = 0;
    const eps = 1e-3;
    
    for (let i = 0; i < N; i++) {
      const m = Math.max(eps, freq[i]);
      sum += m;
      sumLog += Math.log(m);
    }
    
    const am = sum / N;
    const gm = Math.exp(sumLog / N);
    const flatness = gm / Math.max(eps, am);
    
    return Math.max(0, Math.min(1, flatness));
  }

  private beginActiveSegment(): void {
    // 🔥 NEW: Don't start new segment if we're finalizing
    if (this.isFinalizingSegment) {
      console.log('[VAD] Ignoring segment start - already finalizing');
      return;
    }
    
    // Seed with pre-roll
    this.activeSampleChunks = this.preRollSampleChunks.slice();
    this.activeTotalSamples = this.preRollTotalSamples;
    this.vadActive = true;
    
    console.log('[VAD] 🎙️ Active segment started');
  }

  private finalizeActiveSegment(): void {
    // 🔥 CRITICAL: Guard against concurrent finalization
    if (!this.vadActive || this.isFinalizingSegment) {
      return;
    }
    
    this.isFinalizingSegment = true;
    this.vadActive = false;
    
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    
    // Collect PCM data
    const totalSamples = this.activeTotalSamples;
    const sampleChunks = this.activeSampleChunks;
    
    // 🔥 CRITICAL: Clear buffers IMMEDIATELY to prevent leftover triggers
    this.activeTotalSamples = 0;
    this.activeSampleChunks = [];
    
    // Validate segment
    if (!sampleChunks || sampleChunks.length === 0 || totalSamples <= 0) {
      console.log('[VAD] Ignoring empty segment');
      this.isFinalizingSegment = false;
      this.lastSegmentFinalizedAt = Date.now();
      return;
    }
    
    const
