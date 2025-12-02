// ============================================================================
// AUTH HELPER - REUSABLE AUTH LAYER FOR EDGE FUNCTIONS
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
