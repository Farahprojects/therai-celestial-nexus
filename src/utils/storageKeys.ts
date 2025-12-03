/**
 * Centralized storage key namespace system
 * Provides consistent naming for authenticated users
 */

export const STORAGE_KEYS = {
  // Chat session keys (namespace by type)
  CHAT: {
    AUTH: {
      CHAT_ID: 'therai_auth_chat_id',
      SESSION_TOKEN: 'therai_auth_session_token',
      CONVERSATION_ID: 'therai_auth_conversation_id',
    },
    // Active chat_id storage (namespaced by user)
    ACTIVE: {
      AUTH: (authId: string) => `therai_active_chat_auth_${authId}`,
    },
    SHARED: {
      UUID: 'therai_chat_uuid',
      TTS_VOICE: 'therai_tts_voice',
    }
  },
  
  // UI state keys
  UI: {
    CONVERSATION_OPEN: 'therai_ui_conversation_open',
    MODAL_STATE: 'therai_ui_modal_state',
    SIDEBAR_OPEN: 'therai_ui_sidebar_open',
    SETTINGS_PANEL: 'therai_ui_settings_panel',
  },
  
  // Report generation keys
  REPORT: {
    READY_STATUS: 'therai_report_ready',
    GENERATION_STATUS: 'therai_report_generation_status',
    ERROR_STATE: 'therai_report_error_state',
  },
  
  // Navigation keys
  NAV: {
    LAST_ROUTE: 'therai_nav_last_route',
    LAST_PARAMS: 'therai_nav_last_params',
  },
  
  // Form data keys
  FORMS: {
    ASTRO_DATA: 'therai_form_astro_data',
    REPORT_FORM: 'therai_form_report_data',
  },
  
  // Legacy keys (to be cleaned up)
  LEGACY: {
    CHAT_TOKEN: 'chat_token',
    CACHED_UUID: 'cached_uuid',
  }
} as const;

/**
 * Get storage key for authenticated users
 */
export const getChatStorageKey = (key: keyof typeof STORAGE_KEYS.CHAT.AUTH) => {
  return STORAGE_KEYS.CHAT.AUTH[key];
};

/**
 * Clear all storage keys for authenticated users
 */
export const clearUserStorage = () => {
  const keys = Object.values(STORAGE_KEYS.CHAT.AUTH);
    
  keys.forEach(key => {
    try {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    } catch (error) {
      safeConsoleWarn(`[StorageKeys] Could not clear ${key}:`, error);
    }
  });
};

/**
 * Clear all legacy keys
 */
export const clearLegacyStorage = () => {
  Object.values(STORAGE_KEYS.LEGACY).forEach(key => {
    try {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    } catch (error) {
      safeConsoleWarn(`[StorageKeys] Could not clear legacy ${key}:`, error);
    }
  });
};
