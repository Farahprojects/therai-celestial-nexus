// Shared LLM provider configuration helper
// Fetches system config to determine which LLM handler to use

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

let cachedConfig: { use_gemini: boolean; cached_at: number } | null = null;
const CACHE_TTL_MS = 600000; // Cache for 10 minutes (reduced DB queries)

/**
 * Get LLM handler endpoint based on system configuration
 * Returns either 'llm-handler-gemini' or 'llm-handler-chatgpt'
 * Caches result for 1 minute to reduce DB calls
 */
export async function getLLMHandler(supabaseUrl: string, supabaseKey: string): Promise<string> {
  const now = Date.now();
  
  // Return cached value if still valid
  if (cachedConfig && (now - cachedConfig.cached_at) < CACHE_TTL_MS) {
    return cachedConfig.use_gemini ? "llm-handler-gemini" : "llm-handler-chatgpt";
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });

    const { data, error } = await supabase
      .from("system_config")
      .select("value")
      .eq("key", "llm_provider")
      .single();

    if (error) {
      console.warn("[llmConfig] Failed to fetch config, defaulting to Gemini:", error.message);
      cachedConfig = { use_gemini: true, cached_at: now };
      return "llm-handler-gemini";
    }

    const useGemini = data?.value?.use_gemini ?? true;
    cachedConfig = { use_gemini: useGemini, cached_at: now };
    
    console.log(`[llmConfig] Using ${useGemini ? 'Gemini' : 'ChatGPT'} handler`);
    return useGemini ? "llm-handler-gemini" : "llm-handler-chatgpt";

  } catch (e) {
    console.error("[llmConfig] Exception fetching config:", e);
    // Default to Gemini on error
    cachedConfig = { use_gemini: true, cached_at: now };
    return "llm-handler-gemini";
  }
}

/**
 * Clear the cached configuration (useful for testing)
 */
export function clearLLMConfigCache(): void {
  cachedConfig = null;
}

