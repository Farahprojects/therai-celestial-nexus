import { create } from 'zustand';

interface AudioState {
  audioContext: AudioContext | null;
  isAudioUnlocked: boolean;
  setAudioUnlocked: (val: boolean) => void;
  initializeAudioContext: () => AudioContext;
  resumeAudioContext: () => Promise<boolean>;
  cleanup: () => Promise<void>;
}

export const useAudioStore = create<AudioState>((set, get) => ({
  audioContext: null,
  isAudioUnlocked: false,
  
  setAudioUnlocked: (val: boolean) => set({ isAudioUnlocked: val }),
  
  initializeAudioContext: () => {
    const { audioContext } = get();
    if (audioContext) return audioContext;
    
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const newAudioContext = new AudioContextClass();
    set({ audioContext: newAudioContext });
    return newAudioContext;
  },
  
  resumeAudioContext: async () => {
    const { audioContext } = get();
    if (!audioContext) return false;
    
    if (audioContext.state === 'suspended') {
      try {
        await audioContext.resume();
        console.log('[AudioStore] ✅ AudioContext resumed via user gesture!');
        set({ isAudioUnlocked: true });
        return true;
      } catch (error) {
        console.error('[AudioStore] ❌ Failed to resume AudioContext:', error);
        return false;
      }
    } else {
      set({ isAudioUnlocked: true });
      return true;
    }
  },
  
  // 🔥 CLEANUP: Close AudioContext and reset state
  cleanup: async () => {
    const { audioContext } = get();
    if (audioContext && audioContext.state !== 'closed') {
      try {
        await audioContext.close();
        console.log('[AudioStore] 🔥 AudioContext closed');
      } catch (error) {
        console.error('[AudioStore] ❌ Failed to close AudioContext:', error);
      }
    }
    // Always reset state
    set({ audioContext: null, isAudioUnlocked: false });
  }
}));
