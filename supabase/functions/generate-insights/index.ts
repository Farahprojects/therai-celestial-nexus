

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MAX_API_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const RETRY_BACKOFF_FACTOR = 2;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function jsonResponse(body: unknown, init: ResponseInit = {}, requestId?: string): Response {
  if (init.status && init.status >= 400) {
    console.error(`[${requestId}] Error response: ${init.status}`, body);
  }
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function validateApiKey(apiKey: string, requestId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("api_keys")
      .select("user_id, is_active")
      .eq("api_key", apiKey)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !data) {
      console.error(`[${requestId}] API key validation failed`);
      return null;
    }

    return data.user_id;
  } catch (err) {
    console.error(`[${requestId}] API key validation error:`, err);
    return null;
  }
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  logPrefix: string,
  maxAttempts = MAX_API_RETRIES,
  initialDelayMs = INITIAL_RETRY_DELAY_MS,
  backoffFactor = RETRY_BACKOFF_FACTOR,
  operationName = "API call"
): Promise<T> {
  let attempts = 0;
  let delay = initialDelayMs;
  while (attempts < maxAttempts) {
    attempts++;
    try {
      return await fn();
    } catch (error) {
      if (attempts >= maxAttempts) {
        console.error(`${logPrefix} ${operationName} failed after ${maxAttempts} attempts:`, error);
        throw error;
      }
      const jitter = delay * 0.2 * (Math.random() > 0.5 ? 1 : -1);
      const actualDelay = Math.max(0, delay + jitter);
      await new Promise(resolve => setTimeout(resolve, actualDelay));
      delay *= backoffFactor;
    }
  }
  throw new Error(`${logPrefix} Retry logic error for ${operationName}`);
}

async function getInsightPrice(requestId: string): Promise<number> {
  const fetchPrice = async () => {
    const { data, error } = await supabase
      .from("price_list")
      .select("unit_price_usd")
      .eq("id", "insights-generation")
      .maybeSingle();

    if (error || data?.unit_price_usd == null) {
      return 7.50; // fallback price
    }

    return parseFloat(String(data.unit_price_usd));
  };

  try {
    return await retryWithBackoff(fetchPrice, `[${requestId}]`, 2, 500, 2, "price fetch");
  } catch (err) {
    console.error(`[${requestId}] Price fetch failed, using fallback:`, err);
    return 7.50;
  }
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().substring(0, 8);
  const startTime = Date.now();

  console.log(`[${requestId}] ${req.method} request received`);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { error: "Method not allowed", requestId },
      { status: 405 },
      requestId
    );
  }

  try {
    // Extract and validate API key
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse(
        { error: "Missing or invalid Authorization header", requestId },
        { status: 401 },
        requestId
      );
    }

    const apiKey = authHeader.replace("Bearer ", "");
    const userId = await validateApiKey(apiKey, requestId);
    if (!userId) {
      return jsonResponse(
        { error: "Invalid API key", requestId },
        { status: 401 },
        requestId
      );
    }

    // Parse request body
    let payload;
    try {
      const rawBody = await req.text();
      if (!rawBody) {
        return jsonResponse({
          error: "Request body is empty",
          requestId
        }, { status: 400 }, requestId);
      }
      payload = JSON.parse(rawBody);
    } catch (error) {
      return jsonResponse({
        error: "Failed to parse request body",
        details: error instanceof Error ? error.message : String(error),
        requestId
      }, { status: 400 }, requestId);
    }

    const { clientId, coachId, insightType, clientData, title } = payload;

    if (!clientId || !coachId || !insightType || !clientData || !title) {
      return jsonResponse(
        { error: "Missing required fields: clientId, coachId, insightType, clientData, and title are required", requestId },
        { status: 400 },
        requestId
      );
    }

    // Set request-scoped coach ID for RLS
    await supabase.rpc('set_config', {
      key: 'request.coach_id',
      value: coachId,
      is_local: true
    });

    console.log(`[${requestId}] Processing insight generation for client: ${clientId}`);
    console.log(`[${requestId}] Data types available:`, {
      hasJournalText: !!clientData.journalText,
      hasReportTexts: !!clientData.previousReportTexts,
      hasAstroData: !!clientData.previousAstroDataText
    });

    const insightId = crypto.randomUUID();

    // Extract journal text for chartData payload
    const journalText = clientData.journalText || 'No journal entries available.';

    // Initialize insight record (tracks status + folder linkage)
    const { error: insertError } = await supabase
      .from('insights')
      .insert({
        id: insightId,
        user_id: coachId,
        report_type: insightType,
        status: 'processing',
        is_ready: false,
        folder_id: payload.folderId ?? null,
        metadata: {
          title,
          clientId,
          coachId,
          source: 'generate-insights-edge'
        }
      });

    if (insertError) {
      console.error(`[${requestId}] Failed to initialize insight record:`, insertError);
      throw new Error('Failed to initialize insight tracking record');
    }

    const chartData = {
      clientId,
      coachId,
      title,
      insightType,
      folderId: payload.folderId ?? null,
      clientData: {
        fullName: clientData.fullName,
        goals: clientData.goals,
        journalText,
        previousReportTexts: clientData.previousReportTexts,
        previousAstroDataText: clientData.previousAstroDataText
      }
    };

    const orchestratorPayload = {
      endpoint: 'insight',
      report_type: insightType,
      chat_id: insightId,
      user_id: coachId,
      chartData,
      mode: 'insight'
    };

    const { data: orchestratorData, error: orchestratorError } = await supabase.functions.invoke('report-orchestrator', {
      body: orchestratorPayload
    });

    if (orchestratorError) {
      console.error(`[${requestId}] Report-orchestrator error:`, orchestratorError);
      throw new Error(orchestratorError.message || 'Failed to schedule insight generation');
    }

    // Record API usage
    try {
      const costUsd = await getInsightPrice(requestId);
      
      const { error: usageError } = await supabase.rpc('record_api_usage', {
        _user_id: userId,
        _endpoint: 'generate-insights',
        _cost_usd: costUsd,
        _request_params: { insightType, clientId },
        _response_status: 202,
        _processing_time_ms: Date.now() - startTime
      });

      if (usageError) {
        console.error(`[${requestId}] API usage recording failed:`, usageError);
      }
    } catch (usageErr) {
      console.error(`[${requestId}] API usage recording error:`, usageErr);
    }

    console.log(`[${requestId}] Insight generation scheduled via report-orchestrator in ${Date.now() - startTime}ms`);
    return jsonResponse({
      success: true,
      insightId,
      status: 'processing',
      orchestrator: orchestratorData,
      requestId
    }, {}, requestId);

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
    console.error(`[${requestId}] Request failed: ${errorMessage}`);
    
    return jsonResponse({
      success: false,
      error: errorMessage,
      requestId
    }, { status: 500 }, requestId);
  }
});

console.log(`[generate-insights] Function initialized and ready`);
