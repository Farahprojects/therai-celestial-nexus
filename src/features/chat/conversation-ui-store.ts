import { create } from 'zustand';

interface ConversationUIState {
  isConversationOpen: boolean;
  shouldKeepClosed: boolean; // Flag to prevent reopening after upgrade popup
  openConversation: () => void;
  closeConversation: () => void;
  setShouldKeepClosed: (value: boolean) => void;
}

export const useConversationUIStore = create<ConversationUIState>((set) => ({
  isConversationOpen: false,
  shouldKeepClosed: false,
  openConversation: () => {
    // Don't open if we should keep it closed (upgrade popup shown)
    const state = useConversationUIStore.getState();
    if (state.shouldKeepClosed) {
      return;
    }
    set({ isConversationOpen: true });
    // Lock scroll
    document.body.style.overflow = 'hidden';
  },
  closeConversation: () => {
    set({ isConversationOpen: false });
    // Unlock scroll
    document.body.style.overflow = '';
  },
  setShouldKeepClosed: (value: boolean) => {
    set({ shouldKeepClosed: value });
  },
}));
