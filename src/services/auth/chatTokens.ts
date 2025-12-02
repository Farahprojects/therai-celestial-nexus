// src/services/auth/chatTokens.ts

const CHAT_UUID_KEY = 'therai_chat_uuid';
const CHAT_TOKEN_KEY = 'therai_chat_token';
function getSessionStorage(): Storage | null {
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage;
  } catch {
    // eslint-disable-next-line no-empty
  }
  return null;
}

function getLocalStorage(): Storage | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // eslint-disable-next-line no-empty
  }
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
  try { ss?.setItem(CHAT_UUID_KEY, uuid); } catch {
    // eslint-disable-next-line no-empty
  }
  try { ss?.setItem(CHAT_TOKEN_KEY, token); } catch {
    // eslint-disable-next-line no-empty
  }
  // Best-effort cleanup of old localStorage values to avoid cross-tab leakage
  try { ls?.removeItem(CHAT_UUID_KEY); } catch {
    // eslint-disable-next-line no-empty
  }
  try { ls?.removeItem(CHAT_TOKEN_KEY); } catch {
    // eslint-disable-next-line no-empty
  }
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
        try { ss?.setItem(CHAT_UUID_KEY, uuid!); } catch {
    // eslint-disable-next-line no-empty
  }
        try { ls?.removeItem(CHAT_UUID_KEY); } catch {
    // eslint-disable-next-line no-empty
  }
      }
    }
    if (!token) {
      const legacyToken = ls?.getItem(CHAT_TOKEN_KEY) ?? null;
      if (legacyToken) {
        token = legacyToken;
        try { ss?.setItem(CHAT_TOKEN_KEY, token); } catch {
    // eslint-disable-next-line no-empty
  }
        try { ls?.removeItem(CHAT_TOKEN_KEY); } catch {
    // eslint-disable-next-line no-empty
  }
      }
    }

    return { uuid, token };
  } catch {
    return { uuid: null, token: null };
  }
}

export function clearChatTokens(): void {
  const ss = getSessionStorage();
  const ls = getLocalStorage();
  try { ss?.removeItem(CHAT_UUID_KEY); } catch {
    // eslint-disable-next-line no-empty
  }
  try { ss?.removeItem(CHAT_TOKEN_KEY); } catch {
    // eslint-disable-next-line no-empty
  }
  try { ls?.removeItem(CHAT_UUID_KEY); } catch {
    // eslint-disable-next-line no-empty
  }
  try { ls?.removeItem(CHAT_TOKEN_KEY); } catch {
    // eslint-disable-next-line no-empty
  }
}

// Persisted flag indicating a report is ready for this session
const HAS_REPORT_KEY = 'therai_has_report';

export function setHasReportFlag(value: boolean): void {
  const ss = getSessionStorage();
  try { ss?.setItem(HAS_REPORT_KEY, value ? '1' : '0'); } catch {
    // eslint-disable-next-line no-empty
  }
}

export function getHasReportFlag(): boolean {
  const ss = getSessionStorage();
  try { return (ss?.getItem(HAS_REPORT_KEY) ?? '') === '1'; } catch { return false; }
}

export function clearHasReportFlag(): void {
  const ss = getSessionStorage();
  const ls = getLocalStorage();
  try { ss?.removeItem(HAS_REPORT_KEY); } catch {
    // eslint-disable-next-line no-empty
  }
  try { ls?.removeItem(HAS_REPORT_KEY); } catch {
    // eslint-disable-next-line no-empty
  }
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
  } catch {
    // eslint-disable-next-line no-empty
  }

  try {
    ls?.setItem(LAST_CHAT_ID_KEY, chatId);
    ls?.setItem(LAST_CHAT_TIMESTAMP_KEY, timestamp);
  } catch {
    // eslint-disable-next-line no-empty
  }
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
  } catch {
    return { chatId: null, timestamp: null };
  }
}

export function clearLastChatId(): void {
  const ss = getSessionStorage();

  try {
    ss?.removeItem(LAST_CHAT_ID_KEY);
    ss?.removeItem(LAST_CHAT_TIMESTAMP_KEY);
  } catch {
    // eslint-disable-next-line no-empty
  }

  // Keep localStorage for cross-session persistence
  // Only clear on explicit logout
}

export function clearAllChatPersistence(): void {
  const ss = getSessionStorage();
  const ls = getLocalStorage();

  try {
    ss?.removeItem(LAST_CHAT_ID_KEY);
    ss?.removeItem(LAST_CHAT_TIMESTAMP_KEY);
  } catch {
    // eslint-disable-next-line no-empty
  }

  try {
    ls?.removeItem(LAST_CHAT_ID_KEY);
    ls?.removeItem(LAST_CHAT_TIMESTAMP_KEY);
  } catch {
    // eslint-disable-next-line no-empty
  }

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
  } catch {
    // eslint-disable-next-line no-empty
  }
}
