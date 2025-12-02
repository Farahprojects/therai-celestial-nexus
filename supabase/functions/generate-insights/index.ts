

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY") ?? "";

const MAX_API_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const RETRY_BACKOFF_FACTOR = 2;
const API_TIMEOUT_MS = 90000;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const GOOGLE_MODEL = "gemini-2.5-flash-preview-04-17";
const GOOGLE_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_MODEL}:generateContent`;

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

async function getInsightPrompt(insightType: string, requestId: string): Promise<string> {
  const fetchPrompt = async () => {
    const { data, error } = await supabase
      .from("insight_prompts")
      .select("prompt_text")
      .eq("name", insightType)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !data?.prompt_text) {
      throw new Error(`Insight prompt not found for ${insightType}`);
    }
    
    return data.prompt_text;
  };

  return await retryWithBackoff(fetchPrompt, `[${requestId}]`, 2, 500, 2, "prompt fetch");
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

async function generateInsight(systemPrompt: string, clientData: any, requestId: string): Promise<string> {
  // Build user message sections dynamically based on available data
  const sections: string[] = [];
  
  // Always include client name and goals
  sections.push(`Client Name: ${clientData.fullName}`);
  sections.push(`Goals:\n${clientData.goals || 'No specific goals listed'}`);

  // Add journal entries if available
  if (clientData.journalText) {
    sections.push(`Journal Entries:\n${clientData.journalText}`);
  }

  // Add report texts if available
  if (clientData.previousReportTexts) {
    sections.push(`Previous Reports:\n${clientData.previousReportTexts}`);
  }

  // Add astrological data if available
  if (clientData.previousAstroDataText) {
    sections.push(`Previous Astrological Data:\n${clientData.previousAstroDataText}`);
  }

  const userMessage = sections.join('\n\n');

  console.log(`[${requestId}] User message sections included:`, {
    hasJournalText: !!clientData.journalText,
    hasReportTexts: !!clientData.previousReportTexts,
    hasAstroData: !!clientData.previousAstroDataText,
    sectionsCount: sections.length
  });

  const apiUrl = `${GOOGLE_ENDPOINT}?key=${GOOGLE_API_KEY}`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          { text: systemPrompt },
          { text: userMessage }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.3,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
    }
  };

  const callGeminiApi = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    let response;
    try {
        response = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
        });
    } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
            throw new Error(`Gemini API timeout (${API_TIMEOUT_MS}ms)`);
        }
        throw fetchError;
    }
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${requestId}] Gemini API error: ${response.status} - ${errorText}`);
      const error = new Error(`Gemini API error: ${response.status} - ${errorText}`);
      if (response.status === 400 || response.status === 404 || response.status === 401 || response.status === 403) {
        throw Object.assign(error, { skipRetry: true });
      }
      throw error;
    }

    const data = await response.json();

    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error("Malformed response from Gemini API");
    }

    return data.candidates[0].content.parts[0].text;
  };

  try {
    return await retryWithBackoff(callGeminiApi, `[${requestId}]`, MAX_API_RETRIES, INITIAL_RETRY_DELAY_MS, RETRY_BACKOFF_FACTOR, "Gemini API call");
  } catch (err) {
    console.error(`[${requestId}] Gemini API failed after retries:`, err);
    if ((err as any).skipRetry) {
        throw new Error(`Permanent Gemini API error: ${err instanceof Error ? err.message : String(err)}`);
    }
    throw err;
  }
}

async function saveInsightEntry(
  clientId: string,
  coachId: string,
  title: string,
  content: string,
  type: string,
  confidenceScore: number,
  requestId: string
): Promise<string> {
  const { data, error } = await supabase
    .from("insight_entries")
    .insert({
      client_id: clientId,
      coach_id: coachId,
      title: title,
      content: content,
      type: type,
      confidence_score: confidenceScore
    })
    .select('id')
    .single();

  if (error) {
    console.error(`[${requestId}] Save insight error:`, error);
    throw new Error(`Failed to save insight: ${error.message}`);
  }

  return data.id;
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

    // Fetch prompt and generate insight
    const systemPrompt = await getInsightPrompt(insightType, requestId);
    const insightContent = await generateInsight(systemPrompt, clientData, requestId);

    // Save insight entry
    const insightId = await saveInsightEntry(
      clientId,
      coachId,
      title,
      insightContent,
      insightType,
      85,
      requestId
    );

    console.log(`[${requestId}] Insight generated successfully in ${Date.now() - startTime}ms`);
    return jsonResponse({
      success: true,
      insightId: insightId,
      content: insightContent,
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
