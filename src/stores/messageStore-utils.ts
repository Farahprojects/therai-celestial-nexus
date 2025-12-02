// src/stores/messageStore-utils.ts
// MessageStore utilities that are commonly accessed dynamically
// This separation allows dynamic imports without affecting static imports

import { useMessageStore } from './messageStore';
import type { Message } from '@/core/types';

/**
 * Get the message store state
 */
export const getMessageStoreState = () => {
  return useMessageStore.getState();
};

/**
 * Add an optimistic message
 */
export const addOptimisticMessage = (message: Message) => {
  return useMessageStore.getState().addOptimisticMessage(message);
};

/**
 * Trigger message store self-clean
 */
export const triggerMessageStoreSelfClean = async () => {
  return useMessageStore.getState().triggerSelfClean();
};
