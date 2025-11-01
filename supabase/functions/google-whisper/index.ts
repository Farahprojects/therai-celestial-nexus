// Simplified, production-ready Google STT edge function
// - Uses Deno.serve (no std/http import)
// - Validates inputs, consistent CORS + JSON responses
// - Minimal helpers, clear flow
// - Fire-and-forget internal calls guarded by env checks
// - Dynamically routes to correct LLM handler based on system config
// - Feature gating for voice usage limits

import { getLLMHandler } from "../_shared/llmConfig.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkFeatureAccess, incrementFeatureUsage } from "../_shared/featureGating.ts";

const corsHeaders = {
"Access-Control-Allow-Origin": "*",
"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
"Access-Control-Allow-Methods": "POST, OPTIONS",
"Vary": "Origin"
};

// Env (fail fast for STT key; Supabase vars are optional depending on voice flow)
const GOOGLE_STT = Deno.env.get("GOOGLE-STT-NEW");
if (!GOOGLE_STT) throw new Error("Missing env: GOOGLE-STT-NEW");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const json = (status: number, data: any) =>
new Response(JSON.stringify(data), {
status,
headers: { ...corsHeaders, "Content-Type": "application/json" }
});

function mapMimeToGoogleEncoding(mimeType = "") {
const lower = mimeType.toLowerCase();
if (lower.includes("webm")) return { encoding: "WEBM_OPUS" };
if (lower.includes("ogg")) return { encoding: "OGG_OPUS" };
if (lower.includes("wav")) return { encoding: "LINEAR16" };
if (lower.includes("mp3")) return { encoding: "MP3" };
return { encoding: "ENCODING_UNSPECIFIED" };
}

function normalizeLanguageCode(language: string) {
if (!language) return "en-US";
const lower = String(language).toLowerCase();
if (lower === "en") return "en-US";
return language;
}

// Encode Uint8Array to base64 safely in chunks
function base64EncodeUint8(bytes: Uint8Array) {
let binary = "";
const chunkSize = 8192;
for (let i = 0; i < bytes.length; i += chunkSize) {
const sub = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
let chunkStr = "";
for (let j = 0; j < sub.length; j++) chunkStr += String.fromCharCode(sub[j]);
binary += chunkStr;
}
return btoa(binary);
}

async function transcribeWithGoogle({ apiKey, audioBytes, mimeType, languageCode }: { 
  apiKey: string; 
  audioBytes: Uint8Array; 
  mimeType: string; 
  languageCode: string 
}) {
const encodingInfo = mapMimeToGoogleEncoding(mimeType) as { encoding: string; sampleRateHertz?: number };
const audioContent = base64EncodeUint8(audioBytes);

const config: any = {
encoding: encodingInfo.encoding,
languageCode,
enableAutomaticPunctuation: true,
...(encodingInfo.sampleRateHertz ? { sampleRateHertz: encodingInfo.sampleRateHertz } : {})
};

const resp = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ config, audio: { content: audioContent } })
});

if (!resp.ok) {
const errorText = await resp.text().catch(() => "");
throw new Error(`Google STT error: ${resp.status} - ${errorText}`);
}

const result = await resp.json();
const transcript = Array.isArray(result.results)
? result.results
.flatMap((r: any) => (Array.isArray(r.alternatives) ? r.alternatives : []))
.map((a: any) => a?.transcript || "")
.filter((t: any) => t && t.trim().length > 0)
.join(" ")
: "";

return transcript || "";
}

Deno.serve(async (req) => {
if (req.method === "OPTIONS") {
return new Response("ok", { headers: corsHeaders });
}
if (req.method !== "POST") {
return json(405, { error: "Method not allowed" });
}

try {
// Warmup ping
if (req.headers.get("X-Warmup") === "1") {
return json(200, { status: "warmed up" });
}

const form = await req.formData().catch(() => null);
if (!form) return json(400, { error: "Expected multipart/form-data" });

const file = form.get("file");
const chat_id = form.get("chat_id") || undefined;
const chattype = form.get("chattype") || undefined;
const mode = form.get("mode");
const language = form.get("language") || "en";
const voice = form.get("voice") || undefined;
const user_id = form.get("user_id") || undefined;
const user_name = form.get("user_name") || undefined;

if (!(file instanceof File)) return json(400, { error: "Missing file in form-data" });
if (!mode || typeof mode !== "string") return json(400, { error: "Missing or invalid field: mode" });

const arrayBuffer = await file.arrayBuffer();
const audioBuffer = new Uint8Array(arrayBuffer);
const mimeType = file.type || "audio/webm";

if (!audioBuffer.length) return json(400, { error: "Empty audio data" });

// Feature gating: Check voice usage limits for voice chattype
if (chattype === "voice") {
  // Create Supabase client for feature checks
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });

  // Get authenticated user ID from JWT (more secure than form data)
  const authHeader = req.headers.get("Authorization");
  let authenticatedUserId = user_id;
  
  if (authHeader) {
    try {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error: authError } = await supabase.auth.getUser(token);
      if (!authError && userData?.user) {
        authenticatedUserId = userData.user.id;
      }
    } catch (authErr) {
      console.error("[google-whisper] Auth verification failed:", authErr);
    }
  }

  if (authenticatedUserId) {
    // Calculate audio duration in seconds from WAV buffer
    // WAV format: 44-byte header + PCM data (16-bit samples = 2 bytes per sample)
    // Duration = (buffer_size - 44) / 2 / sample_rate
    // We know the client sends 16kHz mono WAV
    const estimatedSeconds = Math.ceil((audioBuffer.length - 44) / 2 / 16000);
    
    // Check if user has enough voice seconds remaining
    const accessCheck = await checkFeatureAccess(
      supabase,
      authenticatedUserId,
      'voice_seconds',
      estimatedSeconds
    );

    if (!accessCheck.allowed) {
      return json(403, {
        error: accessCheck.reason || "Voice usage limit reached",
        remaining: accessCheck.remaining,
        limit: accessCheck.limit,
        feature: "voice_seconds"
      });
    }

    console.log(`[google-whisper] Voice access granted. Remaining: ${accessCheck.remaining}, estimated seconds: ${estimatedSeconds}`);
  }
}

const languageCode = normalizeLanguageCode(String(language));
const transcript = await transcribeWithGoogle({
  apiKey: GOOGLE_STT,
  audioBytes: audioBuffer,
  mimeType,
  languageCode
});

if (!transcript.trim()) {
  return json(200, { transcript: "" });
}

// Track voice usage after successful transcription
if (chattype === "voice" && user_id) {
  // Create Supabase client for usage tracking
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });

  // Get authenticated user ID
  const authHeader = req.headers.get("Authorization");
  let authenticatedUserId = user_id;
  
  if (authHeader) {
    try {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error: authError } = await supabase.auth.getUser(token);
      if (!authError && userData?.user) {
        authenticatedUserId = userData.user.id;
      }
    } catch (authErr) {
      console.error("[google-whisper] Auth verification failed for tracking:", authErr);
    }
  }

  if (authenticatedUserId) {
    // Calculate actual audio duration from WAV buffer
    // WAV format: 44-byte header + PCM data (16-bit samples = 2 bytes per sample)
    const actualSeconds = Math.ceil((audioBuffer.length - 44) / 2 / 16000);
    
    // Increment usage counter (fire-and-forget, don't block response)
    incrementFeatureUsage(supabase, authenticatedUserId, 'voice_seconds', actualSeconds)
      .catch(err => console.error("[google-whisper] Failed to track usage:", err));
    
    console.log(`[google-whisper] Tracked ${actualSeconds}s of voice usage for user ${authenticatedUserId}`);
  }
}

// Voice flow: optionally save user message, call LLM, and broadcast
if (chattype === "voice" && chat_id) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("[google-stt] Voice actions skipped: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  } else {
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    };

    // Get configured LLM handler, then fire-and-forget tasks
    getLLMHandler(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).then((llmHandler) => {
      console.log(`[google-stt] Using ${llmHandler} for voice mode`);
      
      const tasks = [
        fetch(`${SUPABASE_URL}/functions/v1/chat-send`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            chat_id,
            text: transcript,
            client_msg_id: crypto.randomUUID(),
            chattype: "voice",
            mode,
            user_id,
            user_name
          })
        }),
        fetch(`${SUPABASE_URL}/functions/v1/${llmHandler}`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            chat_id,
            text: transcript,
            chattype: "voice",
            mode,
            voice,
            user_id,
            user_name
          })
        }),
        fetch(`${SUPABASE_URL}/functions/v1/broadcast`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            channel: `conversation:${chat_id}`,
            event: "thinking-mode",
            payload: { transcript }
          })
        })
      ];

      // Start without awaiting to keep response snappy
      Promise.allSettled(tasks).catch(() => {});
    }).catch((err) => {
      console.error("[google-stt] Failed to determine LLM handler:", err);
    });
  }
}

return json(200, { transcript });
} catch (err) {
console.error("[google-stt] Error:", err);
return json(500, { error: (err as any)?.message || "Unknown error" });
}
});
