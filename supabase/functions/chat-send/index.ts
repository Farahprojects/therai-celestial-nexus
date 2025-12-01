// -@ts-nocheck - Deno runtime, types checked at deployment
// - Refactored version with clear separation of concerns
// - Uses Deno.serve (no std/http dependency)
// - Validates input and fails fast on missing env vars
// - Single path for saving messages (role inferred)
// - Awaits DB insert; fires LLM call asynchronously when needed
// - Consistent JSON responses and CORS handling
// Dynamically routes to correct LLM handler based on system config

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createPooledClient } from "../_shared/supabaseClient.ts";
import { getLLMHandler } from "../_shared/llmConfig.ts";
import { getConversationMetadata } from "../_shared/queryCache.ts";
import { checkRateLimit, RateLimits } from "../_shared/rateLimiting.ts";
import {
  AuthContext,
  HttpError,
  getAuthContext,
  authenticateUserIfNeeded,
  ensureConversationAccess,
  parseJsonBody
} from "../_shared/authHelper.ts";

// ============================================================================
// TYPES & PAYLOAD VALIDATORS
// ============================================================================

type Role = "user" | "assistant";

interface BasePayload {
  chat_id: string;
  mode: string;
  chattype?: string;
  user_id?: string | null;
  user_name?: string | null;
  analyze?: boolean;
  meta?: Record<string, any> | null;
}

interface SinglePayload extends BasePayload {
  text: string;
  messages?: undefined;
  client_msg_id?: string;
  role?: Role;
}

interface BatchMessage {
  role: Role;
  text: string;
  client_msg_id?: string;
  mode?: string;
  user_id?: string | null;
  user_name?: string | null;
  meta?: Record<string, any> | null;
}

interface BatchPayload extends BasePayload {
  messages: BatchMessage[];
}


function parseAndValidateSinglePayload(body: any): SinglePayload {
  if (!body || typeof body !== "object") {
    throw new HttpError(400, "Invalid request body");
  }

  const { chat_id, text, mode } = body;

  if (!chat_id || typeof chat_id !== "string") {
    throw new HttpError(400, "Missing or invalid field: chat_id");
  }
  if (!text || typeof text !== "string") {
    throw new HttpError(400, "Missing or invalid field: text");
  }
  if (!mode || typeof mode !== "string") {
    throw new HttpError(400, "Missing or invalid field: mode");
  }

  return body as SinglePayload;
}

function parseAndValidateBatchPayload(body: any): BatchPayload {
  if (!body || typeof body !== "object") {
    throw new HttpError(400, "Invalid request body");
  }

  const { chat_id, mode, messages } = body;

  if (!chat_id || typeof chat_id !== "string") {
    throw new HttpError(400, "Missing or invalid field: chat_id");
  }
  if (!mode || typeof mode !== "string") {
    throw new HttpError(400, "Missing or invalid field: mode");
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new HttpError(400, "Missing or invalid field: messages");
  }

  for (const msg of messages) {
    if (!msg.text || typeof msg.text !== "string") {
      throw new HttpError(400, "Invalid message in batch: missing or invalid text");
    }
    if (!msg.role || !["user", "assistant"].includes(msg.role)) {
      throw new HttpError(400, "Invalid message in batch: invalid role");
    }
  }

  return body as BatchPayload;
}


// ============================================================================
// BROADCASTING HELPERS
// ============================================================================

async function getConversationParticipants(chatId: string): Promise<string[]> {
  const { data: participants } = await supabase
    .from("conversations_participants")
    .select("user_id")
    .eq("conversation_id", chatId);

  return (participants ?? []).map(p => p.user_id);
}

async function broadcastMessageInsert(
  chatId: string,
  message: any,
  fallbackUserId?: string | null,
  requestId?: string
): Promise<void> {
  const participantUserIds = await getConversationParticipants(chatId);
  const targetUserIds =
    participantUserIds.length > 0
      ? participantUserIds
      : (fallbackUserId ? [fallbackUserId] : []);

  console.info(JSON.stringify({
    event: "broadcast_message_insert",
    request_id: requestId,
    chat_id: chatId,
    target_user_count: targetUserIds.length,
  }));

  await Promise.all(
    targetUserIds.map(async (targetUserId) => {
      const broadcastChannel = supabase.channel(`user-realtime:${targetUserId}`);
      try {
        await broadcastChannel.send({
          type: "broadcast",
          event: "message-insert",
          payload: { chat_id: chatId, message },
        });
      } catch (err) {
        console.error(JSON.stringify({
          event: "broadcast_failed",
          request_id: requestId,
          target_user_id: targetUserId,
          error: err instanceof Error ? err.message : String(err),
        }));
      } finally {
        supabase.removeChannel(broadcastChannel).catch(() => {});
      }
    })
  );
}

async function broadcastAssistantThinking(
  chatId: string,
  fallbackUserId?: string | null,
  requestId?: string
): Promise<void> {
  const participantUserIds = await getConversationParticipants(chatId);
  const targetUserIds =
    participantUserIds.length > 0
      ? participantUserIds
      : (fallbackUserId ? [fallbackUserId] : []);

  await Promise.all(
    targetUserIds.map(async (targetUserId) => {
      const channel = supabase.channel(`user-realtime:${targetUserId}`);
      try {
        await channel.send({
          type: "broadcast",
          event: "assistant-thinking",
          payload: { chat_id: chatId, status: "thinking" },
        });
      } finally {
        supabase.removeChannel(channel).catch(() => {});
      }
    })
  );
}

// ============================================================================
// LLM HELPERS
// ============================================================================

async function shouldTriggerLLM(
  role: Role,
  chattype: string | undefined,
  chatId: string,
  analyze?: boolean
): Promise<{ shouldStart: boolean; handlerName: string | null }> {
  if (role !== "user" || chattype === "voice") {
    return { shouldStart: false, handlerName: null };
  }

  const conversationMode = await getConversationMetadata(
    chatId,
    async () => {
      const { data: conv } = await supabase
        .from("conversations")
        .select("mode")
        .eq("id", chatId)
        .single();
      return conv?.mode || "chat";
    }
  );

  if (conversationMode === "together" && analyze !== true) {
    return { shouldStart: false, handlerName: null };
  }

  if (conversationMode === "together" && analyze === true) {
    return { shouldStart: true, handlerName: "llm-handler-together-mode" };
  }

  return {
    shouldStart: true,
    handlerName: await getLLMHandler(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY),
  };
}

async function triggerLLM(
  handlerName: string,
  payload: {
    chat_id: string;
    text: string;
    mode: string;
    user_id?: string | null;
    user_name?: string | null;
    analyze?: boolean;
  },
  requestId: string
): Promise<void> {
  const llmStartTime = Date.now();

  console.info(JSON.stringify({
    event: "calling_llm",
    request_id: requestId,
    llm_handler: handlerName,
  }));

  try {
    await fetch(`${SUPABASE_URL}/functions/v1/${handlerName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ ...payload, source: "chat-send" }),
    });

    console.info(JSON.stringify({
      event: "llm_completed",
      request_id: requestId,
      duration_ms: Date.now() - llmStartTime,
    }));
  } catch (err) {
    console.error(JSON.stringify({
      event: "llm_failed",
      request_id: requestId,
      error: err instanceof Error ? err.message : String(err),
    }));
  }
}

// ============================================================================
// MEMORY HELPERS
// ============================================================================

async function maybeScheduleMemoryExtraction(
  insertedMessage: any,
  requestId: string
): Promise<void> {
  // Fire-and-forget: run sampling and extraction after response
  Promise.resolve().then(async () => {
    // Check if we should extract memories based on heuristics
    // Skip short responses (< 50 chars) - likely generic acknowledgments
    if (!insertedMessage?.text || insertedMessage.text.length < 50) {
      console.info(JSON.stringify({
        event: "memory_extraction_skipped_short_response",
        request_id: requestId,
        text_length: insertedMessage?.text?.length || 0
      }));
      return;
    }

    // Check conversation message count - skip early conversations
    const { count: messageCount, error: countError } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('chat_id', insertedMessage.chat_id);

    if (countError || !messageCount || messageCount < 3) {
      console.info(JSON.stringify({
        event: "memory_extraction_skipped_early_conversation",
        request_id: requestId,
        message_count: messageCount || 0
      }));
      return;
    }

    // Always extract once heuristics above pass
    const shouldExtract = true;

    console.info(JSON.stringify({
      event: "memory_extraction_ready",
      request_id: requestId,
      message_count: messageCount
    }));

    if (shouldExtract) {
      const payload = {
        conversation_id: insertedMessage.chat_id,
        message_id: insertedMessage.id,
        user_id: insertedMessage.user_id
      };

      console.info(JSON.stringify({
        event: "memory_extraction_triggered",
        request_id: requestId,
        conversation_id: insertedMessage.chat_id,
        message_id: insertedMessage.id
      }));

      // Extract observation to buffer (not direct commit)
      fetch(`${SUPABASE_URL}/functions/v1/extract-user-memory`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify(payload)
      }).catch(err => {
        console.error(JSON.stringify({
          event: "memory_extraction_trigger_failed",
          request_id: requestId,
          error: err instanceof Error ? err.message : String(err)
        }));
      });

      // Check if buffer should be processed due to inactivity
      checkAndProcessInactiveBuffers(insertedMessage.chat_id, insertedMessage.user_id, requestId);
    }
  });
}

async function checkAndProcessInactiveBuffers(
  chat_id: string,
  user_id: string | null,
  requestId: string
): Promise<void> {
  try {
    // Query conversations that need buffer processing (10+ min inactive with pending items)
    const { data: needsProcessing } = await supabase
      .rpc('get_conversations_needing_buffer_processing', { inactivity_minutes: 10 })
      .eq('conversation_id', chat_id)
      .maybeSingle() as { data: { pending_count?: number; minutes_since_activity?: number } | null };

    if (!needsProcessing || !needsProcessing.pending_count) {
      console.info(JSON.stringify({
        event: "buffer_processing_not_needed",
        request_id: requestId,
        conversation_id: chat_id,
        reason: !needsProcessing ? "no_activity_record" : "no_pending_items"
      }));
      return;
    }

    console.info(JSON.stringify({
      event: "buffer_processing_triggered_by_inactivity",
      request_id: requestId,
      conversation_id: chat_id,
      pending_count: needsProcessing.pending_count,
      minutes_since_activity: needsProcessing.minutes_since_activity
    }));

    // Trigger buffer processing (fire-and-forget)
    fetch(`${SUPABASE_URL}/functions/v1/process-memory-buffer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        conversation_id: chat_id,
        user_id: user_id,
        force: false
      })
    }).catch(err => {
      console.error(JSON.stringify({
        event: "buffer_processing_trigger_failed",
        request_id: requestId,
        error: err instanceof Error ? err.message : String(err)
      }));
    });
  } catch (err) {
    console.error(JSON.stringify({
      event: "buffer_inactivity_check_failed",
      request_id: requestId,
      error: err instanceof Error ? err.message : String(err)
    }));
  }
}

// ============================================================================
// ORCHESTRATOR FUNCTIONS
// ============================================================================

async function handleBatchMessages(
  payload: BatchPayload,
  authCtx: AuthContext,
  requestId: string,
  startTime: number
): Promise<any> {
  // Save batch messages to database
  const messagesToInsert = payload.messages.map(msg => ({
    chat_id: payload.chat_id,
    role: msg.role,
    text: msg.text,
    client_msg_id: msg.client_msg_id ?? crypto.randomUUID(),
    status: "complete",
    mode: msg.mode || payload.mode,
    user_id: (msg.user_id || payload.user_id) ?? null,
    user_name: (msg.user_name || payload.user_name) ?? null,
    meta: msg.meta || {}
  }));

  const { data: insertedMessages, error: dbError } = await supabase
    .from("messages")
    .insert(messagesToInsert)
    .select("*")
    .order("message_number", { ascending: true });

  if (dbError) {
    console.error(JSON.stringify({
      event: "chat_send_batch_insert_failed",
      request_id: requestId,
      error: dbError.message
    }));
    throw new HttpError(500, `Failed to save messages: ${dbError.message}`);
  }

  console.info(JSON.stringify({
    event: "chat_send_batch_insert_complete",
    request_id: requestId,
    message_count: insertedMessages.length,
    duration_ms: Date.now() - startTime
  }));

  // Broadcast each message
  if (insertedMessages && insertedMessages.length > 0) {
    await Promise.all(
      insertedMessages.map(msg =>
        broadcastMessageInsert(payload.chat_id, msg, payload.user_id, requestId)
      )
    );
  }

  return {
    message: `Saved ${insertedMessages.length} messages`,
    saved: insertedMessages
  };
}

async function handleSingleMessage(
  payload: SinglePayload,
  role: Role,
  authCtx: AuthContext,
  requestId: string,
  startTime: number
): Promise<any> {
  const message = {
    chat_id: payload.chat_id,
    role,
    text: payload.text,
    client_msg_id: payload.client_msg_id ?? crypto.randomUUID(),
    status: "complete",
    mode: payload.mode,
    user_id: payload.user_id ?? null,
    user_name: payload.user_name ?? null,
    meta: payload.meta || {}
  };

  // Check if we should trigger LLM
  const { shouldStart: shouldStartLLM, handlerName } = await shouldTriggerLLM(
    role,
    payload.chattype,
    payload.chat_id,
    payload.analyze
  );

  if (shouldStartLLM && handlerName) {
    // Broadcast thinking state to all participants
    await broadcastAssistantThinking(payload.chat_id, payload.user_id, requestId);

    // Trigger LLM (fire-and-forget)
    triggerLLM(handlerName, {
      chat_id: payload.chat_id,
      text: payload.text,
      mode: payload.mode,
      user_id: payload.user_id,
      user_name: payload.user_name,
      analyze: payload.analyze
    }, requestId);
  }

  // Handle DB insertion differently for user vs assistant messages
  if (role === "user") {
    // Fire-and-forget for user messages
    supabase
      .from("messages")
      .insert(message)
      .select("*")
      .single()
      .then(({ data, error: dbError }) => {
        if (dbError) {
          console.error(JSON.stringify({
            event: "chat_send_db_insert_failed",
            request_id: requestId,
            error: dbError.message,
            role: "user"
          }));
          return;
        }

        console.info(JSON.stringify({
          event: "chat_send_db_insert_complete",
          request_id: requestId,
          duration_ms: Date.now() - startTime,
          role: "user"
        }));

        if (data) {
          broadcastMessageInsert(payload.chat_id, data, payload.user_id, requestId);
        }
      });
  } else {
    // Await for assistant messages
    const { data, error: dbError } = await supabase
      .from("messages")
      .insert(message)
      .select("*")
      .single();

    if (dbError) {
      console.error(JSON.stringify({
        event: "chat_send_db_insert_failed",
        request_id: requestId,
        error: dbError.message,
        role: "assistant"
      }));
      throw new HttpError(500, `Failed to save message: ${dbError.message}`);
    }

    console.info(JSON.stringify({
      event: "chat_send_db_insert_complete",
      request_id: requestId,
      duration_ms: Date.now() - startTime,
      role: "assistant"
    }));

    // Broadcast assistant message
    if (data) {
      await broadcastMessageInsert(payload.chat_id, data, payload.user_id, requestId);
    }

    // Schedule memory extraction for assistant messages
    if (data?.id) {
      maybeScheduleMemoryExtraction(data, requestId);
    }
  }

  return {
    message: role === "assistant" ? "Assistant message saved" : "User message saved",
    saved: message,
    llm_started: shouldStartLLM
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
"Access-Control-Allow-Methods": "POST, OPTIONS",
"Vary": "Origin"
};

// Fail fast if env vars are missing
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL) throw new Error("Missing env: SUPABASE_URL");
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");

// Create Supabase client with connection pooling
const supabase = createPooledClient();

const json = (status: number, data: any) =>
new Response(JSON.stringify(data), {
status,
headers: { ...corsHeaders, "Content-Type": "application/json" }
});

// ============================================================================
// THIN ORCHESTRATOR HANDLER
// ============================================================================

Deno.serve(async (req) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID().substring(0, 8);

  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "POST") {
      throw new HttpError(405, "Method not allowed");
    }

    const body = await parseJsonBody(req);
    const authCtx = getAuthContext(req);

    const isBatch = Array.isArray(body?.messages) && body.messages.length > 0;
    if (isBatch) {
      const payload = parseAndValidateBatchPayload(body);
      await authenticateUserIfNeeded(authCtx, payload.user_id, requestId);
      await ensureConversationAccess(authCtx, payload.chat_id, requestId);

      const result = await handleBatchMessages(payload, authCtx, requestId, startTime);
      return json(200, result);
    } else {
      const payload = parseAndValidateSinglePayload(body);
      const role: Role = payload.role === "assistant" ? "assistant" : "user";

      await authenticateUserIfNeeded(authCtx, payload.user_id, requestId);
      await ensureConversationAccess(authCtx, payload.chat_id, requestId);

      const result = await handleSingleMessage(payload, role, authCtx, requestId, startTime);
      return json(200, result);
    }
  } catch (err) {
    if (err instanceof HttpError) {
      return json(err.status, { error: err.message });
    }
    console.error(JSON.stringify({
      event: "unhandled_error",
      request_id: requestId,
      error: err instanceof Error ? err.message : String(err),
    }));
    return json(500, { error: "Internal server error" });
  }
});
