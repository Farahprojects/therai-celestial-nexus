// @ts-nocheck - Deno runtime, types checked at deployment
// Simplified, production-ready Google STT edge function
// - Uses Deno.serve (no std/http import)
// - Validates inputs, consistent CORS + JSON responses
// - Minimal helpers, clear flow
// - Fire-and-forget internal calls guarded by env checks
// - Dynamically routes to correct LLM handler based on system config
// - Feature gating for voice usage limits

import { getLLMHandler } from "../_shared/llmConfig.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkLimit, incrementUsage } from "../_shared/limitChecker.ts";

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

// # deployment-note: non-functional comment to trigger redeploy

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

async function transcribeWithGoogle({
  apiKey,
  audioBytes,
  mimeType,
  languageCode
}: {
  apiKey: string;
  audioBytes: Uint8Array;
  mimeType: string;
  languageCode: string;
}): Promise<{ transcript: string; durationSeconds: number }> {
  const encodingInfo = mapMimeToGoogleEncoding(mimeType) as {
    encoding: string;
    sampleRateHertz?: number;
  };
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

  // Extract duration from Google's response (source of truth)
  let durationSeconds = 0;
  if (result.totalBilledTime) {
    const match = result.totalBilledTime.match(/(\d+(?:\.\d+)?)/);
    durationSeconds = match ? Math.ceil(parseFloat(match[1])) : 0;
  } else if (Array.isArray(result.results) && result.results[0]?.resultEndTime) {
    const match = result.results[0].resultEndTime.match(/(\d+(?:\.\d+)?)/);
    durationSeconds = match ? Math.ceil(parseFloat(match[1])) : 0;
  }

  return { transcript: transcript || "", durationSeconds };
}

async function runVoiceFlow({
  chatId,
  chattype,
  transcript,
  mode,
  voice,
  userId,
  userName
}: {
  chatId: string;
  chattype: string;
  transcript: string;
  mode: string;
  voice?: string;
  userId?: string;
  userName?: string;
}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("[google-stt] Voice actions skipped: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return;
  }

  try {
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });

    const { data: conv, error: convError } = await supabaseClient
      .from("conversations")
      .select("mode")
      .eq("id", chatId)
      .single();

    if (convError) {
      console.error(JSON.stringify({
        event: "conversation_lookup_failed",
        chat_id: chatId,
        error: convError.message
      }));
    }

    const conversationMode = conv?.mode || "chat";

    if (conversationMode === "together") {
      console.info(JSON.stringify({
        event: "stt_together_mode_skip_llm",
        chat_id: chatId,
        conversation_mode: conversationMode,
        note: "Together mode - skipping LLM handler for peer-to-peer chat"
      }));
      return;
    }

    const internalApiKey = Deno.env.get("INTERNAL_API_KEY") || "";
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "x-internal-key": internalApiKey
    };

    console.info(JSON.stringify({
      event: "preparing_internal_calls",
      has_internal_api_key: !!internalApiKey,
      internal_key_length: internalApiKey.length
    }));

    const llmHandler = await getLLMHandler(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    console.log(`[google-stt] Using ${llmHandler} for voice mode`);

    const payload = {
      chat_id: chatId,
      text: transcript,
      chattype,
      mode,
      voice,
      user_id: userId,
      user_name: userName,
      source: "google-whisper"
    };

    console.info(JSON.stringify({
      event: "calling_llm_handler_with_payload",
      chat_id: chatId,
      chattype,
      text_length: transcript.length,
      payload_preview: {
        ...payload,
        text: transcript.substring(0, 50) + (transcript.length > 50 ? "..." : "")
      }
    }));

    const response = await fetch(`${SUPABASE_URL}/functions/v1/${llmHandler}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      let body: any = text;
      try {
        body = JSON.parse(text);
      } catch (_) {
        body = text?.substring(0, 200) ?? "";
      }

      console.error(JSON.stringify({
        event: "llm_handler_failed",
        status: response.status,
        error: body
      }));
    }
  } catch (err) {
    console.error(JSON.stringify({
      event: "voice_flow_exception",
      error: err instanceof Error ? err.message : String(err)
    }));
  }
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
    const user_id = form.get("user_id");
    const user_name = form.get("user_name") || undefined;

    console.info(JSON.stringify({
      event: "form_data_received",
      chattype,
      chattype_type: typeof chattype,
      user_id,
      user_id_type: typeof user_id,
      mode
    }));

    let authenticatedUserId = typeof user_id === "string" ? user_id : undefined;
    const userIdForVoiceFlow = typeof user_id === "string" ? user_id : undefined;
    const userNameForVoiceFlow = typeof user_name === "string" ? user_name : undefined;

    if (!(file instanceof File)) return json(400, { error: "Missing file in form-data" });
    if (!mode || typeof mode !== "string") return json(400, { error: "Missing or invalid field: mode" });

    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = new Uint8Array(arrayBuffer);
    const mimeType = file.type || "audio/webm";

    if (!audioBuffer.length) return json(400, { error: "Empty audio data" });

    // Create Supabase client at request level (needed for feature checks and JWT verification)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });

    // Get authenticated user ID from JWT (more secure than form data)
    const authHeader = req.headers.get("Authorization");
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

    // 🔒 PRE-TRANSCRIPTION CHECK: Block if user has exceeded voice limit
    if (authenticatedUserId) {
      const limitCheck = await checkLimit(supabase, authenticatedUserId, 'voice_seconds', 0);

      console.info(JSON.stringify({
        event: "voice_limit_pre_check",
        user_id: authenticatedUserId,
        allowed: limitCheck.allowed,
        current_usage: limitCheck.current_usage,
        remaining: limitCheck.remaining,
        limit: limitCheck.limit,
        is_unlimited: limitCheck.is_unlimited,
        reason: limitCheck.reason
      }));

      if (!limitCheck.allowed) {
        console.warn(JSON.stringify({
          event: "usage_limit_exceeded_pre_transcription",
          reason: limitCheck.reason,
          user_id: authenticatedUserId,
          current_usage: limitCheck.current_usage,
          limit: limitCheck.limit
        }));

        const limitMinutes = limitCheck.limit ? Math.floor(limitCheck.limit / 60) : 0;
        const message = limitCheck.limit === 120 
          ? "You've used your 2 minutes of free voice transcription. Subscribe to get 10 minutes/month with Growth or unlimited with Premium."
          : `You've used your ${limitMinutes} minutes of voice for this month. Upgrade to Premium for unlimited voice features.`;
        
        return json(200, {
          success: false,
          code: "STT_LIMIT_EXCEEDED",
          message,
          current_usage: limitCheck.current_usage,
          limit: limitCheck.limit,
          remaining: limitCheck.remaining,
          transcript: ""
        });
      }
    }

    const languageCode = normalizeLanguageCode(String(language));
    const { transcript, durationSeconds } = await transcribeWithGoogle({
      apiKey: GOOGLE_STT,
      audioBytes: audioBuffer,
      mimeType,
      languageCode
    });

    console.info(JSON.stringify({
      event: "transcription_complete",
      transcript_length: transcript.length,
      duration_seconds: durationSeconds,
      user_id: authenticatedUserId,
      chattype,
      condition_check: {
        chattype_is_voice: chattype === "voice",
        has_authenticatedUserId: !!authenticatedUserId,
        duration_seconds_gt_zero: durationSeconds > 0,
        will_track: chattype === "voice" && authenticatedUserId && durationSeconds > 0
      }
    }));

    if (!transcript.trim()) {
      console.info(JSON.stringify({ event: "empty_transcript_returning" }));
      await new Promise((r) => setTimeout(r, 50));
      return json(200, { success: true, transcript: "" });
    }

    // Track voice usage after successful transcription using Google's duration (source of truth)
    if (authenticatedUserId && durationSeconds > 0) {
      console.info(JSON.stringify({
        event: "tracking_voice_usage",
        user_id: authenticatedUserId,
        duration_seconds: durationSeconds
      }));

      // ✅ NEW PRO WAY: Check limit one more time (defense in depth)
      const postCheck = await checkLimit(supabase, authenticatedUserId, 'voice_seconds', durationSeconds);

      if (!postCheck.allowed) {
        console.warn(JSON.stringify({
          event: "usage_limit_exceeded_post_transcription",
          reason: postCheck.reason,
          user_id: authenticatedUserId,
          current_usage: postCheck.current_usage,
          requested_duration: durationSeconds,
          limit: postCheck.limit
        }));

        const limitMinutes = postCheck.limit ? Math.floor(postCheck.limit / 60) : 0;
        const message = postCheck.limit === 120 
          ? "You've used your 2 minutes of free voice transcription. Subscribe to get 10 minutes/month with Growth or unlimited with Premium."
          : `You've used your ${limitMinutes} minutes of voice for this month. Upgrade to Premium for unlimited voice features.`;
        
        return json(200, {
          success: false,
          code: "STT_LIMIT_EXCEEDED",
          message,
          current_usage: postCheck.current_usage,
          limit: postCheck.limit,
          remaining: postCheck.remaining,
          transcript: ""
        });
      }

      // ✅ NEW PRO WAY: Increment usage directly (no edge function call)
      console.info(JSON.stringify({
        event: "incrementing_voice_usage",
        user_id: authenticatedUserId,
        feature_type: "voice_seconds",
        amount: durationSeconds,
        is_unlimited: postCheck.is_unlimited
      }));

      const incrementResult = await incrementUsage(supabase, authenticatedUserId, 'voice_seconds', durationSeconds);

      if (!incrementResult.success) {
        console.error(JSON.stringify({
          event: "increment_failed",
          reason: incrementResult.reason,
          user_id: authenticatedUserId
        }));
      } else {
        console.info(JSON.stringify({
          event: "increment_success",
          user_id: authenticatedUserId,
          feature_type: "voice_seconds",
          amount: durationSeconds
        }));
      }
    }

    if (chattype === "voice" && chat_id) {
      console.info(JSON.stringify({
        event: "voice_flow_triggered",
        chattype,
        chattype_type: typeof chattype,
        chat_id,
        transcript_length: transcript.length
      }));

      void runVoiceFlow({
        chatId: String(chat_id),
        chattype: String(chattype),
        transcript,
        mode: String(mode),
        voice: typeof voice === "string" ? voice : undefined,
        userId: userIdForVoiceFlow,
        userName: userNameForVoiceFlow
      });
    } else {
      console.info(JSON.stringify({
        event: "voice_flow_skipped",
        chattype,
        chattype_type: typeof chattype,
        chat_id: chat_id || "missing",
        reason: !chattype
          ? "no_chattype"
          : chattype !== "voice"
          ? "chattype_not_voice"
          : "no_chat_id"
      }));
    }

    await new Promise((r) => setTimeout(r, 50));

    return json(200, {
      success: true,
      transcript
    });
  } catch (err) {
    console.error("[google-stt] Error:", err);
    return json(200, {
      success: false,
      code: "SERVER_ERROR",
      message: (err as any)?.message || "Unknown error occurred",
      transcript: ""
    });
  }
});

