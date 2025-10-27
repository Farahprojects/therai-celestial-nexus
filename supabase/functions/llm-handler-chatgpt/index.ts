// Production-ready, simplified llm-handler-chatgpt
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
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_MODEL = "gpt-4.1";
const OPENAI_TIMEOUT_MS = 30000;

if (!SUPABASE_URL) throw new Error("Missing env: SUPABASE_URL");
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
if (!OPENAI_API_KEY) {
  console.error("[llm-handler-chatgpt] ❌ OPENAI_API_KEY environment variable is not set");
  throw new Error("Missing env: OPENAI_API_KEY");
}

// Log API key info (first/last 4 chars only for security)
console.log("[llm-handler-chatgpt] ✅ API Key loaded:", OPENAI_API_KEY.substring(0, 4) + "..." + OPENAI_API_KEY.substring(OPENAI_API_KEY.length - 4));
console.log("[llm-handler-chatgpt] 📊 Using model:", OPENAI_MODEL);

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
Transform Internal need showing up as external,” and present it in a way that lands personally, not abstractly.
Acknowledge: One-word encourager.

Answer the user's latest message first and fully.
Pull in recent convo context only when it preserves flow or adds nuance.
Use astrodata for insight and signals 

Show one-line "why" tying emotional/psychological pattern back to user when applicable  

Response output:
No labels , human led conversation

Check-in: Close with a simple, open question.`;

Deno.serve(async (req) => {
const totalStartTime = Date.now();
console.log("[llm-handler-chatgpt] ⏱️  Request received");

if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
if (req.method !== "POST") return json(405, { error: "Method not allowed" });

const startedAt = Date.now();

let body;
try {
body = await req.json();
console.log(`[llm-handler-chatgpt] ⏱️  JSON parsed (+${Date.now() - totalStartTime}ms)`);
} catch {
return json(400, { error: "Invalid JSON body" });
}

const { chat_id, text, mode, chattype, voice, user_id, user_name } = body || {};

if (!chat_id || typeof chat_id !== "string") return json(400, { error: "Missing or invalid field: chat_id" });
if (!text || typeof text !== "string") return json(400, { error: "Missing or invalid field: text" });

// Fetch recent messages (history + optional system)
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
  console.log(`[llm-handler-chatgpt] ⏱️  Starting DB fetch for history (+${Date.now() - totalStartTime}ms)`);
  
  // Single query: fetch all messages at once (index handles chat_id + created_at)
  const { data: allMessages, error: fetchError } = await supabase
    .from("messages")
    .select("role, text, created_at")
    .eq("chat_id", chat_id)
    .order("created_at", { ascending: true });

  if (fetchError) {
    console.warn("[llm-handler-chatgpt] messages fetch warning:", fetchError.message);
  }

  // Separate system and history messages in JavaScript
  if (allMessages && Array.isArray(allMessages)) {
    const systemMessages = allMessages.filter((m: any) => m.role === "system");
    const historyMessages = allMessages.filter((m: any) => m.role !== "system");
    
    // Get system text (most recent system message)
    if (systemMessages.length > 0) {
      systemText = String(systemMessages[systemMessages.length - 1].text || "");
    }
    
    // Get history (most recent first, limit to HISTORY_LIMIT)
    history = historyMessages.reverse().slice(0, HISTORY_LIMIT);
  }
  
  console.log(`[llm-handler-chatgpt] ⏱️  DB fetch complete (+${Date.now() - totalStartTime}ms) - Found ${history.length} history messages`);
} catch (e: any) {
  console.warn("[llm-handler-chatgpt] fetch exception:", e?.message || String(e));
}

// Build OpenAI request messages
type OpenAIMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

const messages: OpenAIMessage[] = [];

// Add system message with optional systemText
if (systemText) {
  messages.push({ role: "system", content: `${systemPrompt}\n\n[System Data]\n${systemText}` });
} else {
  messages.push({ role: "system", content: systemPrompt });
}

// Add history messages (oldest first)
for (let i = history.length - 1; i >= 0; i--) {
  const m = history[i];
  const t = typeof m.text === "string" ? m.text.trim() : "";
  if (!t) continue;
  const role = m.role === "assistant" ? "assistant" : "user";
  messages.push({ role, content: t });
}

// Add current user message
messages.push({ role: "user", content: String(text) });

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

const openaiUrl = "https://api.openai.com/v1/chat/completions";
const requestBody = {
  model: OPENAI_MODEL,
  messages,
  temperature: 0.7
};

let llmStartedAt = Date.now();
let data;
try {
console.log(`[llm-handler-chatgpt] ⏱️  Starting OpenAI API call (+${Date.now() - totalStartTime}ms)`, {
  model: OPENAI_MODEL,
  url: openaiUrl,
  chat_id: chat_id
});

const resp = await fetch(openaiUrl, {
method: "POST",
headers: { 
  "Content-Type": "application/json", 
  "Authorization": `Bearer ${OPENAI_API_KEY}` 
},
body: JSON.stringify(requestBody),
signal: controller.signal
});
clearTimeout(timeout);

const openaiLatency = Date.now() - llmStartedAt;
console.log(`[llm-handler-chatgpt] ⏱️  OpenAI API responded (+${Date.now() - totalStartTime}ms) - OpenAI took ${openaiLatency}ms - Status: ${resp.status}`);

if (!resp.ok) {
  const errText = await resp.text().catch(() => "");
  console.error("[llm-handler-chatgpt] ❌ OpenAI API error:", {
    status: resp.status,
    statusText: resp.statusText,
    error: errText
  });
  return json(502, { error: `OpenAI API request failed: ${resp.status} - ${errText}` });
}

data = await resp.json();
console.log("[llm-handler-chatgpt] ✅ OpenAI API success, response time:", Date.now() - llmStartedAt, "ms");
} catch (e) {
clearTimeout(timeout);
console.error("[llm-handler-chatgpt] ❌ OpenAI request exception:", {
  error: (e as any)?.message || String(e),
  name: (e as any)?.name,
  stack: (e as any)?.stack
});
return json(504, { error: `OpenAI request error: ${(e as any)?.message || String(e)}` });
}

const llmLatencyMs = Date.now() - llmStartedAt;

// Extract assistant text
let assistantText = "";
try {
assistantText = data?.choices?.[0]?.message?.content?.trim() || "";
} catch {
// ignore
}
if (!assistantText) return json(502, { error: "No response text from OpenAI" });

// Sanitize text for TTS only (strip markdown for voice)
const sanitizedTextForTTS = sanitizePlainText(assistantText) || assistantText;

// Usage metadata (if present)
const usage = {
total_tokens: data?.usage?.total_tokens ?? null,
input_tokens: data?.usage?.prompt_tokens ?? null,
output_tokens: data?.usage?.completion_tokens ?? null
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
text: assistantText, // Save raw markdown to DB for formatted display
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
body: JSON.stringify({ text: sanitizedTextForTTS, voice: selectedVoice, chat_id }) // Sanitized for TTS
})
);
}

Promise.allSettled(tasks).catch(() => {});

const totalLatencyMs = Date.now() - startedAt;
console.log(`[llm-handler-chatgpt] ⏱️  Returning response (+${Date.now() - totalStartTime}ms) TOTAL - LLM: ${llmLatencyMs}ms`);

return json(200, {
text: assistantText, // Return raw markdown to client
usage,
llm_latency_ms: llmLatencyMs,
total_latency_ms: totalLatencyMs
});
});
