// Production-ready, simplified llm-handler-gemini
// - Uses Deno.serve (no std/http)
// - Validates inputs, consistent CORS + JSON responses
// - Minimal logs, clear flow, graceful fallbacks
// - Fire-and-forget for TTS and chat-send

// Deno runtime types (available in Deno environment)
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

if (!SUPABASE_URL) throw new Error("Missing env: SUPABASE_URL");
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
if (!GOOGLE_API_KEY) {
  console.error("[llm-handler-gemini] ❌ GOOGLE-LLM-NEW environment variable is not set");
  throw new Error("Missing env: GOOGLE-LLM-NEW");
}

// Log API key info (first/last 4 chars only for security)
console.log("[llm-handler-gemini] ✅ API Key loaded:", GOOGLE_API_KEY.substring(0, 4) + "..." + GOOGLE_API_KEY.substring(GOOGLE_API_KEY.length - 4));
console.log("[llm-handler-gemini] 📊 Using model:", GEMINI_MODEL);

// Supabase client (module scope)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

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

const systemPrompt = `You are an AI guide for self-awareness.
Tone:
– Direct, a bit playful. Contractions welcome, dated slang not.

Lead with Human-centric translation and behavioral resonance, not planets or metaphors
Astro jargon not, just the translation in emotional/ meaning
Response Logic:
Keep tight and easy to digest 
Acknowledge: One-word encourager.

Answer the user’s latest message first and fully.
Pull in recent convo context only when it preserves flow or adds nuance.
Use astrodata for insight and signals 

Show one-line "why" tying emotional/psychological pattern back to user when applicable  

Response output:
No labels , human led conversation

Check-in: Close with a simple, open question.`;

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

// Fetch recent messages (history + optional system)
// ⚡ OPTIMIZATION: Parallel fetch of system messages and history
const HISTORY_LIMIT = 6;

// Type for message data from DB
type MessageRow = {
  role: string;
  text: string;
  created_at: string;
};

let systemText = "";
let history: MessageRow[] = [];

try {
  // ⚡ PARALLEL FETCH: System messages and history in parallel (~50-100ms saved)
  console.log(`[llm-handler-gemini] ⏱️  Starting DB fetch for history (+${Date.now() - totalStartTime}ms)`);
  const [systemResult, historyResult] = await Promise.all([
    // Fetch system messages (context-injected, ordered oldest first)
    supabase
      .from("messages")
      .select("role, text, created_at")
      .eq("chat_id", chat_id)
      .eq("role", "system")
      .eq("status", "complete")
      .not("text", "is", null)
      .neq("text", "")
      .order("created_at", { ascending: true })
      .limit(1),
    
    // Fetch recent non-system messages for history
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

  // Extract system text
  if (systemResult.data && systemResult.data.length > 0) {
    systemText = String(systemResult.data[0].text || "");
  } else if (systemResult.error) {
    console.warn("[llm] system messages fetch warning:", systemResult.error.message);
  }

  // Extract history
  if (historyResult.data) {
    history = historyResult.data as MessageRow[];
  } else if (historyResult.error) {
    console.warn("[llm] history fetch warning:", historyResult.error.message);
  }
  console.log(`[llm-handler-gemini] ⏱️  DB fetch complete (+${Date.now() - totalStartTime}ms) - Found ${history.length} history messages`);
} catch (e: any) {
  console.warn("[llm] parallel fetch exception:", e?.message || String(e));
}

// Build Gemini request contents (oldest -> newest)
type GeminiContent = {
  role: "user" | "model";
  parts: { text: string }[];
};

const contents: GeminiContent[] = [];
for (let i = history.length - 1; i >= 0; i--) {
const m = history[i];
const t = typeof m.text === "string" ? m.text.trim() : "";
if (!t) continue;
contents.push({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: t }] });
}
contents.push({ role: "user", parts: [{ text: String(text) }] });

const combinedSystemInstruction = systemText ? `${systemPrompt}\n\n[System Data]\n${systemText}` : systemPrompt;

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const requestBody = {
  system_instruction: { role: "system", parts: [{ text: combinedSystemInstruction }] },
  contents,
  generationConfig: { 
    temperature: 0.7,
    thinkingConfig: {
      thinkingBudget: 0
    }
  }
};

let llmStartedAt = Date.now();
let data;
try {
console.log(`[llm-handler-gemini] ⏱️  Starting Gemini API call (+${Date.now() - totalStartTime}ms)`, {
  model: GEMINI_MODEL,
  url: geminiUrl,
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
  name: (e as any)?.name,
  stack: (e as any)?.stack
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
output_tokens: data?.usageMetadata?.candidatesTokenCount ?? null
};

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
text: assistantText, // ⚡ Save raw markdown to DB for formatted display
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
body: JSON.stringify({ text: sanitizedTextForTTS, voice: selectedVoice, chat_id }) // ⚡ Sanitized for TTS
})
);
}

Promise.allSettled(tasks).catch(() => {});

const totalLatencyMs = Date.now() - startedAt;
console.log(`[llm-handler-gemini] ⏱️  Returning response (+${Date.now() - totalStartTime}ms) TOTAL - LLM: ${llmLatencyMs}ms`);

return json(200, {
text: assistantText, // ⚡ Return raw markdown to client
usage,
llm_latency_ms: llmLatencyMs,
total_latency_ms: totalLatencyMs
});
});
