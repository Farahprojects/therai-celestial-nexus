// src/services/auth/chatTokens.ts
import { v4 as uuidv4 } from 'uuid';

const CHAT_UUID_KEY = 'therai_chat_uuid';
const CHAT_TOKEN_KEY = 'therai_chat_token';
function getSessionStorage(): Storage | null {
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage;
  } catch (_e) {}
  return null;
}

function getLocalStorage(): Storage | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch (_e) {}
  return null;
}

// Note: Per-tab isolation is handled by conversationId caching in sessionStorage.
// UUIDs remain raw to stay compatible with backend schemas.

export interface ChatTokens {
  uuid: string | null;
  token: string | null;
}

export function setChatTokens(uuid: string, token: string): void {
  const ss = getSessionStorage();
  const ls = getLocalStorage();
  try { ss?.setItem(CHAT_UUID_KEY, uuid); } catch (_e) {}
  try { ss?.setItem(CHAT_TOKEN_KEY, token); } catch (_e) {}
  // Best-effort cleanup of old localStorage values to avoid cross-tab leakage
  try { ls?.removeItem(CHAT_UUID_KEY); } catch (_e) {}
  try { ls?.removeItem(CHAT_TOKEN_KEY); } catch (_e) {}
}

export function getChatTokens(): ChatTokens {
  const ss = getSessionStorage();
  const ls = getLocalStorage();
  try {
    // Prefer sessionStorage (tab-scoped)
    let uuid = ss?.getItem(CHAT_UUID_KEY) ?? null;
    let token = ss?.getItem(CHAT_TOKEN_KEY) ?? null;

    // Migrate from localStorage if present (legacy) and not yet in sessionStorage
    if (!uuid) {
      const legacy = ls?.getItem(CHAT_UUID_KEY) ?? null;
      if (legacy) {
        uuid = legacy;
        try { ss?.setItem(CHAT_UUID_KEY, uuid!); } catch (_e) {}
        try { ls?.removeItem(CHAT_UUID_KEY); } catch (_e) {}
      }
    }
    if (!token) {
      const legacyToken = ls?.getItem(CHAT_TOKEN_KEY) ?? null;
      if (legacyToken) {
        token = legacyToken;
        try { ss?.setItem(CHAT_TOKEN_KEY, token); } catch (_e) {}
        try { ls?.removeItem(CHAT_TOKEN_KEY); } catch (_e) {}
      }
    }

    return { uuid, token };
  } catch (_e) {
    return { uuid: null, token: null };
  }
}

export function clearChatTokens(): void {
  const ss = getSessionStorage();
  const ls = getLocalStorage();
  try { ss?.removeItem(CHAT_UUID_KEY); } catch (_e) {}
  try { ss?.removeItem(CHAT_TOKEN_KEY); } catch (_e) {}
  try { ls?.removeItem(CHAT_UUID_KEY); } catch (_e) {}
  try { ls?.removeItem(CHAT_TOKEN_KEY); } catch (_e) {}
}

// Persisted flag indicating a report is ready for this session
const HAS_REPORT_KEY = 'therai_has_report';

export function setHasReportFlag(value: boolean): void {
  const ss = getSessionStorage();
  try { ss?.setItem(HAS_REPORT_KEY, value ? '1' : '0'); } catch (_e) {}
}

export function getHasReportFlag(): boolean {
  const ss = getSessionStorage();
  try { return (ss?.getItem(HAS_REPORT_KEY) ?? '') === '1'; } catch (_e) { return false; }
}

export function clearHasReportFlag(): void {
  const ss = getSessionStorage();
  const ls = getLocalStorage();
  try { ss?.removeItem(HAS_REPORT_KEY); } catch (_e) {}
  try { ls?.removeItem(HAS_REPORT_KEY); } catch (_e) {}
}

// Last chat persistence utilities
const LAST_CHAT_ID_KEY = 'therai_last_chat_id';
const LAST_CHAT_TIMESTAMP_KEY = 'therai_last_chat_timestamp';

export function setLastChatId(chatId: string): void {
  const ss = getSessionStorage();
  const ls = getLocalStorage();
  const timestamp = Date.now().toString();
  
  try { 
    ss?.setItem(LAST_CHAT_ID_KEY, chatId); 
    ss?.setItem(LAST_CHAT_TIMESTAMP_KEY, timestamp);
  } catch (_e) {}
  
  try { 
    ls?.setItem(LAST_CHAT_ID_KEY, chatId); 
    ls?.setItem(LAST_CHAT_TIMESTAMP_KEY, timestamp);
  } catch (_e) {}
}

export function getLastChatId(): { chatId: string | null; timestamp: number | null } {
  const ss = getSessionStorage();
  const ls = getLocalStorage();
  
  try {
    // Prefer sessionStorage (tab-scoped)
    let chatId = ss?.getItem(LAST_CHAT_ID_KEY) ?? null;
    let timestampStr = ss?.getItem(LAST_CHAT_TIMESTAMP_KEY) ?? null;
    
    // Fallback to localStorage for cross-session persistence
    if (!chatId) {
      chatId = ls?.getItem(LAST_CHAT_ID_KEY) ?? null;
      timestampStr = ls?.getItem(LAST_CHAT_TIMESTAMP_KEY) ?? null;
    }
    
    const timestamp = timestampStr ? parseInt(timestampStr, 10) : null;
    
    return { chatId, timestamp };
  } catch (_e) {
    return { chatId: null, timestamp: null };
  }
}

export function clearLastChatId(): void {
  const ss = getSessionStorage();
  const ls = getLocalStorage();
  
  try { 
    ss?.removeItem(LAST_CHAT_ID_KEY); 
    ss?.removeItem(LAST_CHAT_TIMESTAMP_KEY);
  } catch (_e) {}
  
  // Keep localStorage for cross-session persistence
  // Only clear on explicit logout
}

export function clearAllChatPersistence(): void {
  const ss = getSessionStorage();
  const ls = getLocalStorage();
  
  try { 
    ss?.removeItem(LAST_CHAT_ID_KEY); 
    ss?.removeItem(LAST_CHAT_TIMESTAMP_KEY);
  } catch (_e) {}
  
  try { 
    ls?.removeItem(LAST_CHAT_ID_KEY); 
    ls?.removeItem(LAST_CHAT_TIMESTAMP_KEY);
  } catch (_e) {}
  
  // Also clear redirect persistence on logout
  try {
    ls?.removeItem('pending_redirect_path');
    ls?.removeItem('pending_join_folder_id');
    ls?.removeItem('pending_join_chat_id');
    ls?.removeItem('pending_join_token');
    ls?.removeItem('chat_id');
    // Clear any namespaced active chat keys
    Object.keys(ls || {}).forEach((key) => {
      if (key.startsWith('therai_active_chat_auth_')) {
        ls?.removeItem(key);
      }
    });
  } catch (_e) {}
}
