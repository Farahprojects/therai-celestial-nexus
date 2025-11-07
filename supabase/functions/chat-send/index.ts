// @ts-nocheck - Deno runtime, types checked at deployment
// Simplified, production-ready version
// - Uses Deno.serve (no std/http dependency)
// - Validates input and fails fast on missing env vars
// - Single path for saving messages (role inferred)
// - Awaits DB insert; fires LLM call asynchronously when needed
// - Consistent JSON responses and CORS handling
// Dynamically routes to correct LLM handler based on system config
// Updated: SEO improvements and routing fixes

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getLLMHandler } from "../_shared/llmConfig.ts";

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

// Create Supabase client once
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
auth: { persistSession: false }
});

const json = (status: number, data: any) =>
new Response(JSON.stringify(data), {
status,
headers: { ...corsHeaders, "Content-Type": "application/json" }
});

Deno.serve(async (req) => {
const startTime = Date.now();
const requestId = crypto.randomUUID().substring(0, 8);

console.info(JSON.stringify({
  event: "chat_send_request_received",
  request_id: requestId,
  method: req.method
}));

if (req.method === "OPTIONS") {
return new Response("ok", { headers: corsHeaders });
}

if (req.method !== "POST") {
return json(405, { error: "Method not allowed" });
}

let body;
try {
body = await req.json();
console.info(JSON.stringify({
  event: "chat_send_json_parsed",
  request_id: requestId,
  duration_ms: Date.now() - startTime
}));
} catch {
return json(400, { error: "Invalid JSON body" });
}

const {
chat_id,
text,
messages, // For voice mode: array of [user, assistant] messages
client_msg_id,
mode,
chattype,
role: rawRole,
user_id,
user_name,
analyze
} = body || {};

if (!chat_id || typeof chat_id !== "string") {
return json(400, { error: "Missing or invalid field: chat_id" });
}

// Handle voice mode: multiple messages in one call
if (messages && Array.isArray(messages) && messages.length > 0) {
  console.info(JSON.stringify({
    event: "chat_send_batch_mode",
    request_id: requestId,
    message_count: messages.length,
    chattype
  }));

  // Validate all messages
  if (!mode || typeof mode !== "string") {
    return json(400, { error: "Missing or invalid field: mode" });
  }

  for (const msg of messages) {
    if (!msg.text || typeof msg.text !== "string") {
      return json(400, { error: `Invalid message in batch: missing or invalid text` });
    }
    if (!msg.role || !["user", "assistant"].includes(msg.role)) {
      return json(400, { error: `Invalid message in batch: invalid role` });
    }
  }

  // Save all messages in order (user first, then assistant)
  const messagesToInsert = messages.map(msg => ({
    chat_id,
    role: msg.role,
    text: msg.text,
    client_msg_id: msg.client_msg_id ?? crypto.randomUUID(),
    status: "complete",
    mode: msg.mode || mode,
    user_id: (msg.user_id || user_id) ?? null,
    user_name: (msg.user_name || user_name) ?? null,
    meta: {}
  }));

  const { data: insertedMessages, error: dbError } = await supabase
    .from("messages")
    .insert(messagesToInsert)
    .select("*");

  if (dbError) {
    console.error(JSON.stringify({
      event: "chat_send_batch_insert_failed",
      request_id: requestId,
      error: dbError.message
    }));
    return json(500, { error: "Failed to save messages", details: dbError.message });
  }

  console.info(JSON.stringify({
    event: "chat_send_batch_insert_complete",
    request_id: requestId,
    message_count: messagesToInsert.length,
    duration_ms: Date.now() - startTime
  }));

  // Broadcast each message to unified user channel (WebSocket optimization)
  if (insertedMessages && insertedMessages.length > 0 && user_id) {
    const broadcastChannel = supabase.channel(`user-realtime:${user_id}`);
    
    // Send each message as a separate broadcast event
    for (const msg of insertedMessages) {
      broadcastChannel.send({
        type: 'broadcast',
        event: 'message-insert',
        payload: {
          chat_id,
          message: msg
        }
      }).catch((err) => {
        console.error(JSON.stringify({
          event: "chat_send_batch_broadcast_failed",
          request_id: requestId,
          message_id: msg.id,
          error: err instanceof Error ? err.message : String(err)
        }));
      });
    }
    
    // Clean up channel after a brief delay
    setTimeout(() => {
      supabase.removeChannel(broadcastChannel).catch(() => {});
    }, 100);
  }

  // Flush logs before returning response
  await new Promise(r => setTimeout(r, 50));

  return json(200, {
    message: `Saved ${messagesToInsert.length} messages`,
    saved: insertedMessages || messagesToInsert
  });
}

// Regular single message mode
if (!text || typeof text !== "string") {
return json(400, { error: "Missing or invalid field: text" });
}
if (!mode || typeof mode !== "string") {
return json(400, { error: "Missing or invalid field: mode" });
}

const role = rawRole === "assistant" ? "assistant" : "user";

// Check for internal API key (backend-to-backend calls)
const INTERNAL_API_KEY = Deno.env.get("INTERNAL_API_KEY");
const internalKey = req.headers.get("x-internal-key");
const authHeader = req.headers.get("Authorization");
// Also check if Authorization header contains service role key (backup for internal calls)
// Format: "Bearer {SERVICE_ROLE_KEY}"
const hasServiceRoleKey = authHeader && SUPABASE_SERVICE_ROLE_KEY && authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
const isInternalCall = (internalKey && INTERNAL_API_KEY && internalKey === INTERNAL_API_KEY) || hasServiceRoleKey;

console.info(JSON.stringify({
  event: "chat_send_processing",
  request_id: requestId,
  chat_id,
  role,
  chattype,
  chattype_type: typeof chattype,
  mode,
  text_length: text?.length || 0,
  is_internal_call: isInternalCall,
  has_internal_key_header: !!internalKey,
  has_internal_api_key_env: !!INTERNAL_API_KEY
}));

// 🔒 SECURITY: Verify user authentication for frontend calls
// Skip JWT validation for trusted internal calls (backend-to-backend)
if (role === "user" && user_id && !isInternalCall) {
  // Verify JWT token from Authorization header
  if (!authHeader) {
    return json(401, { error: "Missing Authorization header" });
  }

  try {
    // Create authenticated client to verify user
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
    if (!ANON_KEY) {
      console.error(JSON.stringify({
        event: "chat_send_missing_anon_key",
        request_id: requestId
      }));
      return json(500, { error: "Server configuration error" });
    }
    
    const authClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    const { data: userData, error: authError } = await authClient.auth.getUser();
    if (authError || !userData?.user) {
      return json(401, { error: "Invalid or expired token" });
    }

    // Verify user_id matches authenticated user
    if (userData.user.id !== user_id) {
      return json(403, { error: "user_id mismatch" });
    }
  } catch (err) {
    console.error(JSON.stringify({
      event: "chat_send_auth_check_failed",
      request_id: requestId,
      error: err instanceof Error ? err.message : String(err)
    }));
    return json(500, { error: "Authentication check failed" });
  }
}

const message = {
chat_id,
role,
text,
client_msg_id: client_msg_id ?? crypto.randomUUID(),
status: "complete",
mode,
user_id: user_id ?? null,
user_name: user_name ?? null,
meta: {}
};

// ⚡ FIRE-AND-FORGET: Start LLM immediately (non-blocking)
// For "together" mode, only trigger LLM if @therai is present (analyze = true)
let shouldStartLLM = role === "user" && chattype !== "voice";
let shouldExtractMemory = false;

if (shouldStartLLM) {
  // Check conversation mode to determine if we should skip LLM
  const { data: conv } = await supabase
    .from('conversations')
    .select('mode')
    .eq('id', chat_id)
    .single();
  
  const conversationMode = conv?.mode || 'chat';
  
  // Together mode: only trigger LLM if @therai is present
  if (conversationMode === 'together' && analyze !== true) {
    shouldStartLLM = false;
    console.info(JSON.stringify({
      event: "chat_send_together_mode_skip_llm",
      request_id: requestId,
      conversation_mode: conversationMode,
      analyze: analyze,
      note: "Together mode without @therai - skipping LLM for peer-to-peer chat"
    }));
  }
}

if (shouldStartLLM) {
const llmStartTime = Date.now();

console.info(JSON.stringify({
  event: "chat_send_calling_llm",
  request_id: requestId,
  chattype,
  chattype_type: typeof chattype,
  chattype_is_voice: chattype === "voice",
  should_start_llm: shouldStartLLM,
  role,
  mode,
  analyze: analyze
}));

// Determine which LLM handler to use
const determineLLMHandler = async () => {
  // Check conversation mode for Together Mode routing
  const { data: conv } = await supabase
    .from('conversations')
    .select('mode')
    .eq('id', chat_id)
    .single();
  
  const conversationMode = conv?.mode || 'chat';
  
  if (conversationMode === 'together' && analyze === true) {
    console.info(JSON.stringify({
      event: "chat_send_together_mode_routing",
      request_id: requestId,
      conversation_mode: conversationMode
    }));
    return 'llm-handler-together-mode';
  } else {
    // Normal chat flow
    return await getLLMHandler(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  }
};

determineLLMHandler().then((llmHandler) => {
  const payload = { chat_id, text, mode, user_id, user_name, analyze, source: "chat-send" };
  
  console.info(JSON.stringify({
    event: "chat_send_llm_payload",
    request_id: requestId,
    llm_handler: llmHandler,
    payload_keys: Object.keys(payload),
    analyze_mode: !!analyze
  }));
  
  return fetch(`${SUPABASE_URL}/functions/v1/${llmHandler}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify(payload)
  });
}).then(() => {
  console.info(JSON.stringify({
    event: "chat_send_llm_completed",
    request_id: requestId,
    duration_ms: Date.now() - llmStartTime
  }));
}).catch((err) => {
  console.error(JSON.stringify({
    event: "chat_send_llm_failed",
    request_id: requestId,
    error: err instanceof Error ? err.message : String(err)
  }));
});
}

// ⚡ AWAIT DB insert to ensure message is saved before returning
console.info(JSON.stringify({
  event: "chat_send_db_insert_start",
  request_id: requestId
}));

const { data: insertedMessage, error: dbError } = await supabase
  .from("messages")
  .insert(message)
  .select("*")
  .single();

if (dbError) {
  console.error(JSON.stringify({
    event: "chat_send_db_insert_failed",
    request_id: requestId,
    error: dbError.message
  }));
  return json(500, { error: "Failed to save message", details: dbError.message });
}

console.info(JSON.stringify({
  event: "chat_send_db_insert_complete",
  request_id: requestId,
  duration_ms: Date.now() - startTime
}));

// Broadcast to unified user channel (WebSocket optimization)
if (insertedMessage && user_id) {
  const broadcastChannel = supabase.channel(`user-realtime:${user_id}`);
  broadcastChannel.send({
    type: 'broadcast',
    event: 'message-insert',
    payload: {
      chat_id,
      message: insertedMessage
    }
  }).then(() => {
    console.info(JSON.stringify({
      event: "chat_send_broadcast_sent",
      request_id: requestId,
      user_id,
      message_id: insertedMessage.id
    }));
  }).catch((err) => {
    console.error(JSON.stringify({
      event: "chat_send_broadcast_failed",
      request_id: requestId,
      error: err instanceof Error ? err.message : String(err)
    }));
  }).finally(() => {
    // Clean up channel
    supabase.removeChannel(broadcastChannel).catch(() => {});
  });
}

// Trigger memory extraction if needed (fire-and-forget)
if (role === "assistant" && insertedMessage?.id) {
  shouldExtractMemory = true;
  const payload = {
    conversation_id: chat_id,
    message_id: insertedMessage.id,
    user_id: user_id
  };

  console.info(JSON.stringify({
    event: "memory_extraction_triggered",
    request_id: requestId,
    conversation_id: chat_id,
    message_id: insertedMessage.id
  }));

  Promise.resolve().then(() =>
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
    })
  );
}

// Flush logs before returning response
await new Promise(r => setTimeout(r, 50));

// Return immediately (no await, both operations already non-blocking)
console.info(JSON.stringify({
  event: "chat_send_response_returned",
  request_id: requestId,
  total_duration_ms: Date.now() - startTime,
  role,
  llm_started: shouldStartLLM,
  memory_extraction_started: shouldExtractMemory
}));

return json(200, {
message: role === "assistant" ? "Assistant message saved" : "User message saved",
saved: message,
llm_started: shouldStartLLM
});
});
