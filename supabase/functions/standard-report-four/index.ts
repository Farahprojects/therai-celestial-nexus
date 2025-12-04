/* eslint-disable no-console */

/*─────────────────────Made──────────────────────────────────────────────────────────
  standard-report-for.ts
  Edge Function: Generates standard reports using Google's Gemini 2.5 Flash Preview model
  Uses system prompts from the reports_prompts table
  Enhanced for production readiness with retries, timeouts, and structured logging.
────────────────────────────────────────────────────────────────────────────────*/
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/*───────────────────────────────────────────────────────────────────────────────
  CONFIG & SINGLETONS
───────────────────────────────────────────────────────────────────────────────*/
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GOOGLE_API_KEY = Deno.env.get("GOOGLE_SR");
if (!GOOGLE_API_KEY) {
  throw new Error("Missing env: GOOGLE_SR");
}

// Production Readiness Configuration
const MAX_API_RETRIES = parseInt(Deno.env.get("MAX_API_RETRIES") || "3");
const INITIAL_RETRY_DELAY_MS = parseInt(Deno.env.get("INITIAL_RETRY_DELAY_MS") || "1000");
const RETRY_BACKOFF_FACTOR = parseFloat(Deno.env.get("RETRY_BACKOFF_FACTOR") || "2");
const API_TIMEOUT_MS = parseInt(Deno.env.get("API_TIMEOUT_MS") || "30000"); 
const MAX_DB_RETRIES = parseInt(Deno.env.get("MAX_DB_RETRIES") || "2");


if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error("Missing required Supabase environment variables");
}

if (!GOOGLE_API_KEY) {
  throw new Error("Missing Google API key");
}

// Initialize Supabase client
let supabase: SupabaseClient;
try {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
} catch (err) {
  throw err;
}

const GOOGLE_MODEL = "gemini-2.5-flash";
const GOOGLE_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_MODEL}:generateContent`;

// Simple in-memory cache for system prompts
const promptCache = new Map<string, string>();

// CORS headers for cross-domain requests
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '600',
  'Content-Type': 'application/json',
};

/*───────────────────────────────────────────────────────────────────────────────
  UTILS
───────────────────────────────────────────────────────────────────────────────*/
function jsonResponse(body: unknown, init: ResponseInit = {}, requestId?: string): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
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
      if ((error as any).skipRetry) {
        throw error;
      }
      if (attempts >= maxAttempts) {
        throw error; // Re-throw the last error
      }
      // Add jitter: delay +/- 20% of delay
      const jitter = delay * 0.2 * (Math.random() > 0.5 ? 1 : -1);
      const actualDelay = Math.max(0, delay + jitter); // Ensure delay is not negative
      await new Promise(resolve => setTimeout(resolve, actualDelay));
      delay *= backoffFactor;
    }
  }
  // This line should theoretically be unreachable due to the throw in the catch block
  throw new Error(`${logPrefix} Retry logic error for ${operationName}: exceeded max attempts without throwing.`);
}

// Fetch the system prompt from the reports_prompts table - now accepts reportType parameter
async function getSystemPrompt(reportType: string, requestId: string): Promise<string> {
  const logPrefix = `[standard-report-for][${requestId}]`;
  
  // 1. Check cache first
  if (promptCache.has(reportType)) {
    console.log(`${logPrefix} Cache HIT for system prompt: ${reportType}`);
    return promptCache.get(reportType)!;
  }
  
  console.log(`${logPrefix} Cache MISS for system prompt: ${reportType}. Fetching from DB.`);

  const fetchPrompt = async () => {
    const { data, error, status } = await supabase
      .from("report_prompts")
      .select("system_prompt")
      .eq("name", reportType)
      .maybeSingle();

    if (error) {
      if (status === 401 || status === 403 || status === 404) { // Non-retryable DB errors
         throw Object.assign(new Error(`Non-retryable DB error fetching system prompt (${status}): ${error.message}`), { skipRetry: true });
      }
      throw new Error(`Failed to fetch system prompt (status ${status}): ${error.message}`);
    }

    if (!data || !data.system_prompt) {
      throw Object.assign(new Error(`System prompt not found for ${reportType} report`), { skipRetry: true });
    }
    
    // 2. Store in cache on successful fetch
    promptCache.set(reportType, data.system_prompt);
    console.log(`${logPrefix} Stored system prompt in cache: ${reportType}`);

    return data.system_prompt;
  };

  try {
    return await retryWithBackoff(fetchPrompt, logPrefix, MAX_DB_RETRIES, 500, 2, "database system prompt fetch");
  } catch (err) {
    throw err; // Propagate the error to be handled by the main handler
  }
}

// Generate report using Gemini API
async function generateReport(systemPrompt: string, reportData: any, requestId: string): Promise<{ report: string; metadata: any }> {
  const logPrefix = `[standard-report-for][${requestId}]`;

  // Structure data for the prompt. The AI will get the full chartData.
  const userMessage = JSON.stringify({
    chartData: reportData.chartData,
    endpoint: reportData.endpoint,
    report_type: reportData.report_type,
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
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
      thinkingConfig: {
        thinkingBudget: 0
      }
    }
  };

  const callGeminiApi = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        controller.abort();
    }, API_TIMEOUT_MS);

    let response;
    try {
        response = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
        });
    } catch (fetchError) {
        // This catch is primarily for network errors or if AbortController aborts
        clearTimeout(timeoutId);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
            throw new Error(`Gemini API call aborted due to timeout (${API_TIMEOUT_MS}ms)`);
        }
        throw fetchError; // Re-throw other fetch errors
    }
    
    clearTimeout(timeoutId); // Clear timeout if fetch completed

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(`Gemini API error: ${response.status} - ${errorText}`);
      (error as any).status = response.status;
      if (response.status === 400 || response.status === 404 || response.status === 401 || response.status === 403) {
        throw Object.assign(error, { skipRetry: true });
      }
      throw error;
    }

    const data = await response.json();

    if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content || !data.candidates[0].content.parts || data.candidates[0].content.parts.length === 0) {
      throw new Error("Malformed response from Gemini API: No content/parts in candidate");
    }

    const generatedText = data.candidates[0].content.parts[0].text;
    
    // Collect AI metadata only
    const metadata = {
      token_count: data.usageMetadata?.totalTokenCount || 0,
      prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
      completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
      model: GOOGLE_MODEL
    };
    
    return { report: generatedText, metadata };
  };

  try {
    return await retryWithBackoff(callGeminiApi, logPrefix, MAX_API_RETRIES, INITIAL_RETRY_DELAY_MS, RETRY_BACKOFF_FACTOR, "Gemini API call");
  } catch (err) {
    if ((err as any).skipRetry) {
        throw new Error(`Permanent Gemini API error: ${(err as any).message}`);
    }
    throw err; // Propagate other errors
  }
}

// Fire-and-forget logging and signaling
function logAndSignalCompletion(logPrefix: string, reportData: any, report: string, metadata: any, durationMs: number, selectedEngine: string) {
  // Fire-and-forget report_logs insert
  supabase.from("report_logs").insert({
    chat_id: reportData.chat_id || reportData.user_id || null,
    report_type: reportData.reportType || reportData.report_type || "standard",
    endpoint: reportData.endpoint,
    report_text: report,
    status: "success",
    duration_ms: durationMs,
    engine_used: selectedEngine,
    metadata: metadata,
    created_at: new Date().toISOString(),
  })
  .then(null, (error) => {
      console.error(`${logPrefix} Report log insert failed:`, {
        error: error,
        user_id: reportData.user_id,
        report_type: reportData.reportType || reportData.report_type
      });
  });
  
  // Fire-and-forget insights table update for insight mode reports
  if (reportData.mode === 'insight' && reportData.chat_id) {
    supabase.from("insights")
      .update({ 
        is_ready: true,
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', reportData.chat_id)
      .then(({ error }) => {
        if (error) {
          console.error(`${logPrefix} Insights update failed:`, error);
        } else {
          console.log(`${logPrefix} Insights table updated`);
        }
      });
  }
  
  // Fire-and-forget context-injector call for insight mode reports
  if (reportData.mode === 'insight' && reportData.chat_id && report) {
    console.log(`${logPrefix} Calling context-injector to inject report text`);
    supabase.functions.invoke('context-injector', {
      body: {
        chat_id: reportData.chat_id,
        mode: reportData.mode,
        report_text: report,
        injection_type: 'report'
      }
    })
    .then(({ data, error }) => {
      if (error) {
        console.error(`${logPrefix} Context-injector failed:`, error);
      } else {
        console.log(`${logPrefix} Context-injector completed successfully`);
      }
    })
    .catch((err) => {
      console.error(`${logPrefix} Context-injector error:`, err);
    });
  }
}

// Main handler function
Deno.serve(async (req) => {
  let reportData: any; // Define here to be accessible in catch block
  const requestId = crypto.randomUUID().substring(0, 8); // Short unique ID for this request
  const logPrefix = `[standard-report-four][${requestId}]`;
  const startTime = Date.now();

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Only accept POST requests
  if (req.method !== "POST") {
    return jsonResponse(
      { error: "Method not allowed", requestId },
      { status: 405 },
      requestId
    );
  }

  try {
    // Parse the request payload
    reportData = await req.json();
    
    // Extract the report type from the payload (either reportType or report_type)
    const reportType = reportData.reportType || reportData.report_type || "standard";
    const systemPromptType = reportData.system_prompt_type || 'adult'; // Default to 'adult'
    const selectedEngine = reportData.selectedEngine || "standard-report-four";

    // ✅ LOGGING: Initial request received
    console.log(`${logPrefix} Request received:`, {
      report_type: reportType,
      user_id: reportData.user_id,
      endpoint: reportData.endpoint
    });

    // Validate required fields
    if (!reportData || !reportData.chartData || !reportData.endpoint) {
      return jsonResponse(
        { error: "Missing required fields: chartData and endpoint are required", requestId },
        { status: 400 },
        requestId
      );
    }

    // Determine the prompt name based on the system_prompt_type
    const promptName = systemPromptType === 'child' ? `${reportType}_child` : reportType;

    // Fetch the system prompt using the dynamic report type
    const systemPrompt = await getSystemPrompt(promptName, requestId);

    // Generate the report
    const { report, metadata } = await generateReport(systemPrompt, reportData, requestId);
    
    // Log successful report generation (fire-and-forget)
    const durationMs = Date.now() - startTime;
    logAndSignalCompletion(logPrefix, reportData, report, metadata, durationMs, selectedEngine);
    
    // ✅ LOGGING: Final response being sent
    console.log(`${logPrefix} Request processing complete. Sending success response.`);

    // Return the generated report with proper structure
    return jsonResponse({
      success: true,
      report: {
        title: `${reportType} ${reportData.endpoint} Report`,
        content: report,
        generated_at: new Date().toISOString(),
        engine_used: selectedEngine
      },
      requestId
    }, {}, requestId);

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
    
    // ✅ LOGGING: Main handler error
    console.error(`${logPrefix} Main handler error:`, {
      report_type: reportData?.reportType || reportData?.report_type,
      user_id: reportData?.user_id,
      error: errorMessage,
      duration_ms: Date.now() - startTime
    });
    
    // Log error to report_logs (fire-and-forget)
    const durationMs = Date.now() - startTime;
    
    supabase.from("report_logs").insert({
      user_id: reportData?.user_id || null,
      report_type: reportData?.reportType || reportData?.report_type || null,
      endpoint: reportData?.endpoint || null,
      report_text: null,
      status: "error",
      error_message: errorMessage,
      duration_ms: durationMs,
      engine_used: reportData?.selectedEngine || "standard-report-four",
      created_at: new Date().toISOString(),
    })
    .then(() => console.log(`${logPrefix} Logged error to report_logs.`));
    
    return jsonResponse({
      success: false,
      error: errorMessage,
      details: err instanceof Error && (err as any).details ? (err as any).details : undefined,
      requestId
    }, { status: 500 }, requestId);
  }
});
