import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { incrementFeatureUsage } from "../_shared/featureGating.ts";

const GOOGLE_TTS_API_KEY = Deno.env.get("GOOGLE-TTS-NEW");
if (!GOOGLE_TTS_API_KEY) {
  throw new Error("Missing env: GOOGLE-TTS-NEW");
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CORS_HEADERS = {
"Access-Control-Allow-Origin": "*",
"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
"Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Estimate TTS duration from text (simple and elegant)
// Average speech rate: ~150 words/min = 2.5 words/sec
function estimateTTSDuration(text: string): number {
  const wordCount = text.trim().split(/\s+/).length;
  const durationSeconds = Math.ceil(wordCount / 2.5);
  return Math.max(1, durationSeconds); // Minimum 1 second
}

// Simple in-memory cache (no DB) to reduce repeat TTS calls
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_MAX_ITEMS = 100;

type CacheEntry = { base64: string; expires: number };
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<string>>();

function cacheKey(text: string, voiceName: string) {
return `${voiceName}::${text}`;
}
function getFromCache(key: string): string | undefined {
const entry = cache.get(key);
if (!entry) return;
if (entry.expires < Date.now()) {
cache.delete(key);
return;
}
  return entry.base64;
}
function setCache(key: string, base64: string) {
  cache.set(key, { base64, expires: Date.now() + CACHE_TTL_MS });
if (cache.size > CACHE_MAX_ITEMS) {
// drop oldest
const oldest = [...cache.entries()].sort((a, b) => a[1].expires - b[1].expires);
const drop = oldest.length - CACHE_MAX_ITEMS;
for (let i = 0; i < drop; i++) cache.delete(oldest[i][0]);
}
}

async function synthesizeMP3(text: string, voiceName: string, signal?: AbortSignal): Promise<string> {
  const ttsStartTime = Date.now();
  console.log(`[google-tts] ⏱️ Starting Google TTS API call`);
  
  const resp = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_API_KEY}`,
{
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
input: { text },
voice: { languageCode: "en-US", name: voiceName },
audioConfig: { audioEncoding: "MP3" },
}),
signal,
}
);

  console.log(`[google-tts] ⏱️ Google TTS API responded in ${Date.now() - ttsStartTime}ms - Status: ${resp.status}`);

if (!resp.ok) {
const errText = await resp.text().catch(() => "");
throw new Error(`Google TTS API error (${resp.status}): ${errText}`);
}

const json = await resp.json();
if (!json?.audioContent) {
throw new Error("Google TTS API returned no audioContent");
}

  console.log(`[google-tts] ⏱️ Total TTS processing: ${Date.now() - ttsStartTime}ms`);
  // Return base64 string directly (no decode on server)
  return json.audioContent as string;
}

function fireAndForget(p: Promise<unknown>) {
try {
// If EdgeRuntime.waitUntil exists, use it. Otherwise just start promise.
const maybeEdge = (globalThis as any).EdgeRuntime;
if (maybeEdge && typeof maybeEdge.waitUntil === "function") {
maybeEdge.waitUntil(p);
} else {
// Best-effort fire-and-forget
p.catch((e: unknown) => console.error("[google-tts] async error:", e));
}
} catch {
// ignore
}
}

Deno.serve(async (req) => {
const startTime = Date.now();

console.log('[google-tts] 🚀 FIRST: Function started - processing TTS request');

if (req.method === "OPTIONS") {
return new Response(null, { status: 204, headers: CORS_HEADERS });
}

try {
const body = await req.json();
console.log('[google-tts] 📦 RAW PAYLOAD:', JSON.stringify(body, null, 2));

const { chat_id, text, voice, user_id } = body;

if (!chat_id || !text) {
  throw new Error("Missing 'chat_id' or 'text' in request body.");
}
if (!voice) {
  throw new Error("Voice parameter is required - no fallback allowed");
}

const voiceName = `en-US-Chirp3-HD-${voice}`;

console.log(`[google-tts] 📝 Text length: ${text.length} chars, Voice: ${voiceName}`);

// Estimate TTS duration from text (simple and elegant - source of truth)
const estimatedDuration = estimateTTSDuration(text);

// cache + inflight de-dup
const key = cacheKey(text, voiceName);
let audioBase64 = getFromCache(key);
if (!audioBase64) {
  console.log('[google-tts] 💾 Cache MISS - calling Google TTS API');
  let pending = inflight.get(key);
  if (!pending) {
    // Optional: timeout to avoid hanging requests
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000); // 25s (increased from 15s)
    pending = synthesizeMP3(text, voiceName, controller.signal)
      .finally(() => {
        clearTimeout(timeout);
        inflight.delete(key);
      });
    inflight.set(key, pending);
  } else {
    console.log('[google-tts] ⏳ Request already in-flight, waiting...');
  }
  audioBase64 = await pending;
  setCache(key, audioBase64);
} else {
  console.log('[google-tts] ✅ Cache HIT - returning cached audio');
}

const processingTime = Date.now() - startTime;

// Track TTS usage (fire-and-forget, don't block response)
if (user_id && estimatedDuration > 0) {
  incrementFeatureUsage(supabase, user_id, 'voice_seconds', estimatedDuration)
    .catch(err => console.error("[google-tts] Failed to track TTS usage:", err));
  console.log(`[google-tts] Tracked ${estimatedDuration}s of TTS usage for user ${user_id}`);
}

// Fire-and-forget HTTP broadcast (explicit REST API delivery)
const channel = supabase.channel(`conversation:${chat_id}`);
fireAndForget(
  channel.send({
      type: "broadcast",
      event: "tts-ready",
      payload: {
        audioBase64: audioBase64, // base64 MP3 data
        audioUrl: null, // no storage
        text,
        chat_id,
        mimeType: "audio/mpeg",
      },
    }, { httpSend: true })
    .then((response) => {
      if (response === 'ok') {
        console.log("[google-tts] Broadcast successful");
      }
      // Clean up channel
      channel.unsubscribe();
    })
    .catch((e: unknown) => {
      console.error("[google-tts] Broadcast error:", e);
      channel.unsubscribe();
    })
);

// Minimal response
const responseData = { success: true, audioUrl: null, storagePath: null };
console.log('[google-tts] ✅ LAST: Function completed - returning response with TTS audio broadcast');
return new Response(JSON.stringify(responseData), {
  headers: {
    ...CORS_HEADERS,
    "Content-Type": "application/json",
    "Server-Timing": `tts;dur=${processingTime}`,
  },
});
} catch (error: any) {
console.error("[google-tts] Error:", error);
return new Response(
JSON.stringify({ error: error?.message ?? String(error) }),
{ status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
);
}
});
