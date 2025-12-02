// Simple Universal STT Recorder - production-hardened

import { STTLimitExceededError } from '@/services/voice/stt-errors';
import { Capacitor } from '@capacitor/core';
import BluetoothAudio from '@/plugins/BluetoothAudio';

export interface STTRecorderOptions {
  onTranscriptReady?: (transcript: string) => void;
  onError?: (error: Error) => void;
  onLevel?: (level: number) => void;
  onVadStateChange?: (active: boolean) => void; // new: notify UI when VAD starts/stops
  onProcessingStart?: () => void; // fired when recording stops and processing begins

  // Baseline/VAD tuning
  baselineCaptureDuration?: number; // ms to capture baseline energy (default: 600; mobile 700)
  triggerPercent?: number; // percentage above baseline to start capture (default: 0.2)
  silenceMargin?: number; // percentage below baseline to trigger silence (default: 0.15; mobile 0.10)
  silenceHangover?: number; // ms before triggering silence (default: 300; mobile 500)
  startHoldMs?: number; // ms energy must stay above start threshold to begin (default: 80)
  postFinalizeGuardMs?: number; // ms guard after finalize to avoid retrigger (default: 450)
  minActiveMs?: number; // minimal accepted segment duration (default: 280)
  maxActiveMs?: number; // maximal segment duration before forced finalize (default: 15000)
  minSegSnrFactor?: number; // minimal segment RMS / baseline to accept (default: 1.3)
  startSpectralFlatnessMax?: number; // spectral flatness threshold to allow start (default: 0.65)
  zcrMin?: number; // zero-crossing rate lower bound to allow start (default: 0.01)
  zcrMax?: number; // zero-crossing rate upper bound to allow start (default: 0.28)

  // Audio capture
  preRollMs?: number; // how much audio before trigger to include (default: 800)

  // Product mode
  chattype?: string; // e.g., 'voice' or 'text'
  mode?: string; // e.g., 'chat' or 'astro'
  user_id?: string; // user ID for message attribution
  user_name?: string; // user name for message attribution
  chat_id?: string; // optional chat_id (e.g., for journal entries using folder_id)

  // Audio context sharing (prevents multiple contexts)
  audioContextProvider?: () => AudioContext | null;

  // Diagnostics
  debug?: boolean; // reduce logs in production (default: false)
}

export class UniversalSTTRecorder {
  // Recording components
  private mediaStream: MediaStream | null = null;

  // Energy monitoring components
  private audioContext: AudioContext | null = null;
  private audioContextProvider: (() => AudioContext | null) | null = null;
  private isUsingExternalContext = false;
  private analyser: AnalyserNode | null = null;
  private animationFrame: number | null = null;
  private dataArray: Float32Array | null = null;
  private freqData: Uint8Array | null = null;
  private spectralFlatness: number = 1; // 1=noise-like, 0=tonal
  private highPassFilter: BiquadFilterNode | null = null;
  private lowPassFilter: BiquadFilterNode | null = null;
  private bandpassFilter: BiquadFilterNode | null = null; // kept for compat
  private adaptiveGain: GainNode | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private silentGain: GainNode | null = null;

  // VAD and timers
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private isRecording = false;
  private options: STTRecorderOptions;
  private debug = false;

  // Baseline state
  private baselineEnergy = 0;
  private baselineStartTime = 0;
  private baselineCapturing = false;
  private baselineEnergySum = 0;
  private baselineEnergyCount = 0;
  private vadArmUntilTs = 0; // time after which VAD can arm
  private earlyVoiceDetected = false;

  // Desktop gain
  private currentGain = 1;
  private desktopTargetRMS = 0.12;

  // Baseline adaptation
  private ambientEma = 0;
  private ambientStableSince = 0;
  private baselineLastUpdated = 0;
  private readonly desktopBaselineTrigger = 0.18;
  private readonly mobileBaselineTrigger = 0.22;
  private readonly desktopAmbientStableMs = 600;
  private readonly mobileAmbientStableMs = 700;
  private readonly desktopBaselineFloor = 0.002;
  private readonly desktopBaselineCeiling = 0.08;
  private readonly mobileBaselineFloor = 0.003;
  private readonly mobileBaselineCeiling = 0.10;

  // VAD state
  private vadActive = false;
  private segmentStartTs = 0;
  private startCandidateSinceTs: number | null = null; // hold-start logic
  private rmsEma = 0; // for slope gating
  private lastRms = 0;

  // Mic pause state
  private isInputPaused = false;

  // PCM capture state
  private preRollSampleChunks: Float32Array[] = [];
  private preRollTotalSamples = 0;
  private preRollMaxSamples = 0;
  private activeSampleChunks: Float32Array[] = [];
  private activeTotalSamples = 0;

  constructor(options: STTRecorderOptions = {}) {
    this.options = {
      baselineCaptureDuration: 600,
      silenceMargin: 0.15,
      silenceHangover: 300,
      triggerPercent: 0.2,
      preRollMs: 800,
      startHoldMs: 80,
      postFinalizeGuardMs: 450,
      minActiveMs: 280,
      maxActiveMs: 15000,
      minSegSnrFactor: 1.3,
      startSpectralFlatnessMax: 0.65,
      zcrMin: 0.01,
      zcrMax: 0.28,
      debug: false,
      ...options
    };

    // Store audio context provider for shared context usage
    this.audioContextProvider = this.options.audioContextProvider || null;

    this.debug = !!this.options.debug;

    // Mobile-specific defaults unless explicitly overridden
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
    if (this.isRecording) return;

    try {
      // Native mobile: configure Bluetooth routing first
      if (Capacitor.isNativePlatform()) {
        try {
          if (this.debug) console.log('[UniversalSTTRecorder] Starting Bluetooth SCO...');
          await BluetoothAudio.startBluetoothAudio();
          // Allow routing to stabilize
          await new Promise(resolve => setTimeout(resolve, 500));
          try {
            await BluetoothAudio.isBluetoothConnected();
          } catch (error) {
            if (this.debug) console.warn('[UniversalSTTRecorder] Bluetooth connection check failed:', error);
          }
        } catch (error) {
          if (this.debug) console.warn('[UniversalSTTRecorder] Bluetooth audio not started:', error);
        }
      }

      this.mediaStream = await this.requestMicrophoneAccess();
      if (this.debug) console.log('[UniversalSTTRecorder] Microphone access granted');

      await this.setupEnergyMonitoring();
      this.isRecording = true;
    } catch (error) {
      this.options.onError?.(error as Error);
      throw error;
    }
  }

  private async requestMicrophoneAccess(): Promise<MediaStream> {
    if (!window.isSecureContext && location.hostname !== 'localhost') {
      throw new Error('Microphone access requires HTTPS or localhost');
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('getUserMedia is not supported in this browser');
    }

    let preferredDeviceId: string | undefined;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter(d => d.kind === 'audioinput');
      const bluetoothLike = inputs.find(d => /bluetooth|headset|buds|sco|le/i.test(d.label));
      if (bluetoothLike?.deviceId) {
        preferredDeviceId = bluetoothLike.deviceId;
        if (this.debug) console.log('[UniversalSTTRecorder] Preferring audio input device:', bluetoothLike.label);
      }
    } catch (e) {
      if (this.debug) console.warn('[UniversalSTTRecorder] enumerateDevices failed:', e);
    }

    const audioConstraints: MediaTrackConstraints = {
      noiseSuppression: true,
      echoCancellation: true,
      autoGainControl: false,
      channelCount: 1,
      sampleRate: 48000
    };
    if (preferredDeviceId) {
      (audioConstraints as MediaTrackConstraints).deviceId = { exact: preferredDeviceId };
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
    return stream;
  }

  stop(): void {
    if (!this.isRecording) return;
    this.isRecording = false;
    if (this.vadActive) {
      this.finalizeActiveSegment();
    }
    // add a small guard so tails don’t retrigger immediately if caller restarts soon
    this.vadArmUntilTs = Date.now() + (this.options.postFinalizeGuardMs || 450);
  }

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
      // Clear any stale pre-roll so old content can’t trigger starts
      this.preRollSampleChunks = [];
      this.preRollTotalSamples = 0;

      // Provide guard after programmatic restart to avoid button-click/glitch triggers
      this.vadArmUntilTs = Date.now() + Math.max(200, (this.options.postFinalizeGuardMs || 450) / 2);

      this.isRecording = true;
      this.startCandidateSinceTs = null;
    } catch (e) {
      console.error('[UniversalSTTRecorder] Failed to start new recording segment:', e);
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

  private async setupEnergyMonitoring(): Promise<void> {
    if (!this.mediaStream) {
      console.error('[UniversalSTTRecorder] No mediaStream for energy monitoring');
      return;
    }

    // Prefer externally provided/unlocked context when available
    if (this.audioContextProvider) {
      const provided = this.audioContextProvider();
      if (provided && provided.state !== 'closed') {
        this.audioContext = provided;
        this.isUsingExternalContext = true;
        if (this.debug) console.log('[UniversalSTTRecorder] Using shared AudioContext');
      }
    }

    // Create new context if no external context available
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.isUsingExternalContext = false;
      this.audioContext = new (window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
      if (this.debug) console.log('[UniversalSTTRecorder] Created new AudioContext');
    }

    const sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

    // Filters
    this.highPassFilter = this.audioContext.createBiquadFilter();
    this.highPassFilter.type = 'highpass';
    this.highPassFilter.frequency.value = 80;
    this.highPassFilter.Q.value = 0.8;

    this.lowPassFilter = this.audioContext.createBiquadFilter();
    this.lowPassFilter.type = 'lowpass';
    this.lowPassFilter.frequency.value = 4000;
    this.lowPassFilter.Q.value = 0.7;
    this.highPassFilter.connect(this.lowPassFilter);

    // Desktop-only adaptive gain
    this.adaptiveGain = this.audioContext.createGain();
    this.adaptiveGain.gain.value = 1;
    this.lowPassFilter.connect(this.adaptiveGain);
    const lastFilterNode = this.adaptiveGain;

    // Analyser
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0;

    sourceNode.connect(this.highPassFilter);
    lastFilterNode.connect(this.analyser);

    // PCM tap using AudioWorkletNode (replaces deprecated ScriptProcessorNode)
    try {
      // Load the AudioWorklet processor
      await this.audioContext.audioWorklet.addModule('/audio-worklet-processor.js');

      this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'universal-stt-recorder-processor');
      this.silentGain = this.audioContext.createGain();
      this.silentGain.gain.value = 0;

      // Handle messages from the AudioWorklet
      this.audioWorkletNode.port.onmessage = (event) => {
        const { type, data } = event.data;
        if (type === 'audioData') {
          this.processAudioData(data);
        }
      };

      lastFilterNode.connect(this.audioWorkletNode);
      this.audioWorkletNode.connect(this.silentGain);
      this.silentGain.connect(this.audioContext.destination);

      // Pre-roll capacity
      this.preRollMaxSamples = Math.max(1, Math.floor((this.options.preRollMs || 800) * (this.audioContext.sampleRate / 1000)));
      this.preRollSampleChunks = [];
      this.preRollTotalSamples = 0;
      this.activeSampleChunks = [];
      this.activeTotalSamples = 0;

      // Audio processing logic moved to processAudioData method
    } catch (e) {
      console.warn('[UniversalSTTRecorder] AudioWorklet unavailable:', e);
    }

    // Arrays and baseline
    this.dataArray = new Float32Array(this.analyser.fftSize);
    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);

    if (this.baselineEnergy > 0) {
      this.baselineCapturing = false;
      this.vadArmUntilTs = Date.now() + 150;
    } else {
      this.resetBaselineCapture();
    }

    // Reset VAD smoothers
    this.rmsEma = 0;
    this.lastRms = 0;
    this.startCandidateSinceTs = null;

    this.startEnergyMonitoring();
  }

  /**
   * Process audio data received from AudioWorklet
   */
  private processAudioData(audioData: Float32Array): void {
    const copy = new Float32Array(audioData.length);
    copy.set(audioData);
    if (this.vadActive) {
      this.activeSampleChunks.push(copy);
      this.activeTotalSamples += copy.length;
      // Force finalize if maxActiveMs exceeded
      const now = Date.now();
      if (this.segmentStartTs && (now - this.segmentStartTs) >= (this.options.maxActiveMs || 15000)) {
        if (this.debug) console.log('[VAD] Max active duration reached - finalizing segment');
        this.finalizeActiveSegment();
      }
    } else {
      this.preRollSampleChunks.push(copy);
      this.preRollTotalSamples += copy.length;
      while (this.preRollTotalSamples > this.preRollMaxSamples && this.preRollSampleChunks.length > 0) {
        const removed = this.preRollSampleChunks.shift()!;
        this.preRollTotalSamples -= removed.length;
      }
    }
  }

  private resetBaselineCapture(): void {
    this.baselineEnergy = 0;
    this.baselineStartTime = Date.now();
    this.baselineCapturing = true;
    this.baselineEnergySum = 0;
    this.baselineEnergyCount = 0;
    this.earlyVoiceDetected = false;
  }

  private startEnergyMonitoring(): void {
    if (!this.analyser) return;

    let lastLevel = 0;
    let lastSpeechLikeTs = Date.now();
    let lowRmsSinceTs: number | null = null;
    let zeroCheckCount = 0;
    let hasLoggedZeroWarning = false;
    let attemptedDeadInputRecovery = false;

    const updateAnimation = () => {
      if (!this.analyser) return;

      const tracks = this.mediaStream?.getAudioTracks() || [];
      const allTracksDisabled = tracks.length > 0 && tracks.every(t => !t.enabled);
      if (this.isInputPaused || allTracksDisabled) {
        zeroCheckCount = 0;
        hasLoggedZeroWarning = false;
        attemptedDeadInputRecovery = false;
        this.options.onLevel?.(0);
        this.animationFrame = requestAnimationFrame(updateAnimation);
        return;
      }

      // Time-domain
      const tempArray = new Float32Array(this.analyser.fftSize);
      this.analyser.getFloatTimeDomainData(tempArray);
      this.dataArray = tempArray;

      // Zero-input detection
      const allZeros = this.dataArray.every(sample => sample === 0);
      if (allZeros) {
        zeroCheckCount++;
        if (zeroCheckCount > 10 && !hasLoggedZeroWarning) {
          console.error('[VAD] AUDIO INPUT IS ALL ZEROS');
          hasLoggedZeroWarning = true;
        }
        if (zeroCheckCount > 60 && !attemptedDeadInputRecovery && !(window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()) {
          attemptedDeadInputRecovery = true;
          try {
            if (this.mediaStream) {
              this.mediaStream.getTracks().forEach(t => t.stop());
              this.mediaStream = null;
            }
            if (this.audioContext) {
              this.audioContext.close().catch((error) => {
                console.warn('[UniversalSTTRecorder] Failed to close audio context during recovery:', error);
              });
              this.audioContext = null;
            }
            navigator.mediaDevices.getUserMedia({
              audio: {
                noiseSuppression: true,
                echoCancellation: true,
                autoGainControl: false,
                channelCount: 1
              }
            }).then(async (stream) => {
              this.mediaStream = stream;
              await this.setupEnergyMonitoring();
            }).catch((err) => {
              console.error('[VAD] Mic recovery failed:', err);
            });
          } catch (e) {
            console.error('[VAD] Mic recovery threw error:', e);
          }
        }
      } else if (zeroCheckCount > 0) {
        zeroCheckCount = 0;
        hasLoggedZeroWarning = false;
      }

      // Frequency snapshot
      if (this.freqData) {
        const freqView = new Uint8Array(this.freqData.buffer as ArrayBuffer, this.freqData.byteOffset, this.freqData.byteLength);
        this.analyser.getByteFrequencyData(freqView);
        this.spectralFlatness = this.computeSpectralFlatness(freqView);
      }

      // RMS and peak
      let sum = 0;
      let peak = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        const s = this.dataArray[i];
        sum += s * s;
        const a = Math.abs(s);
        if (a > peak) peak = a;
      }
      const rms = Math.sqrt(sum / this.dataArray.length);

      // Zero-crossing rate (simple)
      const zcr = this.computeZCR(this.dataArray);

      // Baseline capture + early voice handling
      const now = Date.now();
      if (this.baselineCapturing) {
        this.baselineEnergySum += rms;
        this.baselineEnergyCount++;

        const elapsedMs = now - this.baselineStartTime;
        const conservativeBaseline = this.isMobileDevice() ? 0.008 : 0.006;
        const earlyVoiceThreshold = conservativeBaseline * 3.5;

        if (elapsedMs >= 200 && elapsedMs < 500 && rms > earlyVoiceThreshold && !this.earlyVoiceDetected) {
          if (this.debug) console.log(`[VAD] Early voice detected (${rms.toFixed(4)} > ${earlyVoiceThreshold.toFixed(4)})`);
          this.earlyVoiceDetected = true;
          this.baselineEnergy = conservativeBaseline;
          this.baselineCapturing = false;
          this.vadArmUntilTs = 0;
          this.beginActiveSegment();
          if (!this.isMobileDevice() && this.adaptiveGain) {
            const target = this.desktopTargetRMS;
            const rawGain = target / Math.max(1e-6, this.baselineEnergy);
            this.currentGain = Math.max(0.5, Math.min(6, rawGain));
            this.adaptiveGain.gain.value = this.currentGain;
          }
        } else if (now - this.baselineStartTime >= (this.options.baselineCaptureDuration || 600)) {
          this.baselineEnergy = this.baselineEnergySum / Math.max(1, this.baselineEnergyCount);
          this.baselineCapturing = false;
          this.vadArmUntilTs = now + 150;
          if (!this.isMobileDevice() && this.adaptiveGain) {
            const target = this.desktopTargetRMS;
            const rawGain = target / Math.max(1e-6, this.baselineEnergy);
            this.currentGain = Math.max(0.5, Math.min(6, rawGain));
            this.adaptiveGain.gain.value = this.currentGain;
          }
        }
      }

      // UI level (smoothed)
      const rawLevel = Math.min(1, rms * 15);
      const smoothedLevel = lastLevel * 0.7 + rawLevel * 0.3;
      lastLevel = smoothedLevel;
      this.options.onLevel?.(smoothedLevel);

      // Desktop-only adaptive gain update
      if (!this.isMobileDevice() && this.adaptiveGain) {
        const target = this.desktopTargetRMS;
        const desired = target / Math.max(1e-6, rms);
        const headroom = peak > 0 ? 0.9 / peak : 6;
        const clamped = Math.max(0.5, Math.min(6, Math.min(desired, headroom)));
        this.currentGain = this.currentGain * 0.9 + clamped * 0.1;
        this.adaptiveGain.gain.value = this.currentGain;
      }

      // VAD logic after baseline
      if (this.isRecording && !this.baselineCapturing && this.baselineEnergy > 0) {
        const startThreshold = this.baselineEnergy * (1 + (this.options.triggerPercent || 0.2));
        const stopThreshold = this.baselineEnergy * (1 - (this.options.silenceMargin || 0.15));

        // Maintain EMA and slope
        const emaAlpha = 0.15;
        this.rmsEma = this.rmsEma === 0 ? rms : (this.rmsEma * (1 - emaAlpha) + rms * emaAlpha);
        const risingEnough = rms > (this.rmsEma * 1.1); // gentle slope requirement

        if (!this.vadActive) {
          // Guard to avoid retriggering right after finalize/baseline shifts
          if (now < this.vadArmUntilTs) {
            this.animationFrame = requestAnimationFrame(updateAnimation);
            return;
          }

          // Start gate: energy + spectral + zcr + slope + hold
          const spectralOk = (this.spectralFlatness <= (this.options.startSpectralFlatnessMax || 0.65));
          const zcrOk = (zcr >= (this.options.zcrMin || 0.01) && zcr <= (this.options.zcrMax || 0.28));
          if (rms > startThreshold && spectralOk && zcrOk && risingEnough) {
            if (this.startCandidateSinceTs === null) {
              this.startCandidateSinceTs = now;
            }
          } else {
            this.startCandidateSinceTs = null;
          }

          const holdMs = this.options.startHoldMs || 80;
          if (this.startCandidateSinceTs !== null && (now - this.startCandidateSinceTs) >= holdMs) {
            this.beginActiveSegment();
            this.startCandidateSinceTs = null;
          }
        } else {
          // Active: check speech continuity and silence hangover
          const isSpeaking = rms > stopThreshold;
          const noiseLike = this.spectralFlatness >= 0.4;

          if (isSpeaking || !noiseLike) {
            lastSpeechLikeTs = now;
          }

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
              if (this.debug) console.log(`[VAD] Silence detected - starting timer ${this.options.silenceHangover}ms`);
              this.silenceTimer = setTimeout(() => {
                if (this.debug) console.log('[VAD] Silence timer completed - finalizing segment');
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

        // Baseline adaptation during silence (noise-like)
        const isSilent = rms <= stopThreshold;
        const noiseLike = this.spectralFlatness >= 0.4;
        if (isSilent && noiseLike) {
          const ambientAlpha = 0.1;
          this.ambientEma = this.ambientEma === 0 ? rms : (this.ambientEma * (1 - ambientAlpha) + rms * ambientAlpha);
          const trigger = this.isMobileDevice() ? this.mobileBaselineTrigger : this.desktopBaselineTrigger;
          const stableMs = this.isMobileDevice() ? this.mobileAmbientStableMs : this.desktopAmbientStableMs;
          const dev = Math.abs(this.ambientEma - this.baselineEnergy) / Math.max(1e-6, this.baselineEnergy);
          if (dev > trigger) {
            if (this.ambientStableSince === 0) this.ambientStableSince = now;
            if (now - this.ambientStableSince >= stableMs) {
              const upward = this.ambientEma > this.baselineEnergy;
              const alpha = upward ? 0.38 : 0.14;
              let newBaseline = this.baselineEnergy * (1 - alpha) + this.ambientEma * alpha;
              const floor = this.isMobileDevice() ? this.mobileBaselineFloor : this.desktopBaselineFloor;
              const ceil = this.isMobileDevice() ? this.mobileBaselineCeiling : this.desktopBaselineCeiling;
              newBaseline = Math.min(Math.max(newBaseline, floor), ceil);
              this.baselineEnergy = newBaseline;
              this.baselineLastUpdated = now;
              this.vadArmUntilTs = now + 200;
              this.ambientStableSince = 0;
            }
          } else {
            this.ambientStableSince = 0;
          }
        } else {
          this.ambientStableSince = 0;
        }
      }

      this.lastRms = rms;

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

  private computeZCR(frame: Float32Array): number {
    if (!frame || frame.length < 2) return 0;
    let crossings = 0;
    const thr = 0.01; // ignore tiny fluctuations
    let prev = Math.abs(frame[0]) > thr ? Math.sign(frame[0]) : 0;
    for (let i = 1; i < frame.length; i++) {
      const v = Math.abs(frame[i]) > thr ? Math.sign(frame[i]) : 0;
      if (prev !== 0 && v !== 0 && v !== prev) crossings++;
      if (v !== 0) prev = v;
    }
    return crossings / frame.length; // normalized
  }

  private beginActiveSegment(): void {
    // Seed PCM samples from pre-roll
    this.activeSampleChunks = this.preRollSampleChunks.slice();
    this.activeTotalSamples = this.preRollTotalSamples;
    this.vadActive = true;
    this.segmentStartTs = Date.now();
    this.options.onVadStateChange?.(true);
  }

  private finalizeActiveSegment(): void {
    if (!this.vadActive) return;
    this.vadActive = false;
    this.options.onVadStateChange?.(false);

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    const totalSamples = this.activeTotalSamples;
    this.activeTotalSamples = 0;
    const sampleChunks = this.activeSampleChunks;
    this.activeSampleChunks = [];

    const inputSampleRate = this.audioContext?.sampleRate || 48000;

    // Drop tiny segments outright
    const durationMs = this.segmentStartTs ? (Date.now() - this.segmentStartTs) : 0;
    this.segmentStartTs = 0;
    const minActiveMs = this.options.minActiveMs || 280;
    if (!sampleChunks || sampleChunks.length === 0 || totalSamples <= 0 || durationMs < minActiveMs) {
      // Guard to avoid tail retriggers
      this.vadArmUntilTs = Date.now() + (this.options.postFinalizeGuardMs || 450);
      return;
    }

    // Merge samples
    const merged = new Float32Array(totalSamples);
    let offset = 0;
    for (const ch of sampleChunks) {
      merged.set(ch, offset);
      offset += ch.length;
    }

    // Segment RMS vs baseline check (drop weak segments)
    let segSum = 0;
    for (let i = 0; i < merged.length; i++) segSum += merged[i] * merged[i];
    const segRms = Math.sqrt(segSum / merged.length);
    const snrFactor = this.options.minSegSnrFactor || 1.3;
    if (segRms < this.baselineEnergy * snrFactor) {
      if (this.debug) console.log('[VAD] Dropping weak segment (SNR filter)');
      this.vadArmUntilTs = Date.now() + (this.options.postFinalizeGuardMs || 450);
      return;
    }

    const resampled16k = this.resampleTo16k(merged, inputSampleRate);
    const blob = this.encodeWavPCM16Mono(resampled16k, 16000);

    // Notify UI processing start
    try { this.options.onProcessingStart?.(); } catch (error) {
      console.warn('[UniversalSTTRecorder] onProcessingStart callback failed:', error);
    }

    // Post-finalize guard to avoid immediate retrigger due to tail noise
    this.vadArmUntilTs = Date.now() + (this.options.postFinalizeGuardMs || 450);

    // Send to STT in microtask
    try {
      if (typeof queueMicrotask === 'function') {
        queueMicrotask(() => {
          this.sendToSTT(blob).catch((error) => {
            console.error('[UniversalSTTRecorder] STT processing failed in microtask:', error);
            this.options.onError?.(error as Error);
          });
        });
      } else {
        setTimeout(() => {
          this.sendToSTT(blob).catch((error) => {
            console.error('[UniversalSTTRecorder] STT processing failed in setTimeout:', error);
            this.options.onError?.(error as Error);
          });
        }, 0);
      }
    } catch (error) {
      console.error('[UniversalSTTRecorder] Failed to schedule STT processing:', error);
      setTimeout(() => {
        this.sendToSTT(blob).catch((sttError) => {
          console.error('[UniversalSTTRecorder] STT processing failed in fallback:', sttError);
          this.options.onError?.(sttError as Error);
        });
      }, 0);
    }
  }

  private processRecording(): void {}

  private async sendToSTT(audioBlob: Blob): Promise<void> {
    try {
      const sttModule = await import('@/services/voice/stt');
      const storeUtils = await import('@/core/store-utils');
      const { sttService } = sttModule;

      // Use provided chat_id from options, or fall back to store
      const chat_id = this.options.chat_id || storeUtils.getCurrentChatId();

      if (!chat_id) {
        throw new Error('No chat_id available for STT');
      }

      if (this.options.chattype === 'voice') {
        if (this.options.onTranscriptReady) {
          this.options.onTranscriptReady('');
        }
        sttService
          .transcribe(audioBlob, chat_id, {}, this.options.chattype, this.options.mode, this.options.user_id, this.options.user_name)
          .catch((error) => {
            if (!(error instanceof STTLimitExceededError)) {
              console.error('[UniversalSTTRecorder] STT fire-and-forget failed:', error);
            }
            this.options.onError?.(error as Error);
          });
        return;
      }

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
        console.error('[UniversalSTTRecorder] STT failed:', error);
      }
      this.options.onError?.(error as Error);
    }
  }

  private getSupportedMimeType(): string { return 'audio/wav'; }

  // Resample Float32 mono to 16kHz PCM16
  private resampleTo16k(input: Float32Array, inputSampleRate: number): Int16Array {
    const targetRate = 16000;
    if (inputSampleRate === targetRate) {
      const out = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        out[i] = (s < 0 ? s * 0x8000 : s * 0x7FFF) | 0;
      }
      return out;
    }
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
    const writeString = (s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); offset += s.length; };
    const writeUint32 = (v: number) => { view.setUint32(offset, v, true); offset += 4; };
    const writeUint16 = (v: number) => { view.setUint16(offset, v, true); offset += 2; };

    writeString('RIFF');
    writeUint32(36 + dataSize);
    writeString('WAVE');
    writeString('fmt ');
    writeUint32(16);
    writeUint16(1);
    writeUint16(numChannels);
    writeUint32(sampleRate);
    writeUint32(byteRate);
    writeUint16(blockAlign);
    writeUint16(bitsPerSample);
    writeString('data');
    writeUint32(dataSize);

    let p = 44;
    for (let i = 0; i < pcm.length; i++, p += 2) view.setInt16(p, pcm[i], true);

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
    if (this.audioWorkletNode) {
      try {
        this.audioWorkletNode.port.onmessage = null;
        this.audioWorkletNode.disconnect();
      } catch (error) {
        console.warn('[UniversalSTTRecorder] Failed to disconnect audio worklet node:', error);
      }
      this.audioWorkletNode = null;
    }
    if (this.silentGain) {
      try { this.silentGain.disconnect(); } catch (error) {
        console.warn('[UniversalSTTRecorder] Failed to disconnect silent gain:', error);
      }
      this.silentGain = null;
    }
    if (this.adaptiveGain) {
      try { this.adaptiveGain.disconnect(); } catch (error) {
        console.warn('[UniversalSTTRecorder] Failed to disconnect adaptive gain:', error);
      }
      this.adaptiveGain = null;
    }
    if (this.analyser) {
      try { this.analyser.disconnect(); } catch (error) {
        console.warn('[UniversalSTTRecorder] Failed to disconnect analyser:', error);
      }
      this.analyser = null;
    }
    if (this.highPassFilter) {
      try { this.highPassFilter.disconnect(); } catch (error) {
        console.warn('[UniversalSTTRecorder] Failed to disconnect high pass filter:', error);
      }
      this.highPassFilter = null;
    }
    if (this.lowPassFilter) {
      try { this.lowPassFilter.disconnect(); } catch (error) {
        console.warn('[UniversalSTTRecorder] Failed to disconnect low pass filter:', error);
      }
      this.lowPassFilter = null;
    }
    this.bandpassFilter = null;

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    // Only close AudioContext if we created it ourselves
    if (this.audioContext && !this.isUsingExternalContext) {
      this.audioContext.close().catch((error) => {
        console.warn('[UniversalSTTRecorder] Failed to close audio context during cleanup:', error);
      });
    }
    this.audioContext = null;
    this.isUsingExternalContext = false;

    this.dataArray = null;
    this.freqData = null;
    this.preRollSampleChunks = [];
    this.preRollTotalSamples = 0;
    this.activeSampleChunks = [];
    this.activeTotalSamples = 0;
    this.vadActive = false;

    this.baselineEnergy = 0;
    this.baselineCapturing = false;
    this.baselineEnergySum = 0;
    this.baselineEnergyCount = 0;
    this.earlyVoiceDetected = false;

    this.startCandidateSinceTs = null;
  }

  dispose(): void {
    this.stop();
    this.cleanup();
  }

  private isMobileDevice(): boolean {
    if (typeof navigator === 'undefined' || typeof navigator.userAgent !== 'string') return false;
    const ua = navigator.userAgent;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  }
}
