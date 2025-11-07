
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
    console.log("[swiss] Calling translator-edge with payload:", JSON.stringify(payload, null, 2));
    
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

    console.log("[swiss] translator-edge success:", data);
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

// Updated function to retrieve API key by email using direct query
async function getApiKeyByEmail(email: string): Promise<string | null> {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    console.log("[swiss] Invalid email format:", email);
    return null;
  }

  try {
    console.log("[swiss] Looking up API key for email:", email);
    
    const { data, error } = await sb
      .from("api_keys")
      .select("api_key")
      .eq("email", email)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !data) {
      console.log("[swiss] No active API key found for email:", email, error);
      return null;
    }

    console.log("[swiss] Found API key for email:", email);
    return data.api_key;
  } catch (err) {
    console.error("[swiss] Error during API key lookup:", err);
    return null;
  }
}

Deno.serve(async (req) => {
  const urlObj = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!["GET", "POST"].includes(req.method)) {
    return json({ success: false, message: "Method not allowed" }, 405);
  }

  // LOG: Capture raw request details before any processing
  console.log("[swiss] 📥 RAW REQUEST RECEIVED:");
  console.log("[swiss] 📥 Method:", req.method);
  console.log("[swiss] 📥 URL:", req.url);
  console.log("[swiss] 📥 Headers:", Object.fromEntries(req.headers.entries()));

  let bodyJson: Record<string, unknown> | undefined;
  let rawBodyText = "";
  if (req.method === "POST") {
    const raw = await req.arrayBuffer();
    if (raw.byteLength) {
      rawBodyText = new TextDecoder().decode(raw);
      console.log("[swiss] 📥 RAW BODY TEXT:", rawBodyText);
      
      try {
        bodyJson = JSON.parse(rawBodyText);
        console.log("[swiss] 📥 PARSED BODY JSON:", bodyJson);
      } catch (parseError) {
        console.log("[swiss] 📥 BODY PARSE ERROR:", parseError);
        console.log("[swiss] 📥 Raw body was not valid JSON, treating as text");
      }
    } else {
      console.log("[swiss] 📥 Empty request body");
    }
  }

  // LOG: URL parameters
  console.log("[swiss] 📥 URL PARAMETERS:", Object.fromEntries(urlObj.searchParams.entries()));

  // Try to extract API key using standard methods
  let apiKey = extractApiKey(req.headers, urlObj, bodyJson);
  let authMethod = "api_key";
  
  // If no API key found but email is provided, try to look up API key by email
  if (!apiKey && bodyJson?.email) {
    console.log("[swiss] No API key found, trying email lookup with:", bodyJson.email);
    apiKey = await getApiKeyByEmail(String(bodyJson.email));
    if (apiKey) {
      console.log("[swiss] Successfully authenticated via email");
      authMethod = "email";
    }
  }

  // If still no API key, return unauthorized
  if (!apiKey) {
    return json({ 
      success: false, 
      message: "Authentication required. Please provide an API key or valid email." 
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

  console.log("[swiss] 🔍 Raw balance query response:");
  console.log("[swiss] 🔍 - data:", row);
  console.log("[swiss] 🔍 - error:", error);

  if (error) {
    console.error("[swiss] ❌ Balance lookup query failed:", error);
    return json({ success: false, message: "Balance lookup failed." }, 500);
  }

  if (!row) {
    console.log("[swiss] ❌ No row returned from v_api_key_balance for API key:", apiKey);
    return json({
      success: false,
      message: "Invalid API key. Log in at theraiapi.com to check your credentials.",
    }, 401);
  }

  console.log("[swiss] 🔍 Found user_id:", row.user_id);
  console.log("[swiss] 🔍 Raw balance_usd from DB:", row.balance_usd);
  console.log("[swiss] 🔍 Type of balance_usd:", typeof row.balance_usd);

  const balance = parseFloat(String(row.balance_usd));
  console.log("[swiss] 🔍 Parsed balance:", balance);
  console.log("[swiss] 🔍 Is balance finite?", Number.isFinite(balance));
  console.log("[swiss] 🔍 Balance > 0?", balance > 0);

  if (!Number.isFinite(balance) || balance <= 0) {
    console.log("[swiss] ❌ Insufficient balance - User:", row.user_id, "Balance:", balance);
    return json({
      success: false,
      message: `Your account is active, but your balance is $${balance}. Please top up to continue.`,
    }, 402);
  }

  console.log("[swiss] ✅ Balance check passed - User:", row.user_id, "Balance:", balance);

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

  // ⭐ [SWISS] Debug logging for user_id type checking
  console.log('⭐ [SWISS] payload_debug', {
    database_user_id: row.user_id,
    database_user_id_type: typeof row.user_id,
    bodyJson_user_id: bodyJson?.user_id,
    bodyJson_user_id_type: typeof bodyJson?.user_id,
    url_params_user_id: urlObj.searchParams.get('user_id'),
    url_params_user_id_type: typeof urlObj.searchParams.get('user_id'),
    final_user_id: mergedPayload.user_id,
    final_user_id_type: typeof mergedPayload.user_id,
    file: "swiss/index.ts:200",
    function: "serve"
  });

  // Special handling for email-based requests - FIXED LOGIC
  if (authMethod === "email" && bodyJson?.body) {
    console.log("[swiss] Processing email payload with body:", bodyJson.body);
    
    try {
      // Try to parse the email body as JSON
      const parsedEmailBody = JSON.parse(String(bodyJson.body));
      console.log("[swiss] Successfully parsed email body as JSON:", parsedEmailBody);
      
      // Replace the entire payload with the parsed JSON (except for system fields)
      Object.assign(mergedPayload, parsedEmailBody);
      
      // Remove the original body field as we've now extracted its content
      (mergedPayload as any).body = undefined;
      delete (mergedPayload as any).body;
      
      console.log("[swiss] Final email payload after JSON parsing:", mergedPayload);
    } catch (parseError) {
      console.log("[swiss] Email body is not valid JSON, treating as plain text request");
      // Fall back to current behavior if not valid JSON
      (mergedPayload as any).request = String(bodyJson.body);
      (mergedPayload as any).body = undefined;
      delete (mergedPayload as any).body;
    }
  }

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
