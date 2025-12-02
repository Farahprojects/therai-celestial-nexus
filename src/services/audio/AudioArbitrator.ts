/**
 * Audio Arbitrator - Ensures only one audio system runs at a time
 * Prevents conflicts between microphone and TTS playback
 */

type AudioSystem = 'microphone' | 'tts' | 'none';
type MicrophoneState = 'active' | 'muted' | 'inactive';

class AudioArbitrator {
  private currentSystem: AudioSystem = 'none';
  private microphoneState: MicrophoneState = 'inactive';
  private listeners = new Set<(system: AudioSystem) => void>();

  /**
   * Request to take control of audio system
   * Returns true if successful, false if another system is active
   */
  requestControl(system: AudioSystem): boolean {
    // Allow TTS if microphone is muted (not actively recording)
    if (system === 'tts' && this.currentSystem === 'microphone' && this.microphoneState === 'muted') {
      this.currentSystem = system;
      this.notifyListeners();
      // Audio control taken (microphone muted)
      return true;
    }

    // Standard logic for other cases
    if (this.currentSystem === 'none' || this.currentSystem === system) {
      this.currentSystem = system;
      this.notifyListeners();
      // Audio control taken
      return true;
    }

    // 🚨 BIG RED CONSOLE LOG for conflicts
    console.error(
      `🚨🚨🚨 AUDIO CONFLICT DETECTED 🚨🚨🚨\n` +
      `Current system: ${this.currentSystem.toUpperCase()}\n` +
      `Requested system: ${system.toUpperCase()}\n` +
      `Microphone state: ${this.microphoneState.toUpperCase()}\n` +
      `ONLY ONE AUDIO SYSTEM CAN RUN AT A TIME!\n` +
      `🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨`
    );
    return false;
  }

  /**
   * Release control of audio system
   */
  releaseControl(system: AudioSystem): void {
    if (this.currentSystem === system) {
      this.currentSystem = 'none';
      this.notifyListeners();
      // Audio control released
    }
  }

  /**
   * Set microphone state (active, muted, inactive)
   */
  setMicrophoneState(state: MicrophoneState): void {
    this.microphoneState = state;
    // Microphone state updated
  }

  /**
   * Get microphone state
   */
  getMicrophoneState(): MicrophoneState {
    return this.microphoneState;
  }

  /**
   * Get current active system
   */
  getCurrentSystem(): AudioSystem {
    return this.currentSystem;
  }

  /**
   * Check if a system can take control
   */
  canTakeControl(system: AudioSystem): boolean {
    return this.currentSystem === 'none' || this.currentSystem === system;
  }

  /**
   * Force release all systems (emergency cleanup)
   */
  forceReleaseAll(): void {
    // Only log and cleanup if there's actually an active audio system
    if (this.currentSystem !== 'none') {
      console.warn('🚨 [AudioArbitrator] Force releasing all audio systems');
      this.currentSystem = 'none';
      this.notifyListeners();
    }
  }

  /**
   * Subscribe to system changes
   */
  subscribe(listener: (system: AudioSystem) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.currentSystem));
  }
}

export const audioArbitrator = new AudioArbitrator();
