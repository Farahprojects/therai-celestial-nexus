
import { createPooledClient } from "../_shared/supabaseClient.ts";

// Initialize Supabase client with connection pooling
const sb = createPooledClient();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-api-key, apikey, authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

// Helper function to call the new translator-edge function
async function translateViaEdge(payload: any): Promise<{ status: number; text: string }> {
  try {
    const { data, error } = await sb.functions.invoke('translator-edge', {
      body: payload
    });

    if (error) {
      console.error("[swiss] translator-edge error:", error);
      return {
        status: 500,
        text: JSON.stringify({ error: error.message || 'Translation failed' })
      };
    }

    return {
      status: 200,
      text: typeof data === 'string' ? data : JSON.stringify(data)
    };
  } catch (err) {
    console.error("[swiss] translator-edge exception:", err);
    return {
      status: 500,
      text: JSON.stringify({ error: 'Translation service unavailable' })
    };
  }
}

// Log helper function that writes to swissdebuglogs table (lowercase)
async function logSwissDebug(request: any, responseStatus: number, responseText: string) {
  try {

    const logData = {
      api_key: request.apiKey,
      user_id: request.userId,
      balance_usd: request.balance,
      request_type: request.requestType,
      request_payload: request.payload,
      response_status: responseStatus
    };

    // Insert log data into swissdebuglogs table (lowercase)
    await sb.from("swissdebuglogs").insert([logData]);
  } catch (err) {
    console.error("[swissdebuglogs] Failed to write log:", err);
  }
}

// Function to extract API key from request
function extractApiKey(headers: Headers, url: URL, body?: Record<string, unknown>): string | null {
  const auth = headers.get("authorization");
  if (auth) {
    const match = auth.match(/^Bearer\s+(.+)$/i);
    const token = match ? match[1] : auth;
    if (token && token.length > 16) return token;
  }

  const h1 = headers.get("x-api-key") || headers.get("apikey");
  if (h1 && h1.length > 16) return h1;

  const qp = url.searchParams.get("api_key");
  if (qp && qp.length > 16) return qp;

  if (body?.api_key && String(body.api_key).length > 16) return String(body.api_key);

  return null;
}

Deno.serve(async (req) => {
  const urlObj = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!["GET", "POST"].includes(req.method)) {
    return json({ success: false, message: "Method not allowed" }, 405);
  }

  let bodyJson: Record<string, unknown> | undefined;
  let rawBodyText = "";
  if (req.method === "POST") {
    const raw = await req.arrayBuffer();
    if (raw.byteLength) {
      rawBodyText = new TextDecoder().decode(raw);

      try {
        bodyJson = JSON.parse(rawBodyText);
      } catch (parseError) {
        // Raw body was not valid JSON, treating as text
      }
    }
  }

  // Try to extract API key using standard methods
  const apiKey = extractApiKey(req.headers, urlObj, bodyJson);
  const authMethod = "api_key";

  // If still no API key, return unauthorized
  if (!apiKey) {
    return json({
      success: false,
      message: "Authentication required. Please provide a valid API key or Bearer token."
    }, 401);
  }

  // DETAILED BALANCE LOOKUP LOGGING
  console.log("[swiss] 🔍 Starting balance lookup with API key:", apiKey);
  console.log("[swiss] 🔍 Auth method:", authMethod);
  console.log("[swiss] 🔍 Using v_api_key_balance view to get balance");

  // Proceed with balance check using the API key (regardless of how it was obtained)
  const { data: row, error } = await sb
    .from("v_api_key_balance")
    .select("user_id, balance_usd")
    .eq("api_key", apiKey)
    .maybeSingle();

  if (error) {
    console.error("[swiss] ❌ Balance lookup query failed:", error);
    return json({ success: false, message: "Balance lookup failed." }, 500);
  }

  if (!row) {
    return json({
      success: false,
      message: "Invalid API key. Log in at theraiapi.com to check your credentials.",
    }, 401);
  }

  const balance = parseFloat(String(row.balance_usd));

  if (!Number.isFinite(balance) || balance <= 0) {
    return json({
      success: false,
      message: `Your account is active, but your balance is $${balance}. Please top up to continue.`,
    }, 402);
  }

  urlObj.searchParams.delete("api_key");

  // Sanitize and validate URL parameters to prevent injection
  const sanitizedUrlParams: Record<string, string> = {};
  const allowedParams = ['request', 'date', 'time', 'location', 'name', 'latitude', 'longitude', 'tz', 'house_system', 'year', 'return_date'];

  for (const [key, value] of urlObj.searchParams.entries()) {
    if (allowedParams.includes(key) && typeof value === 'string') {
      // Sanitize parameter values
      const sanitizedValue = value.trim().slice(0, 1000); // Limit length
      if (sanitizedValue.length > 0) {
        sanitizedUrlParams[key] = sanitizedValue;
      }
    }
  }

  // Create the merged payload from URL parameters and body
  const mergedPayload = {
    ...(bodyJson ?? {}),
    ...sanitizedUrlParams,
    user_id: row.user_id,
    api_key: apiKey,
    auth_method: authMethod,
  };


  // Use the new translator-edge function instead of the old translate function
  const { status, text } = await translateViaEdge(mergedPayload);

  // Log ALL Swiss API requests to swissdebuglogs (fire-and-forget)
  logSwissDebug({
    apiKey,
    userId: row.user_id,
    balance,
    requestType: (mergedPayload as any).request || "unknown",
    payload: mergedPayload
  }, status, text).catch((err: unknown) => console.error("[swiss] Logging failed:", err));

  return new Response(text, { status, headers: corsHeaders });
});
