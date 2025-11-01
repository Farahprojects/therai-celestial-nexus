// Simplified, production-ready version
// - Uses Deno.serve (no std/http dependency)
// - Validates input and fails fast on missing env vars
// - Single path for saving messages (role inferred)
// - Awaits DB insert; fires LLM call asynchronously when needed
// - Consistent JSON responses and CORS handling
// - Dynamically routes to correct LLM handler based on system config

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getLLMHandler } from "../_shared/llmConfig.ts";
import { checkSubscriptionAccess, checkPremiumAccess } from "../_shared/subscriptionCheck.ts";

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
console.log("[chat-send] ⏱️  Request received");

if (req.method === "OPTIONS") {
return new Response("ok", { headers: corsHeaders });
}

if (req.method !== "POST") {
return json(405, { error: "Method not allowed" });
}

let body;
try {
body = await req.json();
console.log(`[chat-send] ⏱️  JSON parsed (+${Date.now() - startTime}ms)`);
} catch {
return json(400, { error: "Invalid JSON body" });
}

const {
chat_id,
text,
client_msg_id,
mode,
chattype,
role: rawRole,
user_id,
user_name
} = body || {};

if (!chat_id || typeof chat_id !== "string") {
return json(400, { error: "Missing or invalid field: chat_id" });
}
if (!text || typeof text !== "string") {
return json(400, { error: "Missing or invalid field: text" });
}
if (!mode || typeof mode !== "string") {
return json(400, { error: "Missing or invalid field: mode" });
}

const role = rawRole === "assistant" ? "assistant" : "user";

// 🔒 SECURITY: Verify user authentication and subscription for user messages
if (role === "user" && user_id) {
  // Verify JWT token from Authorization header
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json(401, { error: "Missing Authorization header" });
  }

  try {
    // Create authenticated client to verify user
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
    if (!ANON_KEY) {
      console.error("[chat-send] Missing SUPABASE_ANON_KEY for auth verification");
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

    // Check subscription access
    const subscriptionCheck = await checkSubscriptionAccess(supabase, user_id);
    if (!subscriptionCheck.hasAccess) {
      return json(403, { 
        error: "Subscription required",
        subscription_required: true 
      });
    }

    // For voice chat, require premium plan
    if (chattype === "voice") {
      const premiumCheck = await checkPremiumAccess(supabase, user_id);
      if (!premiumCheck.hasAccess) {
        return json(403, { 
          error: "Premium plan required for voice features",
          premium_required: true 
        });
      }
    }
  } catch (err) {
    console.error("[chat-send] Auth/subscription check failed:", err);
    return json(500, { error: "Authentication check failed" });
  }
}

// Only check subscription for user messages (assistant messages are responses)
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
const shouldStartLLM = role === "user" && chattype !== "voice";
if (shouldStartLLM) {
const llmStartTime = Date.now();
console.log(`[chat-send] ⏱️  Determining LLM handler (+${Date.now() - startTime}ms)`);

console.info(JSON.stringify({
  event: "chat_send_calling_llm",
  chattype,
  chattype_type: typeof chattype,
  chattype_is_voice: chattype === "voice",
  should_start_llm: shouldStartLLM,
  role,
  mode
}));

// Get configured LLM handler
getLLMHandler(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).then((llmHandler) => {
  console.log(`[chat-send] ⏱️  Firing ${llmHandler} (+${Date.now() - startTime}ms)`);
  
  const payload = { chat_id, text, mode, user_id, user_name };
  
  console.info(JSON.stringify({
    event: "chat_send_llm_payload",
    llm_handler: llmHandler,
    payload_keys: Object.keys(payload),
    has_chattype: "chattype" in payload,
    chattype_in_payload: payload.chattype
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
  console.log(`[chat-send] ⏱️  LLM handler fetch completed (+${Date.now() - llmStartTime}ms from fire)`);
}).catch((err) => {
  console.error("[chat-send] LLM call failed:", err);
});
}

// ⚡ FIRE-AND-FORGET: DB insert (WebSocket + optimistic UI handle sync)
console.log(`[chat-send] ⏱️  Starting DB insert (+${Date.now() - startTime}ms)`);
supabase
.from("messages")
.insert(message)
.then(({ error }) => {
if (error) {
console.error("[chat-send] DB insert failed:", error);
} else {
console.log(`[chat-send] ⏱️  DB insert complete (+${Date.now() - startTime}ms)`);
}
});

// Return immediately (no await, both operations already non-blocking)
console.log(`[chat-send] ⏱️  Returning response (+${Date.now() - startTime}ms) TOTAL`);
return json(200, {
message: role === "assistant" ? "Assistant message saved" : "User message saved",
saved: message,
llm_started: shouldStartLLM
});
});
