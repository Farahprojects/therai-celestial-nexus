// check-rate-limit.ts
// Dedicated rate limit checking for frontend calls
// Prevents chat-send from being called when limits are exceeded

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

import { createPooledClient } from "../_shared/supabaseClient.ts";
import { checkLimit, incrementUsage } from "../_shared/limitChecker.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin"
} as Record<string, string>;

const JSON_RESPONSE = (status: number, payload: any) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
  });

/* ----------------------------- Configuration ----------------------------- */
const ENV = {
  SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
};

if (!ENV.SUPABASE_URL) throw new Error("Missing env: SUPABASE_URL");
if (!ENV.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");

/* ----------------------------- Supabase client --------------------------- */
const supabase = createPooledClient();

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

  const { user_id, action = "chat", increment = false } = body || {};

  if (!user_id || typeof user_id !== "string") {
    return JSON_RESPONSE(400, { error: "Missing or invalid field: user_id" });
  }

  // Validate action type
  const validActions = ["chat", "image_generation"];
  if (!validActions.includes(action)) {
    return JSON_RESPONSE(400, { error: "Invalid action. Must be 'chat' or 'image_generation'" });
  }

  console.info(JSON.stringify({
    event: "rate_limit_check",
    id: requestId,
    user_id,
    action,
    timestamp: new Date().toISOString()
  }));

  try {
    // Check rate limit
    const limitCheck = await checkLimit(supabase, user_id, action, 1);

    if (!limitCheck.allowed) {
      const limitMessage = limitCheck.error_code === 'TRIAL_EXPIRED'
        ? "Your free trial has ended. Upgrade to Growth ($10/month) for unlimited AI conversations! 🚀"
        : `You've used your ${limitCheck.limit} free messages today. Upgrade to Growth for unlimited chats!`;

      console.info(JSON.stringify({
        event: "rate_limit_exceeded",
        id: requestId,
        user_id,
        action,
        limit: limitCheck.limit,
        error_code: limitCheck.error_code,
        total_latency_ms: Date.now() - startMs
      }));

      return JSON_RESPONSE(200, {
        allowed: false,
        message: limitMessage,
        limit: limitCheck.limit,
        error_code: limitCheck.error_code,
        total_latency_ms: Date.now() - startMs
      });
    }

    // Increment usage if requested (fire-and-forget, non-blocking)
    if (increment && user_id) {
      void incrementUsage(supabase, user_id, action, 1).catch((error) => {
        console.error("[increment] failed:", error);
      });
    }

    console.info(JSON.stringify({
      event: "rate_limit_allowed",
      id: requestId,
      user_id,
      action,
      remaining: limitCheck.remaining,
      incremented: increment,
      total_latency_ms: Date.now() - startMs
    }));

    return JSON_RESPONSE(200, {
      allowed: true,
      remaining: limitCheck.remaining,
      limit: limitCheck.limit,
      incremented: increment,
      total_latency_ms: Date.now() - startMs
    });

  } catch (err) {
    console.error(JSON.stringify({
      event: "rate_limit_check_error",
      id: requestId,
      user_id,
      action,
      error: (err as any)?.message || err,
      total_latency_ms: Date.now() - startMs
    }));

    return JSON_RESPONSE(500, {
      error: "Rate limit check failed",
      total_latency_ms: Date.now() - startMs
    });
  }
});
