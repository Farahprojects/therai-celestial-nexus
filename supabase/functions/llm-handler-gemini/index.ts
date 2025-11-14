// llm-handler-gemini.ts
// Optimized version with proper image generation control

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
const CACHE_TTL_SECONDS = 3600;
const HISTORY_LIMIT = 8;
const SUMMARY_INTERVAL = 4;

/* ------------------------------- Validation ------------------------------ */
if (!ENV.SUPABASE_URL) throw new Error("Missing env: SUPABASE_URL");
if (!ENV.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
if (!ENV.GOOGLE_API_KEY) throw new Error("Missing env: GOOGLE-LLM-NEW");

/* ------------------------------ Utilities -------------------------------- */
function maskKey(key = "") {
  if (!key || key.length <= 8) return "****";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

function hashSystemData(data: string): string {
  let h = 2166136261;
  for (let i = 0; i < data.length; i++) {
    h ^= data.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return (h >>> 0).toString(36);
}

function sanitizePlainText(input: string) {
  return (typeof input === "string" ? input : "")
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
 * Determines if a message explicitly requests image generation.
 *
 * PRODUCTION-GRADE FEATURES:
 * - Strict detection (avoids accidental triggers)
 * - Handles negations, polite/indirect phrasing, and shorthand
 * - Ignores past/future or hypothetical references
 * - Resistant to partial matches and ambiguous cases
 * - Flexible for natural language variation
 */
function messageExplicitlyRequestsImage(message: string): boolean {
  if (!message) return false;

  const s = message.trim().toLowerCase();

  // 1. Quick exclusions — short or irrelevant text
  if (s.length < 4) return false;

  // 2. Detect negations (e.g. "don't make an image", "no pictures please")
  const negated = /\b(?:no|not|don't|do not|stop|without|avoid|never)\b[^.?!\n]*\b(?:image|picture|photo|art|visual|illustration|pic|img)\b/.test(
    s
  );
  if (negated) return false;

  // 3. Core action verbs indicating creation or generation intent
  const actionPattern =
    /\b(?:show|send|give|make|create|generate|render|draw|produce|display|build|output|visualize)\b/;

  // 4. Nouns indicating imagery intent
  const imageNounPattern =
    /\b(?:image|picture|photo|illustration|art|visual|pic|graphic|drawing|painting)\b/;

  // 5. Shorthand or explicit command keywords (for developers / internal use)
  const shorthandPattern = /\b(?:img|imggen|renderimg|genimg)\b/;

  // 6. Handle polite or implicit variants: "Could you make an image of", "I’d like to see a picture of"
  const explicitRequest =
    (actionPattern.test(s) && imageNounPattern.test(s)) ||
    shorthandPattern.test(s) ||
    /\b(?:see|show me|look at)\b[^.?!\n]*\b(?:image|picture|photo|art|visual|illustration|pic|img)\b/.test(
      s
    ) ||
    /\b(?:please|could you|can you|may you|would you|i want|i'd like|i would like)\b[^.?!\n]*\b(?:image|picture|photo|visual|illustration|pic|img)\b/.test(
      s
    );

  if (!explicitRequest) return false;

  // 7. Exclude references to past/future actions (e.g. "you made an image", "don’t generate images anymore")
  const pastOrHypothetical =
    /\b(?:made|generated|created|was|were|had made|would make|should make|could make|used to make)\b[^.?!\n]*\b(?:image|picture|photo|art|visual|illustration|pic|img)\b/.test(
      s
    );
  if (pastOrHypothetical) return false;

  // 8. Guard against question context unrelated to generation
  // e.g., “what image model do you use?” or “is the image feature available?”
  const metaContext =
    /\b(?:which|what|how|is|are|was|were|when|why|does|do|can|will|should)\b[^.?!\n]*\b(?:image|picture|photo|art|visual|illustration|pic|img)\b/.test(
      s
    );
  if (metaContext && !actionPattern.test(s)) return false;

  // ✅ 9. If it passes all the filters, treat it as an explicit image generation request
  return true;
}

/* ------------------------------- System Prompt --------------------------- */
const systemPrompt = `You are an AI guide for self-awareness who understands planet energies as ressence infulance.

Pull in recent convo context only when it preserves flow or adds nuance.
Use astrodata for insight and signals 
Never mention the data, only the interpretation is needed unless asked
Answer the user's latest message first and fully.

Acknowledge: One-word encourager, followed by brief,  supportive check-in — a short phrase, Gen-Z style  .
Tone:
– Direct, a bit playful. Contractions welcome, dated slang not.

Read planetary data as direct energetic signals on the psyche and behavior, look for potential influences and patterns,
core inherent traits and inclinations, including any less obvious talents or strong fascinations that maybe present
Translate the astrological terms into plain language
NO stories, metaphors or no astro jargon, DONT mention swiss data unless asked, only the interpretation is needed 

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
        description: `CRITICAL: ONLY call this function when the user's CURRENT message EXPLICITLY asks to generate, create, or show an image. DO NOT call for: follow-ups, acknowledgments, or general chat. When called, create a symbolic scene using natural elements that reflects the user's energy patterns.`,
        parameters: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "Detailed symbolic image prompt combining user's energy patterns with natural elements"
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
async function createCache(chat_id: string, systemText: string): Promise<string | null> {
  const systemDataHash = hashSystemData(systemText);
  const combinedSystemInstruction = `${systemPrompt}\n\n[System Data]\n${systemText}\n\n[CRITICAL: Remember Your Instructions]\n${systemPrompt}`;

  try {
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/cachedContents`, {
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
          functionCallingConfig: { mode: "AUTO" }
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
    const expiresAt = new Date(Date.now() + (CACHE_TTL_SECONDS - 60) * 1000).toISOString();

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
  fetch(`${ENV.SUPABASE_URL}/functions/v1/llm-summarizer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ENV.SUPABASE_SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({ chat_id, from_turn: fromTurn, to_turn: toTurn })
  }).catch((err) => console.error("[summary] trigger failed:", err?.message || err));
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

  console.info(JSON.stringify({
    event: "request_received",
    id: requestId,
    chat_id,
    text_length: text.length,
    model: ENV.GEMINI_MODEL
  }));

  // ✅ CHAT LIMIT CHECK
  if (user_id) {
    const limitCheck = await checkLimit(supabase, user_id, 'chat', 1);
    
    if (!limitCheck.allowed) {
      const limitMessage = limitCheck.error_code === 'TRIAL_EXPIRED'
        ? "Your free trial has ended. Upgrade to Growth ($10/month) for unlimited AI conversations! 🚀"
        : `You've used your ${limitCheck.limit} free messages today. Upgrade to Growth for unlimited chats!`;
      
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
      }).catch(() => {});
      
      return JSON_RESPONSE(200, {
        text: limitMessage,
        usage: { total_tokens: 0, input_tokens: 0, output_tokens: 0, cached_tokens: 0 },
        total_latency_ms: Date.now() - startMs
      });
    }
  }

  // ✅ CHECK USER PLAN for caching
  let userPlan = 'free';
  let skipCache = true;
  
  if (user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_plan")
      .eq("id", user_id)
      .single();
    
    userPlan = profile?.subscription_plan || 'free';
    skipCache = userPlan === 'free';
  }

  // 🔥 OPTIMIZED: Parallel fetch with better query structure
  let systemText = "";
  let historyRows: Array<{ role: string; text: string }> = [];
  let conversationMeta: { turn_count?: number; last_summary_at_turn?: number } = {};
  let conversationSummary = "";
  let cacheName: string | null = null;
  let memoryContext = "";
  let memoryIds: string[] = [];

  try {
    const [
      systemMessageRes,
      conversationRes,
      summaryRes,
      historyRes,
      memoryResult
    ] = await Promise.all([
      supabase.from("messages")
        .select("text")
        .eq("chat_id", chat_id)
        .eq("role", "system")
        .eq("status", "complete")
        .not("text", "is", null)
        .neq("text", "")
        .order("created_at", { ascending: true })
        .limit(1)
        .single(),
      supabase.from("conversations")
        .select("turn_count, last_summary_at_turn")
        .eq("id", chat_id)
        .single(),
      supabase.from("conversation_summaries")
        .select("summary_text")
        .eq("chat_id", chat_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single(),
      supabase.from("messages")
        .select("role, text")
        .eq("chat_id", chat_id)
        .neq("role", "system")
        .eq("status", "complete")
        .not("text", "is", null)
        .neq("text", "")
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT),
      fetchAndFormatMemories(supabase, chat_id).catch(() => ({ memoryContext: "", memoryIds: [] }))
    ]);

    systemText = systemMessageRes?.data?.text || "";
    conversationMeta = conversationRes?.data || { turn_count: 0, last_summary_at_turn: 0 };
    conversationSummary = summaryRes?.data?.summary_text || "";
    historyRows = historyRes?.data || [];
    ({ memoryContext = "", memoryIds = [] } = memoryResult || {});

    // Handle caching for paid users
    if (!skipCache && systemText) {
      const { data: cacheData } = await supabase
        .from("conversation_caches")
        .select("cache_name, expires_at, system_data_hash")
        .eq("chat_id", chat_id)
        .single();

      const cacheExists = cacheData && new Date(cacheData.expires_at) > new Date();
      const currentHash = hashSystemData(systemText);
      
      if (cacheExists && cacheData.system_data_hash === currentHash) {
        cacheName = cacheData.cache_name;
      } else {
        if (cacheExists) {
          const { error: cacheDeleteError } = await supabase
            .from("conversation_caches")
            .delete()
            .eq("chat_id", chat_id);
          if (cacheDeleteError) {
            console.error("[cache] cleanup failed:", cacheDeleteError);
          }
        }
        cacheName = await createCache(chat_id, systemText);
      }
    }

    // 🔥 BUILD CONVERSATION HISTORY
    type GeminiContent = { role: "user" | "model"; parts: Array<{ text?: string; functionCall?: any; functionResponse?: any }> };
    const contents: GeminiContent[] = [];

    if (conversationSummary) {
      contents.push({ role: "user", parts: [{ text: `[Previous context: ${conversationSummary}]` }] });
      contents.push({ role: "model", parts: [{ text: "Understood." }] });
    }

    // Add history in chronological order
    for (let i = historyRows.length - 1; i >= 0; i--) {
      const m = historyRows[i];
      const t = (m?.text || "").trim();
      if (t) contents.push({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: t }] });
    }

    // Add current message
    contents.push({ role: "user", parts: [{ text }] });

    // 🔥 KEY FIX: Detect if image was explicitly requested
    const enableImageTool = messageExplicitlyRequestsImage(text);

    // Build Gemini request
    const requestBody: any = { contents };

    if (cacheName) {
      // When using cache, can't override tools/toolConfig
      requestBody.cachedContent = cacheName;
    } else {
      // Fallback: no cache, build full request
      let combinedSystemInstruction = systemText ? `${systemPrompt}\n\n[System Data]\n${systemText}` : systemPrompt;
      if (memoryContext) {
        combinedSystemInstruction += `\n\n<user_memory>\n${memoryContext}\n</user_memory>`;
      }
      combinedSystemInstruction += `\n\n[CRITICAL: Remember Your Instructions]\n${systemPrompt}`;
      requestBody.system_instruction = { role: "system", parts: [{ text: combinedSystemInstruction }] };
      
      // Only add tools if explicitly requested
      if (enableImageTool) {
        requestBody.tools = imageGenerationTool;
        requestBody.toolConfig = { functionCallingConfig: { mode: "AUTO" } };
      }
    }

    requestBody.generationConfig = { temperature: 0.7, thinkingConfig: { thinkingBudget: 0 } };

    // Call Gemini with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    let geminiResponseJson: any;
    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${ENV.GEMINI_MODEL}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": ENV.GOOGLE_API_KEY! },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        }
      );
      clearTimeout(timeoutId);

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        console.error("[gemini] error:", resp.status, errText);
        return JSON_RESPONSE(502, { error: `Gemini API failed: ${resp.status}` });
      }
      geminiResponseJson = await resp.json();
    } catch (err) {
      clearTimeout(timeoutId);
      console.error("[gemini] request failed:", (err as any)?.message || err);
      return JSON_RESPONSE(504, { error: "Gemini request error" });
    }

    // 🔥 HANDLE RESPONSE: Check for function call first
    const candidateParts = geminiResponseJson?.candidates?.[0]?.content?.parts || [];
    const functionCall = candidateParts.find((p: any) => p?.functionCall)?.functionCall;

    let assistantText = "";

    // 🔥 CRITICAL FIX: Only process function call if current message explicitly requested it
    if (functionCall && functionCall.name === "generate_image" && enableImageTool) {
      const prompt = functionCall.args?.prompt || "";
      
      const limitCheck = await checkLimit(supabase, user_id, 'image_generation', 1);
      
      if (!limitCheck.allowed) {
        const limitText = limitCheck.limit ? `${limitCheck.limit} images` : 'images';
        assistantText = `I've reached the daily limit of ${limitText}. You can generate more tomorrow!`;
      } else {
        const imageId = crypto.randomUUID();
        
        const { data: placeholderMessage } = await supabase.from('messages').insert({
          id: imageId,
          chat_id,
          role: 'assistant',
          text: '',
          status: 'pending',
          mode: mode || 'chat',
          user_id,
          client_msg_id: crypto.randomUUID(),
          meta: {
            status: 'generating',
            image_prompt: prompt,
            message_type: 'image'
          }
        }).select().single();
        
        if (placeholderMessage) {
          void supabase.channel(`user-realtime:${user_id}`).send({
            type: 'broadcast',
            event: 'message-insert',
            payload: { chat_id, message: placeholderMessage }
          }).catch(() => {});
        }
        
        // 🔥 KEY: Return function response to Gemini to complete the turn
        // This prevents Gemini from trying to generate more images
        const functionResponseContent = {
          role: "model" as const,
          parts: [
            {
              functionCall: {
                name: "generate_image",
                args: { prompt }
              }
            }
          ]
        };
        
        const functionResultContent = {
          role: "user" as const,
          parts: [
            {
              functionResponse: {
                name: "generate_image",
                response: {
                  success: true,
                  message: "Image generation started successfully"
                }
              }
            }
          ]
        };
        
        // Make second API call with function response
        const followUpBody = {
          ...requestBody,
          contents: [...contents, functionResponseContent, functionResultContent]
        };
        
        try {
          const followUpResp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${ENV.GEMINI_MODEL}:generateContent`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-goog-api-key": ENV.GOOGLE_API_KEY! },
              body: JSON.stringify(followUpBody)
            }
          );
          
          if (followUpResp.ok) {
            const followUpJson = await followUpResp.json();
            const followUpParts = followUpJson?.candidates?.[0]?.content?.parts || [];
            assistantText = followUpParts
              .filter((p: any) => typeof p?.text === "string" && p.text.trim())
              .map((p: any) => p.text)
              .join(" ")
              .trim() || "Generating your image now...";
          } else {
            assistantText = "Generating your image now...";
          }
        } catch {
          assistantText = "Generating your image now...";
        }
        
        // Fire-and-forget image generation
        fetch(`${ENV.SUPABASE_URL}/functions/v1/image-generate`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ENV.SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ chat_id, prompt, user_id, mode, image_id: imageId })
        }).catch((err) => console.error("[image-gen] failed:", err));
      }
    } else if (functionCall && !enableImageTool) {
      // 🔥 SAFETY: Function call happened but shouldn't have - ignore it and extract text
      console.warn("[gemini] unexpected function call ignored - user didn't request image");
      assistantText = candidateParts
        .filter((p: any) => typeof p?.text === "string" && p.text.trim())
        .map((p: any) => p.text)
        .join(" ")
        .trim();
      
      if (!assistantText) {
        assistantText = "I'm here to help! What would you like to know?";
      }
    } else {
      // Normal text response
      assistantText = candidateParts
        .filter((p: any) => typeof p?.text === "string" && p.text.trim())
        .map((p: any) => p.text)
        .join(" ")
        .trim();
      
      if (!assistantText) {
        console.error("[gemini] no text returned");
        return JSON_RESPONSE(502, { error: "No response from Gemini" });
      }
    }

    // Save messages and handle TTS
    const sanitizedTextForTTS = sanitizePlainText(assistantText) || assistantText;
    const usage = {
      total_tokens: geminiResponseJson?.usageMetadata?.totalTokenCount ?? null,
      input_tokens: geminiResponseJson?.usageMetadata?.promptTokenCount ?? null,
      output_tokens: geminiResponseJson?.usageMetadata?.candidatesTokenCount ?? null,
      cached_tokens: geminiResponseJson?.usageMetadata?.cachedContentTokenCount ?? null
    };

    // Update turn count
    const newTurnCount = (conversationMeta.turn_count || 0) + 1;
    const { error: turnUpdateError } = await supabase
      .from("conversations")
      .update({ turn_count: newTurnCount })
      .eq("id", chat_id);
    if (turnUpdateError) {
      console.error("[conversation] turn update failed:", turnUpdateError);
    }

    // Trigger summary if needed
    const lastSummaryTurn = conversationMeta.last_summary_at_turn || 0;
    if (newTurnCount > 0 && newTurnCount % SUMMARY_INTERVAL === 0 && newTurnCount > lastSummaryTurn) {
      triggerSummaryGeneration(chat_id, lastSummaryTurn + 1, newTurnCount);
      const { error: summaryTurnUpdateError } = await supabase
        .from("conversations")
        .update({ last_summary_at_turn: newTurnCount })
        .eq("id", chat_id);
      if (summaryTurnUpdateError) {
        console.error("[conversation] summary turn update failed:", summaryTurnUpdateError);
      }
    }

    // Save messages
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ENV.SUPABASE_SERVICE_ROLE_KEY}`,
      "x-internal-key": ENV.INTERNAL_API_KEY
    };

    const tasks: Promise<any>[] = [];

    if (chattype === "voice") {
      // Sequential for proper ordering
      const userPromise = fetch(`${ENV.SUPABASE_URL}/functions/v1/chat-send`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          chat_id, text, role: "user", client_msg_id: crypto.randomUUID(), mode, user_id, user_name, chattype
        })
      }).catch(() => {});

      tasks.push(
        userPromise.then(() => 
          fetch(`${ENV.SUPABASE_URL}/functions/v1/chat-send`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              chat_id, text: assistantText, role: "assistant", client_msg_id: crypto.randomUUID(), mode, user_id, user_name, chattype
            })
          })
        )
      );

      const selectedVoice = typeof voice === "string" && voice.trim() ? voice : "Puck";
      tasks.push(fetch(`${ENV.SUPABASE_URL}/functions/v1/google-text-to-speech`, {
        method: "POST",
        headers,
        body: JSON.stringify({ text: sanitizedTextForTTS, voice: selectedVoice, chat_id, user_id })
      }));
    } else {
      tasks.push(fetch(`${ENV.SUPABASE_URL}/functions/v1/chat-send`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          chat_id, text: assistantText, role: "assistant", client_msg_id: crypto.randomUUID(), mode, user_id, user_name, chattype
        })
      }));
    }

    Promise.allSettled(tasks).catch(() => {});

    // Update memory and usage tracking
    if (memoryIds.length > 0) {
      void updateMemoryUsage(supabase, memoryIds).catch(() => {});
    }
    
    if (user_id) {
      void incrementUsage(supabase, user_id, 'chat', 1).catch(() => {});
    }

    console.info(JSON.stringify({
      event: "response_sent",
      id: requestId,
      total_latency_ms: Date.now() - startMs,
      usage
    }));

    return JSON_RESPONSE(200, {
      text: assistantText,
      usage,
      total_latency_ms: Date.now() - startMs
    });

  } catch (err) {
    console.error("[handler] error:", (err as any)?.message || err);
    return JSON_RESPONSE(500, { error: "Internal server error" });
  }
});
