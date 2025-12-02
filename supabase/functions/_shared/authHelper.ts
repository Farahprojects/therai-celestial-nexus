// ============================================================================
// AUTH HELPER - REUSABLE AUTH LAYER FOR EDGE FUNCTIONS
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSecureCorsHeaders } from "./secureCors.ts";

export interface AuthContext {
  isInternalCall: boolean;
  authHeader: string | null;
  userId: string | null; // from JWT, if present
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getAuthContext(req: Request): AuthContext {
  const INTERNAL_API_KEY = Deno.env.get("INTERNAL_API_KEY");
  const internalKey = req.headers.get("x-internal-key");
  const authHeader = req.headers.get("Authorization");
  // Also check if Authorization header contains service role key (backup for internal calls)
  // Format: "Bearer {SERVICE_ROLE_KEY}"
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const hasServiceRoleKey = authHeader && SUPABASE_SERVICE_ROLE_KEY && authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;

  const isInternalCall =
    (internalKey && INTERNAL_API_KEY && internalKey === INTERNAL_API_KEY) ||
    hasServiceRoleKey;

  return {
    isInternalCall: Boolean(isInternalCall),
    authHeader,
    userId: null, // will be filled in if we decode JWT
  };
}

export async function authenticateUserIfNeeded(
  authCtx: AuthContext,
  expectedUserId: string | null | undefined,
  requestId: string
): Promise<void> {
  if (!expectedUserId || authCtx.isInternalCall) return;

  if (!authCtx.authHeader) {
    throw new HttpError(401, "Missing Authorization header");
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!SUPABASE_URL) throw new Error("Missing env: SUPABASE_URL");
  if (!ANON_KEY) {
    console.error(JSON.stringify({ event: "missing_anon_key", request_id: requestId }));
    throw new HttpError(500, "Server configuration error");
  }

  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authCtx.authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: authError } = await authClient.auth.getUser();
  if (authError || !userData?.user) {
    throw new HttpError(401, "Invalid or expired token");
  }

  if (expectedUserId && userData.user.id !== expectedUserId) {
    throw new HttpError(403, "user_id mismatch");
  }

  authCtx.userId = userData.user.id;
}

export async function ensureConversationAccess(
  authCtx: AuthContext,
  chatId: string,
  requestId: string
): Promise<{ conversationExists: boolean; mode?: string }> {
  // internal calls can skip RLS check if you want
  if (authCtx.isInternalCall) {
    return { conversationExists: true };
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!SUPABASE_URL) throw new Error("Missing env: SUPABASE_URL");

  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authCtx.authHeader ?? "" } },
    auth: { persistSession: false },
  });

  // Combined query: get both existence and mode in one call
  const { data, error } = await authClient
    .from("conversations")
    .select("id, mode")
    .eq("id", chatId)
    .single();

  if (error || !data) {
    console.error(JSON.stringify({
      event: "unauthorized_access_attempt",
      request_id: requestId,
      chat_id: chatId,
      error: error?.message,
    }));
    return { conversationExists: false };
  }

  return {
    conversationExists: true,
    mode: data.mode
  };
}

export function parseJsonBody(req: Request): Promise<any> {
  return req.json().catch(() => {
    throw new HttpError(400, "Invalid JSON body");
  });
}

// ============================================================================
// MIDDLEWARE FUNCTIONS
// ============================================================================

/**
 * Auth middleware that validates user authentication and provides auth context
 */
export async function withAuth(
  req: Request,
  handler: (authCtx: AuthContext) => Promise<Response>
): Promise<Response> {
  try {
    const authCtx = getAuthContext(req);

    // For non-internal calls, validate the auth token
    if (!authCtx.isInternalCall) {
      await authenticateUserIfNeeded(authCtx, undefined, crypto.randomUUID().substring(0, 8));
    }

    return await handler(authCtx);
  } catch (err) {
    if (err instanceof HttpError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: err.status,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.error("Auth middleware error:", err);
    return new Response(JSON.stringify({ error: "Authentication failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * Auth middleware that validates conversation access
 */
export async function withConversationAuth(
  req: Request,
  chatId: string,
  handler: (authCtx: AuthContext, conversation: { conversationExists: boolean; mode?: string }) => Promise<Response>
): Promise<Response> {
  try {
    const authCtx = getAuthContext(req);

    // Authenticate user (skip for internal calls)
    if (!authCtx.isInternalCall) {
      await authenticateUserIfNeeded(authCtx, undefined, crypto.randomUUID().substring(0, 8));
    }

    // Check conversation access
    const conversationResult = await ensureConversationAccess(authCtx, chatId, crypto.randomUUID().substring(0, 8));

    return await handler(authCtx, conversationResult);
  } catch (err) {
    if (err instanceof HttpError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: err.status,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.error("Conversation auth middleware error:", err);
    return new Response(JSON.stringify({ error: "Authentication or access check failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * Standard CORS response for preflight requests
 */
export function handleCorsPreflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: getSecureCorsHeaders(req),
    });
  }
  return null;
}

/**
 * Wrap a handler with standard error handling and CORS
 */
export async function withStandardHandling(
  req: Request,
  handler: () => Promise<Response>
): Promise<Response> {
  // Handle CORS preflight
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) return corsResponse;

  try {
    const response = await handler();

    // Add CORS headers to the response
    const corsHeaders = getSecureCorsHeaders(req);
    const responseHeaders = new Headers(response.headers);

    Object.entries(corsHeaders).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: err.status,
        headers: {
          "Content-Type": "application/json",
          ...getSecureCorsHeaders(req),
        },
      });
    }

    console.error("Handler error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...getSecureCorsHeaders(req),
      },
    });
  }
}
