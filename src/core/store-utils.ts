// src/core/store-utils.ts
// Store utilities that are commonly accessed dynamically
// This separation allows dynamic imports without affecting static imports

import { useChatStore } from './store';

/**
 * Get the current chat ID from the store
 */
export const getCurrentChatId = (): string | null => {
  return useChatStore.getState().chat_id;
};

/**
 * Get the current chat state
 */
export const getCurrentChatState = () => {
  return useChatStore.getState();
};
