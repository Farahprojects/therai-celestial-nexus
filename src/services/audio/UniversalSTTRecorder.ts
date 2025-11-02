// Simple Universal STT Recorder - no chunks, no rolling buffer, just record and stop

import { STTLimitExceededError } from '@/services/voice/stt';

export interface STTRecorderOptions {
  onTranscriptReady?: (transcript: string) => void;
  onError?: (error: Error) => void;
  onLevel?: (level: number) => void;
  baselineCaptureDuration?: number; // ms to capture baseline energy (default: 600)
  silenceMargin?: number; // percentage below baseline to trigger silence (default: 0.15)
  silenceHangover?: number; // ms before triggering silence (default: 300)
  chattype?: string; // e.g., 'voice' or 'text'
  mode?: string; // e.g., 'chat' or 'astro'
  onProcessingStart?: () => void; // fired when recording stops and processing begins
  triggerPercent?: number; // percentage above baseline to start capture (default: 0.2)
  preRollMs?: number; // how much audio before trigger to include (default: 800)
  user_id?: string; // user ID for message attribution
  user_name?: string; // user name for message attribution
}

export class UniversalSTTRecorder {
  // Recording components
  private mediaStream: MediaStream | null = null;
  
  // Energy monitoring components (separate from recording)
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animationFrame: number | null = null;
  private dataArray: Float32Array | null = null;
  private freqData: Uint8Array | null = null; // frequency-domain snapshot for spectral measures
  private spectralFlatness: number = 1; // 1=noise-like, 0=tonal
  private highPassFilter: BiquadFilterNode | null = null;
  private lowPassFilter: BiquadFilterNode | null = null;
  private bandpassFilter: BiquadFilterNode | null = null; // unused (kept for backward type compat if imported elsewhere)
  private adaptiveGain: GainNode | null = null; // desktop-only dynamic gain
  private scriptProcessor: ScriptProcessorNode | null = null;
  private silentGain: GainNode | null = null;
  
  // Simplified VAD state
  private silenceTimer: NodeJS.Timeout | null = null;
  private isRecording = false;
  private options: STTRecorderOptions;
  private baselineEnergy: number = 0;
  private baselineStartTime: number = 0;
  private baselineCapturing = false;
  private baselineEnergySum = 0;
  private baselineEnergyCount = 0;
  private vadArmUntilTs: number = 0; // time after which VAD can arm (post-baseline guard)
  private earlyVoiceDetected: boolean = false; // flag if voice detected during baseline
  private currentGain: number = 1; // smoothed adaptive gain (desktop)
  private desktopTargetRMS: number = 0.12; // desktop loudness target
  // Persistent baseline adaptation
  private ambientEma: number = 0;
  private ambientStableSince: number = 0;
  private baselineLastUpdated: number = 0;
  private readonly desktopBaselineTrigger = 0.18; // 18% - more sensitive to catch early speech
  private readonly mobileBaselineTrigger = 0.22; // 22% - more sensitive to catch early speech
  private readonly desktopAmbientStableMs = 600; // faster adaptation for desktop
  private readonly mobileAmbientStableMs = 700; // faster adaptation for mobile
  private readonly desktopBaselineFloor = 0.002;
  private readonly desktopBaselineCeiling = 0.08;
  private readonly mobileBaselineFloor = 0.003;
  private readonly mobileBaselineCeiling = 0.10;

  // VAD state
  private vadActive: boolean = false; // currently capturing a speech segment

  // PCM capture state for WAV-per-segment path
  private preRollSampleChunks: Float32Array[] = [];
  private preRollTotalSamples: number = 0;
  private preRollMaxSamples: number = 0;
  private activeSampleChunks: Float32Array[] = [];
  private activeTotalSamples: number = 0;

  constructor(options: STTRecorderOptions = {}) {
    this.options = {
      baselineCaptureDuration: 600, // 600ms baseline - shorter for faster start
      silenceMargin: 0.15, // 15% below baseline
      silenceHangover: 300, // 300ms before triggering silence
      triggerPercent: 0.2, // 20% above baseline to start
      preRollMs: 800, // 800ms pre-roll to capture early speech
      ...options
    };

    // Apply mobile-specific defaults unless explicitly overridden
    if (this.isMobileDevice()) {
      if (options.silenceMargin === undefined) {
        this.options.silenceMargin = 0.10; // more sensitive on mobile
      }
      if (options.silenceHangover === undefined) {
        this.options.silenceHangover = 500; // slightly longer to avoid premature stops
      }
      if (options.baselineCaptureDuration === undefined) {
        this.options.baselineCaptureDuration = 700; // 700ms baseline on mobile
      }
    }
  }

  async start(): Promise<void> {
    if (this.isRecording) return;

    try {
      // Step 1: Request mic access
      this.mediaStream = await this.requestMicrophoneAccess();
      
      // Step 2: Setup filtered audio chain and energy monitoring
      this.setupEnergyMonitoring();
      
      // Step 3-4: Switch to WAV capture path only
      this.isRecording = true;

    } catch (error) {
      this.options.onError?.(error as Error);
      throw error;
    }
  }

  private async requestMicrophoneAccess(): Promise<MediaStream> {
    // Check for secure context (HTTPS)
    if (!window.isSecureContext && location.hostname !== 'localhost') {
      throw new Error('Microphone access requires HTTPS or localhost');
    }

    // Check for getUserMedia support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('getUserMedia is not supported in this browser');
    }

    // Request mic access - simple approach
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        noiseSuppression: true,
        echoCancellation: true,
        autoGainControl: false,
      }
    });

    return stream;
  }

  stop(): void {
    if (!this.isRecording) return;
    this.isRecording = false;
    // Finalize any active segment immediately
    if (this.vadActive) {
      this.finalizeActiveSegment();
    }
  }

  // Start a new recording segment quickly using existing stream
  startNewRecording(): void {
    if (this.isRecording) return;
    try {
      this.resumeInput();
      this.resetBaselineCapture();
      this.vadActive = false;
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
      this.isRecording = true;
    } catch (e) {
      console.error('[UniversalSTTRecorder] Failed to start new recording segment:', e);
    }
  }

  // Pause mic input without tearing down the stream
  pauseInput(): void {
    if (!this.mediaStream) return;
    this.mediaStream.getAudioTracks().forEach(track => {
      track.enabled = false;
    });
  }

  // Resume mic input
  resumeInput(): void {
    if (!this.mediaStream) return;
    this.mediaStream.getAudioTracks().forEach(track => {
      track.enabled = true;
    });
  }

  // MediaRecorder path removed; using PCM WAV per-segment

  private setupEnergyMonitoring(): void {
    if (!this.mediaStream) {
      console.error('[UniversalSTTRecorder] No mediaStream for energy monitoring');
      return;
    }

    // Create AudioContext and simplified filter chain
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

    // Essential high-pass filter: cut low-frequency rumble at 80Hz
    this.highPassFilter = this.audioContext.createBiquadFilter();
    this.highPassFilter.type = 'highpass';
    this.highPassFilter.frequency.value = 80; // Hz (cut below ~80Hz)
    this.highPassFilter.Q.value = 0.8;

    // Simple speech band: add low-pass at ~4kHz (HPF + LPF ≈ bandpass with low complexity)
    this.lowPassFilter = this.audioContext.createBiquadFilter();
    this.lowPassFilter.type = 'lowpass';
    this.lowPassFilter.frequency.value = 4000; // Hz
    this.lowPassFilter.Q.value = 0.7;
    this.highPassFilter.connect(this.lowPassFilter);
    // Desktop-only adaptive gain stage (mobile stays at 1.0)
    this.adaptiveGain = this.audioContext.createGain();
    this.adaptiveGain.gain.value = 1;
    this.lowPassFilter.connect(this.adaptiveGain);
    const lastFilterNode = this.adaptiveGain;

    // Analyser for energy monitoring with simplified settings
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0; // No smoothing - we'll handle it ourselves

    // Simplified graph: source -> HPF -> LPF -> [adaptiveGain] -> analyser
    sourceNode.connect(this.highPassFilter);
    lastFilterNode.connect(this.analyser);

    // Lightweight PCM tap for WAV-per-segment encoding
    try {
      this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.silentGain = this.audioContext.createGain();
      this.silentGain.gain.value = 0;
      lastFilterNode.connect(this.scriptProcessor);
      // Keep node alive by connecting to destination via silent gain
      this.scriptProcessor.connect(this.silentGain);
      this.silentGain.connect(this.audioContext.destination);

      // Compute pre-roll capacity in samples
      this.preRollMaxSamples = Math.max(1, Math.floor((this.options.preRollMs || 800) * (this.audioContext.sampleRate / 1000)));
      this.preRollSampleChunks = [];
      this.preRollTotalSamples = 0;
      this.activeSampleChunks = [];
      this.activeTotalSamples = 0;

      this.scriptProcessor.onaudioprocess = (ev: any) => {
        if (!ev || !ev.inputBuffer) return;
        const input: Float32Array = ev.inputBuffer.getChannelData(0);
        // Copy buffer because WebAudio reuses internal buffers
        const copy = new Float32Array(input.length);
        copy.set(input);
        if (this.vadActive) {
          this.activeSampleChunks.push(copy);
          this.activeTotalSamples += copy.length;
        } else {
          this.preRollSampleChunks.push(copy);
          this.preRollTotalSamples += copy.length;
          // Trim pre-roll to max samples
          while (this.preRollTotalSamples > this.preRollMaxSamples && this.preRollSampleChunks.length > 0) {
            const removed = this.preRollSampleChunks.shift()!;
            this.preRollTotalSamples -= removed.length;
          }
        }
      };
    } catch (e) {
      console.warn('[UniversalSTTRecorder] PCM tap unavailable:', e);
    }

    // Prepare data array and start monitoring
    this.dataArray = new Float32Array(this.analyser.fftSize);
    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    
    // Initialize or reuse baseline
    if (this.baselineEnergy > 0) {
      this.baselineCapturing = false;
      this.vadArmUntilTs = Date.now() + 150; // shorter guard for reused baseline
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
    // Track if we detect immediate speech during baseline
    this.earlyVoiceDetected = false;
  }

  private startEnergyMonitoring(): void {
    if (!this.analyser || !this.dataArray) return;

    let lastLevel = 0;
    let lastSpeechLikeTs = Date.now();
    let lowRmsSinceTs: number | null = null;
    
    const updateAnimation = () => {
      // Always sample analyser while the graph exists
      if (!this.analyser || !this.dataArray) return;

      // Get current audio data - create a fresh array to avoid type issues
      const tempArray = new Float32Array(this.analyser.fftSize);
      this.analyser.getFloatTimeDomainData(tempArray);
      this.dataArray = tempArray;

      // Frequency-domain snapshot for spectral measures
      if (this.freqData) {
        // Ensure buffer type matches expected ArrayBuffer for TS lib types
        const freqView = new Uint8Array(this.freqData.buffer as ArrayBuffer, this.freqData.byteOffset, this.freqData.byteLength);
        this.analyser.getByteFrequencyData(freqView);
        this.spectralFlatness = this.computeSpectralFlatness(freqView);
      }
      
      // Calculate RMS energy (lightweight)
      let sum = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        sum += this.dataArray[i] * this.dataArray[i];
      }
      const rms = Math.sqrt(sum / this.dataArray.length);
      // Track peak for simple headroom computation
      let peak = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        const v = Math.abs(this.dataArray[i]);
        if (v > peak) peak = v;
      }
      
      // Handle baseline energy capture during first ~1 second
      const now = Date.now();
      if (this.baselineCapturing) {
        this.baselineEnergySum += rms;
        this.baselineEnergyCount++;
        
        // EARLY VOICE DETECTION: If we detect high energy early, skip baseline and start recording immediately
        // This prevents cutting off the first words when user starts speaking right away
        const elapsedMs = now - this.baselineStartTime;
        const conservativeBaseline = this.isMobileDevice() ? 0.008 : 0.006; // fallback baseline
        const earlyVoiceThreshold = conservativeBaseline * 3.5; // 3.5x above conservative baseline
        
        // Only check after first 200ms to avoid button click noise
        if (elapsedMs >= 200 && elapsedMs < 500 && rms > earlyVoiceThreshold && !this.earlyVoiceDetected) {
          console.log(`[VAD] Early voice detected (${rms.toFixed(4)} > ${earlyVoiceThreshold.toFixed(4)}), skipping baseline`);
          this.earlyVoiceDetected = true;
          // Use conservative baseline and immediately arm VAD
          this.baselineEnergy = conservativeBaseline;
          this.baselineCapturing = false;
          this.vadArmUntilTs = 0; // No guard - arm immediately
          // Trigger VAD immediately since we detected voice
          this.beginActiveSegment();
          // Desktop-only: initialize adaptive gain
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
          // Arm VAD after baseline to avoid UI click/glitch triggers (reduced delay)
          this.vadArmUntilTs = now + 150;
          // Desktop-only: initialize adaptive gain from baseline
          if (!this.isMobileDevice() && this.adaptiveGain) {
            const target = this.desktopTargetRMS;
            const rawGain = target / Math.max(1e-6, this.baselineEnergy);
            this.currentGain = Math.max(0.5, Math.min(6, rawGain));
            this.adaptiveGain.gain.value = this.currentGain;
          }
        }
      }
      
      // Smooth level changes for UI (prevent jittery animation)
      const rawLevel = Math.min(1, rms * 15);
      const smoothedLevel = lastLevel * 0.7 + rawLevel * 0.3;
      lastLevel = smoothedLevel;

      // Feed energy signal to animation
      this.options.onLevel?.(smoothedLevel);

      // Desktop-only dynamic gain update (EMA smoothing + headroom clamp)
      if (!this.isMobileDevice() && this.adaptiveGain) {
        const target = this.desktopTargetRMS;
        const desired = target / Math.max(1e-6, rms);
        // Headroom: keep peaks under ~0.9
        const headroom = peak > 0 ? 0.9 / peak : 6;
        const clamped = Math.max(0.5, Math.min(6, Math.min(desired, headroom)));
        // EMA smoothing (~300ms): alpha depends on RAF cadence; approximate alpha=0.1
        this.currentGain = this.currentGain * 0.9 + clamped * 0.1;
        this.adaptiveGain.gain.value = this.currentGain;
      }

      // Only run simplified VAD/silence detection while actively recording AND after baseline is captured
      if (this.isRecording && !this.baselineCapturing && this.baselineEnergy > 0) {
        const startThreshold = this.baselineEnergy * (1 + (this.options.triggerPercent || 0.2));
        const stopThreshold = this.baselineEnergy * (1 - this.options.silenceMargin!);
        
        if (!this.vadActive) {
          // Do not arm until after the guard window post-baseline
          if (Date.now() < this.vadArmUntilTs) {
            this.animationFrame = requestAnimationFrame(updateAnimation);
            return;
          }
          // Wait for a 20% jump above baseline to begin a segment
          if (rms > startThreshold) {
            this.beginActiveSegment();
          }
        } else {
          // While active, monitor for silence and hangover before finalizing
          const isSpeaking = rms > stopThreshold;
          const noiseLike = this.spectralFlatness >= 0.4; // relaxed spectral gate

          // Track last speech-like time (either energy above threshold or spectrum speech-like)
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
              this.silenceTimer = setTimeout(() => {
                this.finalizeActiveSegment();
              }, this.options.silenceHangover);
            }
          } else {
            if (this.silenceTimer) {
              clearTimeout(this.silenceTimer);
              this.silenceTimer = null;
            }
          }
        }

        // Baseline adaptation during silence only (freeze while speaking)
        const isSilent = rms <= stopThreshold;
        const noiseLike = this.spectralFlatness >= 0.4; // adapt baseline only when noise-like (relaxed)
        if (isSilent && noiseLike) {
          // Update ambient EMA
          const ambientAlpha = 0.1; // slow
          this.ambientEma = this.ambientEma === 0 ? rms : (this.ambientEma * (1 - ambientAlpha) + rms * ambientAlpha);
          const trigger = this.isMobileDevice() ? this.mobileBaselineTrigger : this.desktopBaselineTrigger;
          const stableMs = this.isMobileDevice() ? this.mobileAmbientStableMs : this.desktopAmbientStableMs;
          const dev = Math.abs(this.ambientEma - this.baselineEnergy) / Math.max(1e-6, this.baselineEnergy);
          if (dev > trigger) {
            if (this.ambientStableSince === 0) this.ambientStableSince = Date.now();
            if (Date.now() - this.ambientStableSince >= stableMs) {
              // Apply asymmetric EMA to baseline
              const upward = this.ambientEma > this.baselineEnergy;
              const alpha = upward ? 0.38 : 0.14; // more aggressive upward, modest downward
              let newBaseline = this.baselineEnergy * (1 - alpha) + this.ambientEma * alpha;
              // Clamp to platform-specific bounds
              const floor = this.isMobileDevice() ? this.mobileBaselineFloor : this.desktopBaselineFloor;
              const ceil = this.isMobileDevice() ? this.mobileBaselineCeiling : this.desktopBaselineCeiling;
              newBaseline = Math.min(Math.max(newBaseline, floor), ceil);
              this.baselineEnergy = newBaseline;
              this.baselineLastUpdated = Date.now();
              // Re-arm briefly to avoid immediate retrigger after shift
              this.vadArmUntilTs = Date.now() + 200;
              // Reset stable window to avoid repeated updates
              this.ambientStableSince = 0;
            }
          } else {
            this.ambientStableSince = 0;
          }
        } else {
          // Speaking/noise: do not adapt baseline
          this.ambientStableSince = 0;
        }
      }

      this.animationFrame = requestAnimationFrame(updateAnimation);
    };

    updateAnimation(); // Start the energy monitoring loop
  }

  // Spectral flatness (0=tonal/speech-like, 1=noise-like) using byte frequency data
  private computeSpectralFlatness(freq: ArrayLike<number>): number {
    if (!freq || freq.length === 0) return 1;
    const N = freq.length;
    let sum = 0;
    let sumLog = 0;
    const eps = 1e-3;
    for (let i = 0; i < N; i++) {
      const m = Math.max(eps, freq[i]); // keep strictly positive
      sum += m;
      sumLog += Math.log(m);
    }
    const am = sum / N;
    const gm = Math.exp(sumLog / N);
    const flatness = gm / Math.max(eps, am);
    // Clamp to [0,1]
    return Math.max(0, Math.min(1, flatness));
  }

  private beginActiveSegment(): void {
    // Seed PCM samples from pre-roll
    this.activeSampleChunks = this.preRollSampleChunks.slice();
    this.activeTotalSamples = this.preRollTotalSamples;
    this.vadActive = true;
  }

  private finalizeActiveSegment(): void {
    if (!this.vadActive) return;
    this.vadActive = false;
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    // Build PCM buffer from collected samples
    const totalSamples = this.activeTotalSamples;
    this.activeTotalSamples = 0;
    const sampleChunks = this.activeSampleChunks;
    this.activeSampleChunks = [];
    if (!sampleChunks || sampleChunks.length === 0 || totalSamples <= 0) return;
    // Ignore tiny segments (<100ms)
    const inputSampleRate = this.audioContext?.sampleRate || 48000;
    if (totalSamples < Math.floor(inputSampleRate * 0.1)) {
      return;
    }
    const merged = new Float32Array(totalSamples);
    let offset = 0;
    for (const ch of sampleChunks) {
      merged.set(ch, offset);
      offset += ch.length;
    }
    const resampled16k = this.resampleTo16k(merged, inputSampleRate);
    const blob = this.encodeWavPCM16Mono(resampled16k, 16000);
    // Signal processing start for UI
    try { this.options.onProcessingStart?.(); } catch {}
    // Send without blocking UI
    try {
      if (typeof queueMicrotask === 'function') {
        queueMicrotask(() => { this.sendToSTT(blob).catch(() => {}); });
      } else {
        setTimeout(() => { this.sendToSTT(blob).catch(() => {}); }, 0);
      }
    } catch {
      setTimeout(() => { this.sendToSTT(blob).catch(() => {}); }, 0);
    }
  }

  private processRecording(): void {}

  private async sendToSTT(audioBlob: Blob): Promise<void> {
    try {
      // Import STT service dynamically to avoid circular dependencies
      const sttModule = await import('@/services/voice/stt');
      const storeModule = await import('@/core/store');
      const { sttService } = sttModule;
      const { chat_id } = storeModule.useChatStore.getState();

      if (!chat_id) {
        throw new Error('No chat_id available for STT');
      }
      
      // In voice mode, STT is fire-and-forget - no transcript return
      if (this.options.chattype === 'voice') {
        // Immediately trigger thinking state via callback
        if (this.options.onTranscriptReady) {
          this.options.onTranscriptReady(''); // Empty string triggers thinking state
        }
        
        // Fire-and-forget STT call - backend handles everything
        sttService.transcribe(audioBlob, chat_id, {}, this.options.chattype, this.options.mode, this.options.user_id, this.options.user_name).catch((error) => {
          // Don't log STTLimitExceededError - it's handled gracefully by UI
          if (!(error instanceof STTLimitExceededError)) {
            console.error('[UniversalSTTRecorder] STT fire-and-forget failed:', error);
          }
          this.options.onError?.(error as Error);
        });
        return;
      }
      
      // For non-voice mode (text chat), await transcript and call callback
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
      // Don't log STTLimitExceededError - it's handled gracefully by UI
      if (!(error instanceof STTLimitExceededError)) {
        console.error('[UniversalSTTRecorder] STT failed:', error);
      }
      this.options.onError?.(error as Error);
    }
  }

  private getSupportedMimeType(): string { return 'audio/wav'; }

  // Resample Float32 mono buffer from inputSampleRate to 16kHz using linear interpolation
  private resampleTo16k(input: Float32Array, inputSampleRate: number): Int16Array {
    const targetRate = 16000;
    if (inputSampleRate === targetRate) {
      // Direct convert to Int16
      const out = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        let s = Math.max(-1, Math.min(1, input[i]));
        out[i] = (s < 0 ? s * 0x8000 : s * 0x7FFF) | 0;
      }
      return out;
    }
    const ratio = inputSampleRate / targetRate;
    const newLength = Math.floor(input.length / ratio);
    const out = new Int16Array(newLength);
    let pos = 0;
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

  // Encode mono Int16 PCM into a RIFF/WAV (44-byte header)
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
      for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
      offset += s.length;
    };
    const writeUint32 = (v: number) => { view.setUint32(offset, v, true); offset += 4; };
    const writeUint16 = (v: number) => { view.setUint16(offset, v, true); offset += 2; };

    // RIFF header
    writeString('RIFF');
    writeUint32(36 + dataSize);
    writeString('WAVE');
    // fmt chunk
    writeString('fmt ');
    writeUint32(16); // PCM
    writeUint16(1); // format = PCM
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
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
    this.highPassFilter = null;
    this.lowPassFilter = null;
    this.bandpassFilter = null;
    this.dataArray = null;
    this.vadActive = false;
    
    // Reset baseline capture state
    this.baselineEnergy = 0;
    this.baselineCapturing = false;
    this.baselineEnergySum = 0;
    this.baselineEnergyCount = 0;
  }

  dispose(): void {
    this.stop();
    this.cleanup();
  }

  // Basic mobile device detection (runtime-only)
  private isMobileDevice(): boolean {
    if (typeof navigator === 'undefined' || typeof navigator.userAgent !== 'string') {
      return false;
    }
    const ua = navigator.userAgent;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  }
}