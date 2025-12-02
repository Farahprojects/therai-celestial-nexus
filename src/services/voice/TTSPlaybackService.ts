import { directBarsAnimationService, FourBarLevels } from '@/services/voice/DirectBarsAnimationService';
import { audioArbitrator } from '@/services/audio/AudioArbitrator';

class TTSPlaybackService {
  private audioContext: AudioContext | null = null;
  private externalContextProvider: (() => AudioContext | null) | null = null;
  private isUsingExternalContext: boolean = false;
  private currentSource: HTMLAudioElement | null = null;
  private mediaElementNode: MediaElementAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private animationTimer: number | null = null;
  private isPlaying = false;
  private isPaused = false;
  private isStopping = false;
  private listeners = new Set<() => void>();
  private currentUrl: string | null = null;
  private bufferSource: AudioBufferSourceNode | null = null; // fallback path tracking

  private notify() {
    this.listeners.forEach((l) => l());
  }

  // Safari detection for UI-only gain adjustments
  private isSafari(): boolean {
    const ua = navigator.userAgent || '';
    const vendor = (navigator as { vendor?: string }).vendor || '';
    const isSafariUA = /Safari/i.test(ua) && !/Chrome|CriOS|Chromium/i.test(ua);
    const isAppleVendor = /Apple/i.test(vendor);
    return isSafariUA && isAppleVendor;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getState() {
    return { isPlaying: this.isPlaying, isPaused: this.isPaused };
  }

  // Warmup method to pre-initialize audio context and warm the decode path
  async warmup(): Promise<void> {
    try {
      const ctx = this.ensureAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      
      // Pre-warm the decode path with a tiny silent buffer
      const silentBuffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      const source = ctx.createBufferSource();
      source.buffer = silentBuffer;
      source.connect(ctx.destination);
      source.start(0);
      source.stop(0.001); // Stop immediately
      
    } catch (error) {
      console.error('[TTSPlaybackService] Warmup failed:', error);
    }
  }

  // Allow consumers to inject a shared/unlocked AudioContext
  setAudioContextProvider(provider: () => AudioContext | null): void {
    this.externalContextProvider = provider;
  }

  private ensureAudioContext(): AudioContext {
    // Prefer externally provided/unlocked context when available
    if (this.externalContextProvider) {
      const provided = this.externalContextProvider();
      if (provided) {
        this.audioContext = provided;
        this.isUsingExternalContext = true;
      }
    }

    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.isUsingExternalContext = false;
      try {
        this.audioContext = new (window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)({ latencyHint: 'playback' });
      } catch {
        this.audioContext = new (window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
      }

      // Tie animation pause/resume to playback context
      this.audioContext.onstatechange = () => {
        if (!this.audioContext) return;
        const state = this.audioContext.state;
        if (state === 'suspended') {
          this.isPaused = true;
          directBarsAnimationService.pause();
        } else if (state === 'running') {
          this.isPaused = false;
          directBarsAnimationService.resume();
        }
        this.notify();
      };
    }
    return this.audioContext;
  }

  private startAnimation(analyser: AnalyserNode) {
    directBarsAnimationService.start();
    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    const step = () => {
      // Continue while either HTMLMediaElement or BufferSource is active
      if (!this.currentSource && !this.bufferSource) {
        this.animationTimer = null;
        return;
      }
      analyser.getByteFrequencyData(frequencyData);
      let total = 0;
      for (let i = 0; i < frequencyData.length; i++) total += frequencyData[i];
      const raw = total / (frequencyData.length * 255);
      // Base mapping with floor to keep small movement
      let overall = Math.min(1, Math.max(0.2, raw * 0.8 + 0.2));
      // Safari-only visual boost
      if (this.isSafari()) {
        overall = Math.min(1, Math.max(0.2, overall * 1.35));
      }
      const levels: FourBarLevels = [overall, overall, overall, overall];
      directBarsAnimationService.notifyBars(levels);
      this.animationTimer = window.setTimeout(step, 40);
    };
    this.animationTimer = window.setTimeout(step, 40);
  }

  private stopAnimation() {
    // 🔥 CLEANUP: Ensure timer is cleared
    if (this.animationTimer) {
      clearTimeout(this.animationTimer);
      this.animationTimer = null;
    }
    directBarsAnimationService.stop();
  }

  // Safari fallback: decode full buffer and play via BufferSource
  private async playWithBufferAudio(audioBytes: number[], onEnded?: () => void): Promise<void> {
    const ctx = this.ensureAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    const buffer = await this.decodeToBuffer(audioBytes);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    
    // Same clean audio chain as streaming path
    const lowPass = ctx.createBiquadFilter();
    lowPass.type = 'lowpass';
    lowPass.frequency.value = 8000;
    lowPass.Q.value = 0.7;
    
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 10;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.15;
    
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.3;
    
    source.connect(lowPass);
    lowPass.connect(compressor);
    compressor.connect(analyser);
    analyser.connect(ctx.destination);

    // For fallback path, we don't use HTMLAudioElement
    this.currentSource = null;
    this.mediaElementNode = null;
    this.analyser = analyser;
    this.bufferSource = source;
    this.isPlaying = true;
    this.isPaused = false;
    this.notify();

    // Start animation slightly delayed to align with audible start
    const startTimer = window.setTimeout(() => this.startAnimation(analyser), 80);

    source.onended = () => {
      window.clearTimeout(startTimer);
      this.finalizePlayback(onEnded);
    };

    source.start(0);
  }

  private async decodeToBuffer(audioBytes: number[]): Promise<AudioBuffer> {
    const ctx = this.ensureAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    const arrayBuffer = new Uint8Array(audioBytes).buffer;
    return await ctx.decodeAudioData(arrayBuffer);
  }

  async play(audioBytes: number[], onEnded?: () => void): Promise<void> {
    try {
      // 🎵 REQUEST AUDIO CONTROL - Ensure no conflicts
      if (!audioArbitrator.requestControl('tts')) {
        throw new Error('Cannot start TTS playback - microphone is active');
      }

      const ctx = this.ensureAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();

      // Teardown existing (without releasing control)
      this.internalStop();

      // Create streaming audio element and connect to analyser
      const audioBlob = new Blob([new Uint8Array(audioBytes)], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audioEl = new Audio();
      audioEl.preload = 'auto';
      audioEl.muted = false; // audible
      audioEl.volume = 1.0;
      (audioEl as HTMLAudioElement & { playsInline?: boolean }).playsInline = true; // iOS inline
      audioEl.src = audioUrl;

      // Create audio processing chain for clean playback
      const mediaNode = ctx.createMediaElementSource(audioEl);
      
      // 1. Low-pass filter at 8kHz to remove high-frequency compression artifacts
      const lowPass = ctx.createBiquadFilter();
      lowPass.type = 'lowpass';
      lowPass.frequency.value = 8000; // Clean TTS range (human voice ~80-8000Hz)
      lowPass.Q.value = 0.7; // Smooth rolloff
      
      // 2. Gentle compression to smooth volume fluctuations
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -24; // Catch louder peaks
      compressor.knee.value = 10; // Smooth compression curve
      compressor.ratio.value = 3; // Gentle 3:1 ratio
      compressor.attack.value = 0.003; // 3ms attack (fast)
      compressor.release.value = 0.15; // 150ms release (smooth)
      
      // 3. Analyser for visualization (lighter smoothing)
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.3; // Reduced from 0.8 to avoid phase artifacts
      
      // Chain: mediaNode → lowPass → compressor → analyser → destination
      mediaNode.connect(lowPass);
      lowPass.connect(compressor);
      compressor.connect(analyser);
      analyser.connect(ctx.destination);

      this.currentSource = audioEl;
      this.mediaElementNode = mediaNode;
      this.analyser = analyser;
      this.currentUrl = audioUrl;
      this.isPlaying = true;
      this.isPaused = false;
      this.notify();

      audioEl.onplaying = () => {
        this.startAnimation(analyser);
      };

      const cleanupElement = () => this.cleanupGraph();
      const finalize = () => this.finalizePlayback(onEnded);

      audioEl.onended = finalize;
      audioEl.onerror = async () => {
        if (this.isStopping) {
          return; // Ignore errors triggered by manual stop/teardown
        }
        // Safari sometimes fails blob URLs; fallback to buffer decode path
        cleanupElement();
        try {
          await this.playWithBufferAudio(audioBytes, onEnded);
        } catch {
          finalize();
        }
      };

      // Start playback (stream-decoding by the browser)
      try {
        // Improve Safari reliability by waiting briefly if needed
        if (audioEl.readyState < 2) {
          await new Promise<void>((resolve) => setTimeout(resolve, 50));
        }
        await audioEl.play();
      } catch {
        // Autoplay restriction or other play error: try fallback decode path
        cleanupElement();
        await this.playWithBufferAudio(audioBytes, onEnded);
      }
    } catch (e) {
      this.internalStop();
      // 🎵 RELEASE CONTROL on error
      audioArbitrator.releaseControl('tts');
      throw e;
    }
  }

  async playBase64(audioBase64: string, onEnded?: () => void): Promise<void> {
    try {
      if (!audioArbitrator.requestControl('tts')) {
        throw new Error('Cannot start TTS playback - microphone is active');
      }

      const ctx = this.ensureAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();

      this.internalStop();

      const audioEl = new Audio();
      audioEl.preload = 'auto';
      audioEl.muted = false;
      audioEl.volume = 1.0;
      (audioEl as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
      audioEl.src = `data:audio/mpeg;base64,${audioBase64}`;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      const mediaNode = ctx.createMediaElementSource(audioEl);
      mediaNode.connect(analyser);
      analyser.connect(ctx.destination);

      this.currentSource = audioEl;
      this.mediaElementNode = mediaNode;
      this.analyser = analyser;
      this.currentUrl = null;
      this.isPlaying = true;
      this.isPaused = false;
      this.notify();

      audioEl.onplaying = () => {
        this.startAnimation(analyser);
      };

      const cleanupElement = () => this.cleanupGraph();
      const finalize = () => this.finalizePlayback(onEnded);

      audioEl.onended = finalize;
      audioEl.onerror = finalize;

      try {
        if (audioEl.readyState < 2) {
          await new Promise<void>((resolve) => setTimeout(resolve, 50));
        }
        await audioEl.play();
      } catch {
        cleanupElement();
        finalize();
      }
    } catch (e) {
      this.internalStop();
      audioArbitrator.releaseControl('tts');
      throw e;
    }
  }

  pause(): void {
    if (this.currentSource) {
      try { this.currentSource.pause(); } catch {
        // eslint-disable-next-line no-empty
      }
      this.isPaused = true;
      directBarsAnimationService.pause();
      this.notify();
    }
  }

  async resume(): Promise<void> {
    if (this.currentSource) {
      try { await this.currentSource.play(); } catch {
        // eslint-disable-next-line no-empty
      }
      this.isPaused = false;
      directBarsAnimationService.resume();
      this.notify();
    }
  }

  private internalStop(): void {
    this.isStopping = true;
    // Stop media element playback if present
    if (this.currentSource) {
      // Remove handlers BEFORE altering src to avoid triggering fallback onerror
      try { this.currentSource.onended = null; } catch {
        // eslint-disable-next-line no-empty
      }
      try { (this.currentSource as HTMLAudioElement & { onerror?: unknown }).onerror = null; } catch {
        // eslint-disable-next-line no-empty
      }
      try { this.currentSource.pause(); } catch {
        // eslint-disable-next-line no-empty
      }
      try { (this.currentSource as HTMLAudioElement & { src?: string }).src = ''; } catch {
        // eslint-disable-next-line no-empty
      }
    }
    // Stop buffer source playback if in fallback mode
    if (this.bufferSource) {
      this.bufferSource.onended = null; // Clear callback to prevent restart
      try { this.bufferSource.stop(0); } catch {
        // eslint-disable-next-line no-empty
      }
    }
    this.cleanupGraph();
    this.isStopping = false;
  }

  // Consolidated graph cleanup (no state changes beyond graph + URL + animation)
  private cleanupGraph(): void {
    this.stopAnimation();
    if (this.mediaElementNode) {
      try { this.mediaElementNode.disconnect(); } catch {
        // eslint-disable-next-line no-empty
      }
    }
    this.mediaElementNode = null;
    if (this.analyser) {
      try { this.analyser.disconnect(); } catch {
        // eslint-disable-next-line no-empty
      }
    }
    this.analyser = null;
    if (this.currentUrl) {
      try { URL.revokeObjectURL(this.currentUrl); } catch {
        // eslint-disable-next-line no-empty
      }
    }
    this.currentUrl = null;
    this.currentSource = null;
    this.bufferSource = null;
  }

  // Consolidated finalize: cleanup + state reset + release control + notify
  private finalizePlayback(onEnded?: () => void): void {
    this.cleanupGraph();
    this.isPlaying = false;
    this.isPaused = false;
    audioArbitrator.releaseControl('tts');
    this.notify();
    
    // Delay callback to account for audio system latency (100-300ms buffer drain time)
    // This prevents UI from showing "thinking" while audio is still audibly playing
    if (onEnded) {
      setTimeout(() => onEnded(), 250);
    }
  }

  stop(): void {
    this.internalStop();
    // 🎵 RELEASE AUDIO CONTROL when manually stopped
    audioArbitrator.releaseControl('tts');
  }

  async destroy(): Promise<void> {
    // 🔥 CLEANUP: Stop all playback and animation
    this.internalStop();
    
    // 🔥 CLEANUP: Ensure animation is fully stopped
    this.stopAnimation();
    
    // 🔥 CLEANUP: Only close when we created/own the context. Never close a shared external context.
    if (this.audioContext && this.audioContext.state !== 'closed' && !this.isUsingExternalContext) {
      try {
        await this.audioContext.close();
      } catch {
        // eslint-disable-next-line no-empty
      }
    }
    this.audioContext = null;
    this.isUsingExternalContext = false;
    this.externalContextProvider = null;
    
    // 🔥 CLEANUP: Clear all listeners and state
    this.listeners.clear();
    this.currentSource = null;
    this.mediaElementNode = null;
    this.analyser = null;
    this.bufferSource = null;
    this.currentUrl = null;
    this.isPlaying = false;
    this.isPaused = false;
    this.isStopping = false;
    
    // 🎵 RELEASE AUDIO CONTROL on destroy
    audioArbitrator.releaseControl('tts');
  }
}

export const ttsPlaybackService = new TTSPlaybackService();


