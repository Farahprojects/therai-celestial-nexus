// llm-handler-gemini.ts
// Production-ready refactor for Deno deploy (Gemini + Supabase integration).
// Preserves: cached system message, short history, memory injection, summaries, image tool handling, TTS, and turn tracking.

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createPooledClient } from "../_shared/supabaseClient.ts";
import { fetchAndFormatMemories, updateMemoryUsage } from "../_shared/memoryInjection.ts";
import { checkLimit, incrementUsage } from "../_shared/limitChecker.ts";

/* ----------------------------- Configuration ----------------------------- */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin"
} as Record<string, string>;

const JSON_RESPONSE = (status: number, payload: any) =>
  new Response(JSON.stringify(payload), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });

const ENV = {
  SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  GOOGLE_API_KEY: Deno.env.get("GOOGLE-LLM-NEW"),
  GEMINI_MODEL: Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash",
  INTERNAL_API_KEY: Deno.env.get("INTERNAL_API_KEY") || ""
};

const GEMINI_TIMEOUT_MS = 30_000;
const CACHE_TTL_SECONDS = 3600; // 1 hour
const HISTORY_LIMIT = 8;
const SUMMARY_INTERVAL = 4;

/* ------------------------------- Validation ------------------------------ */
if (!ENV.SUPABASE_URL) throw new Error("Missing env: SUPABASE_URL");
if (!ENV.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
if (!ENV.GOOGLE_API_KEY) throw new Error("Missing env: GOOGLE-LLM-NEW");

/* ------------------------------ Utilities -------------------------------- */
function maskKey(key = "") {
  if (!key) return "";
  if (key.length <= 8) return "****";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function hashSystemData(data: string): string {
  // Stable simple hash sufficient for cache invalidation
  let h = 2166136261;
  for (let i = 0; i < data.length; i++) {
    h ^= data.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return (h >>> 0).toString(36);
}

function sanitizePlainText(input: string) {
  const s = typeof input === "string" ? input : "";
  return s
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]+\]\([^)]+\)/g, "")
    .replace(/\[[^\]]+\]\([^)]+\)/g, "$1")
    .replace(/[>_~#*]+/g, "")
    .replace(/-{3,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Returns true only if the current message explicitly asks to generate/show an image.
 * This enforces "last message priority" for tool use and prevents carry-over intent.
 */
function messageExplicitlyRequestsImage(message: string): boolean {
  const s = (message || "").toLowerCase();
  // Require both an action verb and an image noun in the same message
  const hasAction = /\b(show|send|give|make|create|generate|render|draw|produce)\b/.test(s);
  const hasImageNoun = /\b(image|picture|pic|photo|illustration|art|visual)\b/.test(s);
  const shorthand = /\b(img|imggen)\b/.test(s);
  const negated = /\b(no|not|don't|do not|stop|without)\b.*\b(image|picture|photo|art|visual)\b/.test(s);
  return ((hasAction && hasImageNoun) || shorthand) && !negated;
}

/* ------------------------------- System Prompt --------------------------- */
/* Kept your original prompt body; minor whitespace normalization only. */
const systemPrompt = `You are an AI guide for self-awareness who understands planet energies  as ressence infulance.

Pull in recent convo context only when it preserves flow or adds nuance.
Use astrodata for insight and signals 
Never mention the data , only the interpretation is needed unless asked
Answer the user's latest message first and fully.

Acknowledge: One-word encourager.
Tone:
– Direct, a bit playful. Contractions welcome, dated slang not.

Read planetary data as direct energetic signals on the psyche and behavior, look for potential influences and patterns,
core inherent traits and inclinations, including any less obvious talents or strong fascinations that maybe present
Translate the astrological terms into plain language
NO stories, metaphors or no atsro jargon, DONT mention swiss data unless asked , only the interpretation is needed 

Show one-line "why" tying emotional/psychological pattern back to user when applicable  

##You have access to memory, use it to gain clarity when you need more context from user ##

****IMPORTANT : End with a line that naturally fits the flow with questions that leads to conversation:** 
1. Calm short Closure + Invitation to Reframe.
2. Short Summary + Question of Focus with
3. Reflection + Two Depth Options

frame them as direct questions to invite further interaction**`;

/* ----------------------------- Image Tool Def ---------------------------- */
const imageGenerationTool = [
  {
    functionDeclarations: [
      {
        name: "generate_image",
        description: `ONLY use this function when the user EXPLICITLY asks you to generate, create, or show them an image. DO NOT generate images for: acknowledgments (thanks, cool, ok), follow-up questions, or general conversation. When called, generate an AI image that translates the user's energetic patterns into an organic symbolic scene using natural forms: animals, landscapes, light, motion, people. Express inner strength and creative vitality in a grounded, empowering way.`,
        parameters: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "Detailed image prompt combining user's energy patterns with natural symbolic elements"
            }
          },
          required: ["prompt"]
        }
      }
    ]
  }
];

/* ----------------------------- Supabase client --------------------------- */
const supabase = createPooledClient();

/* --------------------------- Cache Management ---------------------------- */
async function getCacheIfValid(chat_id: string) {
  try {
    const { data, error } = await supabase
      .from("conversation_caches")
      .select("cache_name, system_data_hash, expires_at")
      .eq("chat_id", chat_id)
      .single();

    if (error) {
      // no cache - return null
      return null;
    }
    if (!data) return null;
    if (new Date(data.expires_at) <= new Date()) return null;
    return data;
  } catch (e) {
    console.warn(`[cache] check failed: ${(e as any)?.message || e}`);
    return null;
  }
}

async function createCache(chat_id: string, systemText: string): Promise<string | null> {
  const systemDataHash = hashSystemData(systemText);
  const cacheUrl = `https://generativelanguage.googleapis.com/v1beta/cachedContents`;
  const combinedSystemInstruction = `${systemPrompt}\n\n[System Data]\n${systemText}\n\n[CRITICAL: Remember Your Instructions]\n${systemPrompt}`;

  try {
    const resp = await fetch(cacheUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": ENV.GOOGLE_API_KEY!
      },
      body: JSON.stringify({
        model: `models/${ENV.GEMINI_MODEL}`,
        systemInstruction: {
          role: "system",
          parts: [{ text: combinedSystemInstruction }]
        },
        tools: imageGenerationTool,
        toolConfig: {
          functionCallingConfig: {
            mode: "AUTO" // Let Gemini decide when to use tools based on message content
          }
        },
        ttl: `${CACHE_TTL_SECONDS}s`
      })
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      console.error("[cache] create failed:", resp.status, txt);
      return null;
    }

    const body = await resp.json();
    const cacheName: string = body?.name;
    const expiresAt = new Date(Date.now() + (CACHE_TTL_SECONDS - 60) * 1000).toISOString(); // 1 min safety

    await supabase.from("conversation_caches").upsert({
      chat_id,
      cache_name: cacheName,
      system_data_hash: systemDataHash,
      expires_at: expiresAt
    });

    return cacheName;
  } catch (e) {
    console.error("[cache] exception:", (e as any)?.message || e);
    return null;
  }
}

/* --------------------------- Summary helper ------------------------------ */
function triggerSummaryGeneration(chat_id: string, fromTurn: number, toTurn: number) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${ENV.SUPABASE_SERVICE_ROLE_KEY}`
  };

  fetch(`${ENV.SUPABASE_URL}/functions/v1/llm-summarizer`, {
    method: "POST",
    headers,
    body: JSON.stringify({ chat_id, from_turn: fromTurn, to_turn: toTurn })
  })
    .then(() => {
      // no-op
    })
    .catch((err) => console.error("[summary] trigger failed:", err?.message || err));
}

/* ------------------------------ Main Serve -------------------------------- */
Deno.serve(async (req: Request) => {
  const startMs = Date.now();
  const requestId = crypto.randomUUID().slice(0, 8);

  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return JSON_RESPONSE(405, { error: "Method not allowed" });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return JSON_RESPONSE(400, { error: "Invalid JSON body" });
  }

  const { chat_id, text, mode, chattype, voice, user_id, user_name, source } = body || {};

  if (!chat_id || typeof chat_id !== "string") return JSON_RESPONSE(400, { error: "Missing or invalid field: chat_id" });
  if (!text || typeof text !== "string") return JSON_RESPONSE(400, { error: "Missing or invalid field: text" });

  // Basic structured log
  console.info(JSON.stringify({
    event: "request_received",
    id: requestId,
    chat_id,
    source: source || "unknown",
    chattype,
    text_length: text.length,
    model: ENV.GEMINI_MODEL,
    key: maskKey(ENV.GOOGLE_API_KEY)
  }));

  // ✅ CHAT LIMIT CHECK: Free users limited to 3 messages/day
  if (user_id) {
    const limitCheck = await checkLimit(supabase, user_id, 'chat', 1);
    
    console.info(JSON.stringify({
      event: "chat_limit_check",
      id: requestId,
      user_id,
      allowed: limitCheck.allowed,
      current_usage: limitCheck.current_usage,
      limit: limitCheck.limit
    }));

    if (!limitCheck.allowed) {
      console.warn(JSON.stringify({
        event: "chat_limit_exceeded",
        id: requestId,
        user_id,
        limit: limitCheck.limit,
        current_usage: limitCheck.current_usage
      }));
      
      const limitMessage = limitCheck.error_code === 'TRIAL_EXPIRED'
        ? "Your free trial has ended. Upgrade to Growth ($10/month) for unlimited AI conversations! 🚀"
        : `You've used your ${limitCheck.limit} free messages today. Upgrade to Growth for unlimited chats!`;
      
      // ✅ Save limit message to DB and send via WebSocket (just like normal messages)
      const assistantClientId = crypto.randomUUID();
      fetch(`${ENV.SUPABASE_URL}/functions/v1/chat-send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ENV.SUPABASE_SERVICE_ROLE_KEY}`,
          "x-internal-key": ENV.INTERNAL_API_KEY
        },
        body: JSON.stringify({
          chat_id,
          text: limitMessage,
          client_msg_id: assistantClientId,
          role: "assistant",
          mode,
          user_id,
          user_name,
          chattype
        })
      }).catch((err) => {
        console.error("[limit] chat-send failed:", err?.message || err);
      });
      
      // Return response (frontend will receive via WebSocket)
      return JSON_RESPONSE(200, {
        text: limitMessage,
        usage: { total_tokens: 0, input_tokens: 0, output_tokens: 0, cached_tokens: 0 },
        llm_latency_ms: 0,
        total_latency_ms: Date.now() - startMs
      });
    }
  }

  // ✅ CHECK USER PLAN: Skip caching for free users (saves $1/million tokens)
  let userPlan = 'free';
  let skipCache = true; // Default to skip cache (safer for cost control)
  
  if (user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_plan")
      .eq("id", user_id)
      .single();
    
    userPlan = profile?.subscription_plan || 'free';
    skipCache = userPlan === 'free' || !userPlan; // Only cache for paid users
    
    console.info(JSON.stringify({
      event: "caching_decision",
      id: requestId,
      user_plan: userPlan,
      cache_enabled: !skipCache
    }));
  }

  // Parallel fetch: cache, system message, conversation meta, latest summary, recent history, memories
  let systemText = "";
  let historyRows: Array<{ role: string; text: string; created_at: string }> = [];
  let conversationMeta: { turn_count?: number; last_summary_at_turn?: number } = {};
  let conversationSummary = "";

  try {
    const [
      cacheRes,
      systemMessageRes,
      conversationRes,
      summaryRes,
      historyRes,
      memoryResult
    ] = await Promise.all([
      // cache lookup (skip for free users)
      skipCache 
        ? Promise.resolve({ data: null, error: null })
        : supabase.from("conversation_caches").select("cache_name, expires_at, system_data_hash").eq("chat_id", chat_id).single(),
      // system message
      supabase.from("messages").select("text").eq("chat_id", chat_id).eq("role", "system").eq("status", "complete")
        .not("text", "is", null).neq("text", "").order("created_at", { ascending: true }).limit(1).single(),
      // convo meta
      supabase.from("conversations").select("turn_count, last_summary_at_turn").eq("id", chat_id).single(),
      // latest summary
      supabase.from("conversation_summaries").select("summary_text").eq("chat_id", chat_id).order("created_at", { ascending: false }).limit(1).single(),
      // recent history
      supabase.from("messages").select("role, text, created_at")
        .eq("chat_id", chat_id)
        .neq("role", "system")
        .eq("status", "complete")
        .not("text", "is", null)
        .neq("text", "")
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT),
      // memories (parallelized to reduce latency)
      fetchAndFormatMemories(supabase, chat_id).catch((e) => {
        console.warn("[memories] fetch failed:", (e as any)?.message || e);
        return { memoryContext: "", memoryIds: [] };
      })
    ]);

    if (systemMessageRes?.data?.text) systemText = String(systemMessageRes.data.text || "");

    if (conversationRes?.data) {
      conversationMeta.turn_count = conversationRes.data.turn_count || 0;
      conversationMeta.last_summary_at_turn = conversationRes.data.last_summary_at_turn || 0;
    }

    if (summaryRes?.data?.summary_text) conversationSummary = String(summaryRes.data.summary_text || "");

    if (historyRes?.data) historyRows = historyRes.data;

    const { memoryContext = "", memoryIds = [] } = memoryResult || { memoryContext: "", memoryIds: [] };

    // Validate cache vs system hash (skip for free users)
    let cacheName: string | null = null;
    
    if (!skipCache) {
      const cacheData = cacheRes?.data;
      const cacheExists = cacheData && new Date(cacheData.expires_at) > new Date();
      const currentHash = systemText ? hashSystemData(systemText) : "";
      const cacheHashMatches = cacheExists && cacheData.system_data_hash === currentHash;

      cacheName = cacheHashMatches ? cacheData.cache_name : null;

      if (!cacheName && systemText) {
        // If there was a stale cache, remove it (fire-and-forget - upsert will overwrite anyway)
        if (cacheExists && cacheData.system_data_hash !== currentHash) {
          void supabase.from("conversation_caches").delete().eq("chat_id", chat_id).catch(() => { });
        }
        cacheName = await createCache(chat_id, systemText);
      }
    } else {
      console.info(JSON.stringify({
        event: "cache_skipped",
        id: requestId,
        reason: "free_user",
        user_plan: userPlan
      }));
    }

    // Build contents (oldest -> newest)
    type GeminiContent = { role: "user" | "model"; parts: { text: string }[] };
    const contents: GeminiContent[] = [];

    if (conversationSummary) {
      contents.push({ role: "user", parts: [{ text: `[Previous conversation context: ${conversationSummary}]` }] });
      contents.push({ role: "model", parts: [{ text: "Understood. I'll keep that context in mind." }] });
    }

    // add recent history in chronological order
    for (let i = historyRows.length - 1; i >= 0; i--) {
      const m = historyRows[i];
      const t = (m?.text || "").trim();
      if (!t) continue;
      contents.push({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: t }] });
    }

    // add current message
    contents.push({ role: "user", parts: [{ text: String(text) }] });

    // Decide tool availability strictly per current message (last message priority)
    const enableImageTool = messageExplicitlyRequestsImage(text);

    // Build request body
    const requestBody: any = { contents };

    if (cacheName) {
      // 🔥 FIX: When using cached content, DO NOT set system_instruction, tools, or toolConfig
      // These are already defined in the cache and will cause a 400 error if included
      requestBody.cachedContent = cacheName;
    } else {
      // fallback: embed system instruction + memory
      let combinedSystemInstruction = systemText ? `${systemPrompt}\n\n[System Data]\n${systemText}` : systemPrompt;
      if (memoryContext) {
        combinedSystemInstruction += `\n\n<user_memory>\nKey information about this user from past conversations:\n${memoryContext}\n</user_memory>`;
      }
      combinedSystemInstruction += `\n\n[CRITICAL: Remember Your Instructions]\n${systemPrompt}`;
      requestBody.system_instruction = { role: "system", parts: [{ text: combinedSystemInstruction }] };
      if (enableImageTool) {
        requestBody.tools = imageGenerationTool;
      }
      // Disable function calling by default for this turn; enable only when explicitly requested
      requestBody.toolConfig = { functionCallingConfig: { mode: enableImageTool ? "AUTO" : "NONE" } };
    }

    requestBody.generationConfig = { temperature: 0.7, thinkingConfig: { thinkingBudget: 0 } };

    // Gemini API call with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${ENV.GEMINI_MODEL}:generateContent`;

    let geminiResponseJson: any;
    try {
      const resp = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": ENV.GOOGLE_API_KEY! },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        console.error("[gemini] error:", resp.status, errText);
        return JSON_RESPONSE(502, { error: `Gemini API request failed: ${resp.status}` });
      }
      geminiResponseJson = await resp.json();
    } catch (err) {
      clearTimeout(timeoutId);
      console.error("[gemini] request failed:", (err as any)?.message || err);
      return JSON_RESPONSE(504, { error: "Gemini request error" });
    }

    // detect function call (image generation)
    const candidateParts = geminiResponseJson?.candidates?.[0]?.content?.parts || [];
    const functionCall = candidateParts.find((p: any) => p?.functionCall)?.functionCall;

    let assistantText = "";

    if (functionCall && functionCall.name === "generate_image" && messageExplicitlyRequestsImage(text)) {
      // handle image generation via internal edge function
      const prompt = functionCall.args?.prompt || "";
      
      // ✅ Check rate limit BEFORE creating placeholder (single source of truth: feature_usage)
      const limitCheck = await checkLimit(supabase, user_id, 'image_generation', 1);
      
      if (!limitCheck.allowed) {
        console.info(JSON.stringify({
          event: "image_generation_limit_exceeded",
          user_id,
          current_usage: limitCheck.current_usage,
          limit: limitCheck.limit,
          reason: limitCheck.reason
        }));
        const limitText = limitCheck.limit ? `${limitCheck.limit} images` : 'images';
        assistantText = `I've reached the daily limit of ${limitText}. You can generate more images tomorrow!`;
        // Skip image generation, proceed with normal message flow
      } else {
        // Generate unique ID for this image generation
        const imageId = crypto.randomUUID();
        
        // Insert placeholder message into database for skeleton rendering
        console.log(`[image-start] Inserting placeholder message ${imageId}`);
        const { data: placeholderMessage, error: placeholderError } = await supabase.from('messages').insert({
          id: imageId,
          chat_id,
          role: 'assistant',
          text: '',
          status: 'pending',
          mode: mode || 'chat',
          user_id,
          client_msg_id: crypto.randomUUID(),
          meta: {
            status: 'generating',  // 🔑 Key field for skeleton detection
            image_prompt: prompt,
            message_type: 'image'
          }
        }).select().single();
        
        if (placeholderError) {
          console.error("[image-start] Failed to insert placeholder:", placeholderError);
          // Continue anyway - image generation will still work
        } else if (placeholderMessage) {
          // Broadcast placeholder message to unified channel for instant loading state (fire-and-forget)
          const channelName = `user-realtime:${user_id}`;
          void supabase.channel(channelName).send({
            type: 'broadcast',
            event: 'message-insert',
            payload: {
              chat_id,
              message: placeholderMessage
            }
          })
            .then(() => console.log(`[image-start] Broadcast placeholder to ${channelName}`))
            .catch((broadcastError) => {
              console.error("[image-start] Broadcast failed:", broadcastError);
              // Non-critical - continue with image generation
            });
        }
        
      // 🚀 FIRE-AND-FORGET: Don't await image generation - return immediately
      // The image-generate function will update the placeholder message when done
      fetch(`${ENV.SUPABASE_URL}/functions/v1/image-generate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ENV.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ chat_id, prompt, user_id, mode, image_id: imageId })
      })
        .then(async (imageGenResp) => {
          if (!imageGenResp.ok) {
            const errBody = await imageGenResp.json().catch(() => ({}));
            console.error("[image-gen] failure:", imageGenResp.status, errBody);
            
            // Update placeholder message with error
            const errorMessage = imageGenResp.status === 429 
              ? "I've reached the daily limit of 3 images. You can generate more images tomorrow!"
              : "I tried to generate an image but encountered an error. Please try again.";
            
            await supabase.from('messages').update({
              text: errorMessage,
              status: 'complete',
              meta: {
                message_type: 'text',
                image_error: true
              }
            }).eq('id', imageId);
          }
        })
        .catch((err) => {
          console.error("[image-gen] fetch exception:", err);
          
          // Update placeholder message with error (fire-and-forget)
          supabase.from('messages').update({
            text: "I tried to generate an image but encountered an error. Please try again.",
            status: 'complete',
            meta: {
              message_type: 'text',
              image_error: true
            }
          }).eq('id', imageId).then(() => {}).catch((e) => console.error("[image-gen] error update failed:", e));
        });
      
      // Return immediately - user doesn't wait for image generation
      return JSON_RESPONSE(200, {
        success: true,
        message: "Image generation started",
        skip_message_creation: true,
        llm_latency_ms: geminiResponseJson?.latencyMs ?? null,
        total_latency_ms: Date.now() - startMs
      });
      }
    } else {
      // normal text extraction
      // Ignore any functionCall parts if the last message did not explicitly request an image
      assistantText = candidateParts
        .filter((p: any) => typeof p?.text === "string" && p.text.trim().length > 0)
        .map((p: any) => p.text)
        .join(" ")
        .trim();
      if (!assistantText) {
        console.error("[gemini] no assistant text returned");
        return JSON_RESPONSE(502, { error: "No response text from Gemini" });
      }
    }

    const sanitizedTextForTTS = sanitizePlainText(assistantText) || assistantText;
    const usage = {
      total_tokens: geminiResponseJson?.usageMetadata?.totalTokenCount ?? null,
      input_tokens: geminiResponseJson?.usageMetadata?.promptTokenCount ?? null,
      output_tokens: geminiResponseJson?.usageMetadata?.candidatesTokenCount ?? null,
      cached_tokens: geminiResponseJson?.usageMetadata?.cachedContentTokenCount ?? null
    };

    // Update turn count (fire-and-forget)
    const newTurnCount = (conversationMeta.turn_count || 0) + 1;
    supabase.from("conversations").update({ turn_count: newTurnCount }).eq("id", chat_id)
      .then(({ error }) => { if (error) console.warn("[supabase] update turn_count failed:", error); });

    // Trigger summary if interval reached
    const lastSummaryTurn = conversationMeta.last_summary_at_turn || 0;
    if (newTurnCount > 0 && newTurnCount % SUMMARY_INTERVAL === 0 && newTurnCount > lastSummaryTurn) {
      triggerSummaryGeneration(chat_id, lastSummaryTurn + 1, newTurnCount);
      supabase.from("conversations").update({ last_summary_at_turn: newTurnCount }).eq("id", chat_id)
        .then(({ error }) => { if (error) console.warn("[supabase] update last_summary_at_turn failed:", error); });
    }

    // Prepare tasks: save messages + optional TTS
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ENV.SUPABASE_SERVICE_ROLE_KEY}`,
      "x-internal-key": ENV.INTERNAL_API_KEY
    };

    const assistantClientId = crypto.randomUUID();
    const userClientId = crypto.randomUUID();

    const tasks: Promise<Response>[] = [];

    if (chattype === "voice") {
      tasks.push(fetch(`${ENV.SUPABASE_URL}/functions/v1/chat-send`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          chat_id,
          mode,
          messages: [
            { text, role: "user", client_msg_id: userClientId, mode, user_id, user_name },
            { text: assistantText, role: "assistant", client_msg_id: assistantClientId, mode, user_id, user_name }
          ],
          chattype
        })
      }));
    } else {
      tasks.push(fetch(`${ENV.SUPABASE_URL}/functions/v1/chat-send`, {
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
      }));
    }

    if (chattype === "voice") {
      const selectedVoice = typeof voice === "string" && voice.trim() ? voice : "Puck";
      tasks.push(fetch(`${ENV.SUPABASE_URL}/functions/v1/google-text-to-speech`, {
        method: "POST",
        headers,
        body: JSON.stringify({ text: sanitizedTextForTTS, voice: selectedVoice, chat_id, user_id })
      }));
    }

    // Fire-and-forget; no need to await
    Promise.allSettled(tasks).catch(() => { /* silent */ });

    // Update memory usage (fire-and-forget) - reuse memoryIds from earlier fetch
    if (memoryIds.length > 0) {
      updateMemoryUsage(supabase, memoryIds).catch((e) => console.warn("[memory] update failed:", e?.message || e));
    }

    // ✅ INCREMENT CHAT USAGE: Track successful chat message (fire-and-forget)
    if (user_id) {
      incrementUsage(supabase, user_id, 'chat', 1).catch((e) => 
        console.warn("[chat] usage increment failed:", e?.message || e)
      );
    }

    const totalLatencyMs = Date.now() - startMs;
    console.info(JSON.stringify({
      event: "response_sent",
      id: requestId,
      chat_id,
      llm_latency_ms: geminiResponseJson?.latencyMs ?? null,
      total_latency_ms: totalLatencyMs,
      usage,
      memories: (memoryIds || []).length
    }));

    return JSON_RESPONSE(200, {
      text: assistantText,
      usage,
      llm_latency_ms: geminiResponseJson?.latencyMs ?? null,
      total_latency_ms: totalLatencyMs
    });

  } catch (err) {
    console.error("[handler] unexpected error:", (err as any)?.message || err);
    return JSON_RESPONSE(500, { error: "Internal server error" });
  }
});
