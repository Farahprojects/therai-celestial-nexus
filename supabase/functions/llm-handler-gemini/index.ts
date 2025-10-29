// Production-ready llm-handler-gemini with Gemini Context Caching
// - Caches system messages (7K tokens) for 1 hour → 90% cost reduction
// - Generates conversation summaries every 10-15 turns
// - Fetches only recent 6-8 messages for context
// - Tracks turn count for summary generation.

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

// @ts-ignore - ESM import works in Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin"
};

const json = (status: number, data: any) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });

// Env
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const GOOGLE_API_KEY = Deno.env.get("GOOGLE-LLM-NEW");
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";
const GEMINI_TIMEOUT_MS = 30000;
const SUMMARY_INTERVAL = 12; // Generate summary every 12 turns

if (!SUPABASE_URL) throw new Error("Missing env: SUPABASE_URL");
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
if (!GOOGLE_API_KEY) {
  console.error("[llm-handler-gemini] ❌ GOOGLE-LLM-NEW environment variable is not set");
  throw new Error("Missing env: GOOGLE-LLM-NEW");
}

console.log("[llm-handler-gemini] ✅ API Key loaded:", GOOGLE_API_KEY.substring(0, 4) + "..." + GOOGLE_API_KEY.substring(GOOGLE_API_KEY.length - 4));
console.log("[llm-handler-gemini] 📊 Using model:", GEMINI_MODEL);

// Supabase client (module scope)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

// Hash function to detect system data changes
function hashSystemData(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

// Simple sanitizer: strips common markdown and extra whitespace
function sanitizePlainText(input: string) {
  const s = typeof input === "string" ? input : "";
  return s
    .replace(/```[\s\S]*?```/g, "") // code blocks
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/!\[[^\]]+\]\([^)]+\)/g, "") // images
    .replace(/\[[^\]]+\]\([^)]+\)/g, "$1") // links
    .replace(/[>_~#*]+/g, "") // md symbols (including bold/italic *)
    .replace(/-{3,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const systemPrompt = `You are an AI guide for self-awareness who understands planet energies  as ressence infulance.

Pull in recent convo context only when it preserves flow or adds nuance.
Use astrodata for insight and signals 
Answer the user's latest message first and fully.

Acknowledge: One-word encourager.
Tone:
– Direct, a bit playful. Contractions welcome, dated slang not.

Read planetary and transit data as direct energetic signals on the psyche and behavior, look for potential influences and patterns.
NO stories, metaphors or atsro jargon abut planets.

Show one-line "why" tying emotional/psychological pattern back to user when applicable  

Check-in: Close with a simple, open question.`;

// Get or create Gemini cache for system message
async function getOrCreateCache(
  chat_id: string,
  systemText: string,
  supabase: any,
  GOOGLE_API_KEY: string,
  GEMINI_MODEL: string
): Promise<string | null> {
  const systemDataHash = hashSystemData(systemText);

  // Check if cache exists and is still valid
  const { data: existingCache } = await supabase
    .from("conversation_caches")
    .select("cache_name, system_data_hash, expires_at")
    .eq("chat_id", chat_id)
    .single();

  // If cache exists, is valid, and system data hasn't changed
  if (existingCache &&
    new Date(existingCache.expires_at) > new Date() &&
    existingCache.system_data_hash === systemDataHash) {
    console.log(`[cache] ✅ Using existing cache: ${existingCache.cache_name}`);
    return existingCache.cache_name;
  }

  // Create new cache
  console.log(`[cache] 🔄 Creating new cache for chat_id: ${chat_id}`);

  // Bookend astro data with system prompt for better attention
  const combinedSystemInstruction = systemText
    ? `${systemPrompt}\n\n[System Data]\n${systemText}\n\n[CRITICAL: Remember Your Instructions]\n${systemPrompt}`
    : systemPrompt;

  const cacheUrl = `https://generativelanguage.googleapis.com/v1beta/cachedContents`;

  try {
    const cacheResponse = await fetch(cacheUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GOOGLE_API_KEY
      },
      body: JSON.stringify({
        model: `models/${GEMINI_MODEL}`,
        systemInstruction: {
          role: "system",
          parts: [{ text: combinedSystemInstruction }]
        },
        ttl: "3600s" // 1 hour cache
      })
    });

    if (!cacheResponse.ok) {
      const error = await cacheResponse.text();
      console.error("[cache] ❌ Failed to create cache:", error);
      return null;
    }

    const cacheData = await cacheResponse.json();
    const cacheName = cacheData.name;

    // Calculate expiration (59 minutes to be safe)
    const expiresAt = new Date(Date.now() + 59 * 60 * 1000);

    // Store cache reference
    await supabase
      .from("conversation_caches")
      .upsert({
        chat_id,
        cache_name: cacheName,
        system_data_hash: systemDataHash,
        expires_at: expiresAt.toISOString()
      });

    console.log(`[cache] ✅ Cache created: ${cacheName}`);
    return cacheName;

  } catch (error) {
    console.error("[cache] ❌ Exception creating cache:", error);
    return null;
  }
}

// Trigger summary generation (fire-and-forget)
function triggerSummaryGeneration(
  chat_id: string,
  fromTurn: number,
  toTurn: number
): void {
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
  };

  fetch(`${SUPABASE_URL}/functions/v1/llm-summarizer`, {
    method: "POST",
    headers,
    body: JSON.stringify({ chat_id, from_turn: fromTurn, to_turn: toTurn })
  })
    .then(() => console.log(`[summary] 📝 Summary generation triggered for turns ${fromTurn}-${toTurn}`))
    .catch((e) => console.error("[summary] ❌ Failed to trigger summary:", e));
}

Deno.serve(async (req) => {
  const totalStartTime = Date.now();
  console.log("[llm-handler-gemini] ⏱️  Request received");

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const startedAt = Date.now();

  let body;
  try {
    body = await req.json();
    console.log(`[llm-handler-gemini] ⏱️  JSON parsed (+${Date.now() - totalStartTime}ms)`);
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const { chat_id, text, mode, chattype, voice, user_id, user_name } = body || {};

  if (!chat_id || typeof chat_id !== "string") return json(400, { error: "Missing or invalid field: chat_id" });
  if (!text || typeof text !== "string") return json(400, { error: "Missing or invalid field: text" });

  // Fetch context data
  const HISTORY_LIMIT = 8; // Last 6-8 messages for emotional flow

  type MessageRow = {
    role: string;
    text: string;
    created_at: string;
  };

  let systemText = "";
  let history: MessageRow[] = [];
  let cacheName: string | null = null;
  let conversationSummary = "";
  let currentTurnCount = 0;
  let lastSummaryTurn = 0;

  try {
    console.log(`[llm-handler-gemini] ⏱️  Starting context fetch (+${Date.now() - totalStartTime}ms)`);

    // Parallel fetch: cache status, system message, conversation metadata, summary, and history
    const [cacheResult, systemMessageResult, conversationResult, summaryResult, historyResult] = await Promise.all([
      // Check if cache exists (include hash for validation)
      supabase
        .from("conversation_caches")
        .select("cache_name, expires_at, system_data_hash")
        .eq("chat_id", chat_id)
        .single(),

      // Always fetch system message to validate hash
      supabase
        .from("messages")
        .select("text")
        .eq("chat_id", chat_id)
        .eq("role", "system")
        .eq("status", "complete")
        .not("text", "is", null)
        .neq("text", "")
        .order("created_at", { ascending: true })
        .limit(1)
        .single(),

      // Get conversation metadata for turn tracking
      supabase
        .from("conversations")
        .select("turn_count, last_summary_at_turn")
        .eq("id", chat_id)
        .single(),

      // Get latest summary
      supabase
        .from("conversation_summaries")
        .select("summary_text")
        .eq("chat_id", chat_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single(),

      // Get recent message history
      supabase
        .from("messages")
        .select("role, text, created_at")
        .eq("chat_id", chat_id)
        .neq("role", "system")
        .eq("status", "complete")
        .not("text", "is", null)
        .neq("text", "")
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT)
    ]);

    // Process system message
    if (systemMessageResult.data) {
      systemText = String(systemMessageResult.data.text || "");
    }

    // Validate cache - check if exists, not expired, AND hash matches current system message
    const cacheExists = cacheResult.data && new Date(cacheResult.data.expires_at) > new Date();
    const currentHash = systemText ? hashSystemData(systemText) : "";
    const hashMatches = cacheExists && cacheResult.data.system_data_hash === currentHash;

    if (cacheExists && hashMatches) {
      // Cache is valid and matches current system message
      cacheName = cacheResult.data.cache_name;
      console.log(`[llm-handler-gemini] ✅ Cache valid and hash matches, using cache`);
    } else {
      if (cacheExists && !hashMatches) {
        console.log(`[llm-handler-gemini] ⚠️  Cache exists but hash mismatch! Invalidating and recreating cache`);
        // Delete stale cache
        await supabase
          .from("conversation_caches")
          .delete()
          .eq("chat_id", chat_id);
      }

      // Create new cache with current system data
      if (systemText) {
        cacheName = await getOrCreateCache(
          chat_id,
          systemText,
          supabase,
          GOOGLE_API_KEY,
          GEMINI_MODEL
        );
      }
    }

    // Process conversation metadata
    if (conversationResult.data) {
      currentTurnCount = conversationResult.data.turn_count || 0;
      lastSummaryTurn = conversationResult.data.last_summary_at_turn || 0;
    }

    // Process summary
    if (summaryResult.data) {
      conversationSummary = String(summaryResult.data.summary_text || "");
      console.log(`[llm-handler-gemini] 📝 Found summary: ${conversationSummary.substring(0, 50)}...`);
    }

    // Process history
    if (historyResult.data) {
      history = historyResult.data as MessageRow[];
    }

    console.log(`[llm-handler-gemini] ⏱️  Context fetch complete (+${Date.now() - totalStartTime}ms)`);
  } catch (e: any) {
    console.warn("[llm-handler-gemini] Context fetch exception:", e?.message || String(e));
  }

  // Build Gemini request contents (oldest -> newest)
  type GeminiContent = {
    role: "user" | "model";
    parts: { text: string }[];
  };

  const contents: GeminiContent[] = [];

  // Add summary if available (as a user message for context)
  if (conversationSummary) {
    contents.push({
      role: "user",
      parts: [{ text: `[Previous conversation context: ${conversationSummary}]` }]
    });
    contents.push({
      role: "model",
      parts: [{ text: "Understood. I'll keep that context in mind." }]
    });
  }

  // Add recent history (oldest first)
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    const t = typeof m.text === "string" ? m.text.trim() : "";
    if (!t) continue;
    contents.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: t }]
    });
  }

  // Add current user message
  contents.push({ role: "user", parts: [{ text: String(text) }] });

  // Prepare request body
  const requestBody: any = { contents };

  if (cacheName) {
    // Use cached content (system message already in cache)
    requestBody.cachedContent = cacheName;
  } else {
    // Fallback: include system instruction directly (bookend with prompt for better attention)
    const combinedSystemInstruction = systemText
      ? `${systemPrompt}\n\n[System Data]\n${systemText}\n\n[CRITICAL: Remember Your Instructions]\n${systemPrompt}`
      : systemPrompt;
    requestBody.system_instruction = {
      role: "system",
      parts: [{ text: combinedSystemInstruction }]
    };
  }

  requestBody.generationConfig = {
    temperature: 0.7,
    thinkingConfig: { thinkingBudget: 0 }
  };

  // Make Gemini API call
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  let llmStartedAt = Date.now();
  let data;
  try {
    console.log(`[llm-handler-gemini] ⏱️  Starting Gemini API call (+${Date.now() - totalStartTime}ms)`, {
      model: GEMINI_MODEL,
      cached: !!cacheName,
      chat_id: chat_id
    });

    const resp = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GOOGLE_API_KEY },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
    clearTimeout(timeout);

    const geminiLatency = Date.now() - llmStartedAt;
    console.log(`[llm-handler-gemini] ⏱️  Gemini API responded (+${Date.now() - totalStartTime}ms) - Gemini took ${geminiLatency}ms - Status: ${resp.status}`);

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.error("[llm-handler-gemini] ❌ Gemini API error:", {
        status: resp.status,
        statusText: resp.statusText,
        error: errText
      });
      return json(502, { error: `Gemini API request failed: ${resp.status} - ${errText}` });
    }

    data = await resp.json();
    console.log("[llm-handler-gemini] ✅ Gemini API success, response time:", Date.now() - llmStartedAt, "ms");
  } catch (e) {
    clearTimeout(timeout);
    console.error("[llm-handler-gemini] ❌ Gemini request exception:", {
      error: (e as any)?.message || String(e),
      name: (e as any)?.name
    });
    return json(504, { error: `Gemini request error: ${(e as any)?.message || String(e)}` });
  }

  const llmLatencyMs = Date.now() - llmStartedAt;

  // Extract assistant text
  let assistantText = "";
  try {
    const parts = data?.candidates?.[0]?.content?.parts || [];
    assistantText = parts.map((p: any) => p?.text || "").filter(Boolean).join(" ").trim();
  } catch {
    // ignore
  }
  if (!assistantText) return json(502, { error: "No response text from Gemini" });

  // Sanitize text for TTS only (strip markdown for voice)
  const sanitizedTextForTTS = sanitizePlainText(assistantText) || assistantText;

  // Usage metadata (if present)
  const usage = {
    total_tokens: data?.usageMetadata?.totalTokenCount ?? null,
    input_tokens: data?.usageMetadata?.promptTokenCount ?? null,
    output_tokens: data?.usageMetadata?.candidatesTokenCount ?? null,
    cached_tokens: data?.usageMetadata?.cachedContentTokenCount ?? null
  };

  // Increment turn count
  const newTurnCount = currentTurnCount + 1;

  // Update conversation metadata (fire-and-forget)
  supabase
    .from("conversations")
    .update({ turn_count: newTurnCount })
    .eq("id", chat_id)
    .then(() => console.log(`[llm-handler-gemini] 📊 Turn count updated: ${newTurnCount}`))
    .catch((e) => console.error("[llm-handler-gemini] ❌ Failed to update turn count:", e));

  // Check if summary should be generated
  if (newTurnCount > 0 && newTurnCount % SUMMARY_INTERVAL === 0 && newTurnCount > lastSummaryTurn) {
    console.log(`[llm-handler-gemini] 📝 Triggering summary at turn ${newTurnCount}`);
    triggerSummaryGeneration(chat_id, lastSummaryTurn + 1, newTurnCount);

    // Update last_summary_at_turn (fire-and-forget)
    supabase
      .from("conversations")
      .update({ last_summary_at_turn: newTurnCount })
      .eq("id", chat_id)
      .catch((e) => console.error("[llm-handler-gemini] ❌ Failed to update last_summary_at_turn:", e));
  }

  // Fire-and-forget: TTS (voice only) and save assistant message via chat-send
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
  };

  const assistantClientId = crypto.randomUUID();

  const tasks = [
    fetch(`${SUPABASE_URL}/functions/v1/chat-send`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        chat_id,
        text: assistantText,
        client_msg_id: assistantClientId,
        role: "assistant",
        mode,
        user_id,
        user_name,
        chattype
      })
    })
  ];

  if (chattype === "voice") {
    const selectedVoice = typeof voice === "string" && voice.trim() ? voice : "Puck";
    tasks.push(
      fetch(`${SUPABASE_URL}/functions/v1/google-text-to-speech`, {
        method: "POST",
        headers,
        body: JSON.stringify({ text: sanitizedTextForTTS, voice: selectedVoice, chat_id })
      })
    );
  }

  Promise.allSettled(tasks).catch(() => { });

  const totalLatencyMs = Date.now() - startedAt;
  console.log(`[llm-handler-gemini] ⏱️  Returning response (+${Date.now() - totalStartTime}ms) TOTAL - LLM: ${llmLatencyMs}ms`);

  return json(200, {
    text: assistantText,
    usage,
    llm_latency_ms: llmLatencyMs,
    total_latency_ms: totalLatencyMs
  });
});
