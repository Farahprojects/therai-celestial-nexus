// Frontend service to fetch and cache LLM provider configuration
// Checks system_config table to determine which LLM to use

import { supabase } from '@/integrations/supabase/client';

interface LLMConfig {
  use_gemini: boolean;
  fetched_at: number;
}

let cachedConfig: LLMConfig | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // Cache for 5 minutes

/**
 * Get current LLM provider configuration
 * Returns true if Gemini should be used, false for ChatGPT
 * Caches result to avoid repeated DB calls
 * Automatically fetches on app initialization
 */
export async function getLLMProvider(): Promise<boolean> {
  const now = Date.now();

  // Return cached value if still valid
  if (cachedConfig && (now - cachedConfig.fetched_at) < CACHE_TTL_MS) {
    return cachedConfig.use_gemini;
  }

  try {
    const { data, error } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'llm_provider')
      .single();

    if (error) {
      console.warn('[llmConfig] Failed to fetch config, defaulting to Gemini:', error.message);
      cachedConfig = { use_gemini: true, fetched_at: now };
      return true;
    }

    let useGemini = true;
    const configValue = data?.value;

    if (configValue && typeof configValue === 'object' && !Array.isArray(configValue)) {
      const maybeUseGemini = (configValue as Record<string, unknown>).use_gemini;
      if (typeof maybeUseGemini === 'boolean') {
        useGemini = maybeUseGemini;
      }
    }

    cachedConfig = { use_gemini: useGemini, fetched_at: now };

    console.log(`[llmConfig] LLM provider: ${useGemini ? 'Gemini' : 'ChatGPT'}`);
    return useGemini;

  } catch (e) {
    console.error('[llmConfig] Exception fetching config:', e);
    // Default to Gemini on error
    cachedConfig = { use_gemini: true, fetched_at: now };
    return true;
  }
}

/**
 * Get the LLM provider name for display purposes
 */
export async function getLLMProviderName(): Promise<string> {
  const useGemini = await getLLMProvider();
  return useGemini ? 'Gemini' : 'ChatGPT';
}

/**
 * Clear the cached configuration
 * Call this to force a fresh fetch on next request
 */
export function clearLLMConfigCache(): void {
  cachedConfig = null;
  console.log('[llmConfig] Cache cleared');
}

/**
 * Preload the LLM config on app initialization
 * Call this in your app entry point to avoid first-request delay
 */
export async function preloadLLMConfig(): Promise<void> {
  await getLLMProvider();
}

// Auto-preload on module import
preloadLLMConfig().catch((e) => {
  console.warn('[llmConfig] Failed to preload config:', e);
});

