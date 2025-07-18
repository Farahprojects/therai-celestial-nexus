
/*─────────────────────Made──────────────────────────────────────────────────────────
  standard-report.ts
  Edge Function: Generates standard reports using OpenAI's GPT-4o model
  Uses system prompts from the reports_prompts table
  Enhanced for production readiness with retries, timeouts, and structured logging.
────────────────────────────────────────────────────────────────────────────────*/
import "https://deno.land/x/xhr@0.1.0/mod.ts"; // fetch polyfill for Edge runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/*───────────────────────────────────────────────────────────────────────────────
  CONFIG & SINGLETONS
────────────────────────────────────────────────────────────────────────────────*/
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY_TWO") ?? "";

// Production Readiness Configuration
const MAX_API_RETRIES = parseInt(Deno.env.get("MAX_API_RETRIES") || "3");
const INITIAL_RETRY_DELAY_MS = parseInt(Deno.env.get("INITIAL_RETRY_DELAY_MS") || "1000");
const RETRY_BACKOFF_FACTOR = parseFloat(Deno.env.get("RETRY_BACKOFF_FACTOR") || "2");
const API_TIMEOUT_MS = parseInt(Deno.env.get("API_TIMEOUT_MS") || "90000"); 
const MAX_DB_RETRIES = parseInt(Deno.env.get("MAX_DB_RETRIES") || "2");

// Enhanced debugging for initialization
const LOG_PREFIX_INIT = "[standard-report][init]";
console.log(`${LOG_PREFIX_INIT} Edge function initializing with config:
- SUPABASE_URL: ${SUPABASE_URL ? "Exists (first 10 chars): " + SUPABASE_URL.substring(0, 10) + "..." : "MISSING"}
- SUPABASE_SERVICE_KEY: ${SUPABASE_SERVICE_KEY ? "Exists (length: " + SUPABASE_SERVICE_KEY.length + ")" : "MISSING"}
- OPENAI_API_KEY: ${OPENAI_API_KEY ? "Exists (length: " + OPENAI_API_KEY.length + ", starts with: " + OPENAI_API_KEY.substring(0, 4) + "...)" : "MISSING"}
- MAX_API_RETRIES: ${MAX_API_RETRIES}
- INITIAL_RETRY_DELAY_MS: ${INITIAL_RETRY_DELAY_MS}
- RETRY_BACKOFF_FACTOR: ${RETRY_BACKOFF_FACTOR}
- API_TIMEOUT_MS: ${API_TIMEOUT_MS}
- MAX_DB_RETRIES: ${MAX_DB_RETRIES}`);

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(`${LOG_PREFIX_INIT} Missing required Supabase environment variables`);
  throw new Error("Missing required Supabase environment variables");
}

if (!OPENAI_API_KEY) {
  console.error(`${LOG_PREFIX_INIT} Missing OpenAI API key`);
  throw new Error("Missing OpenAI API key");
}

// Initialize Supabase client
let supabase: SupabaseClient;
try {
  console.log(`${LOG_PREFIX_INIT} Creating Supabase client...`);
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  console.log(`${LOG_PREFIX_INIT} Supabase client created successfully`);
} catch (err) {
  console.error(`${LOG_PREFIX_INIT} Failed to create Supabase client:`, err);
  throw err;
}

const OPENAI_MODEL = "gpt-4o";
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

// CORS headers for cross-domain requests
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

/*───────────────────────────────────────────────────────────────────────────────
  UTILS
────────────────────────────────────────────────────────────────────────────────*/
function jsonResponse(body: unknown, init: ResponseInit = {}, requestId?: string): Response {
  const logPrefix = requestId ? `[standard-report][${requestId}]` : "[standard-report]";
  if (init.status && init.status >= 400) {
    console.error(`${logPrefix} Sending error response: ${init.status}`, body);
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
      console.log(`${logPrefix} Attempt ${attempts}/${maxAttempts} for ${operationName}...`);
      return await fn();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`${logPrefix} Attempt ${attempts}/${maxAttempts} for ${operationName} failed: ${errorMessage}.`);
      if (attempts >= maxAttempts) {
        console.error(`${logPrefix} All ${maxAttempts} attempts for ${operationName} failed. Last error:`, error);
        throw error; // Re-throw the last error
      }
      // Add jitter: delay +/- 20% of delay
      const jitter = delay * 0.2 * (Math.random() > 0.5 ? 1 : -1);
      const actualDelay = Math.max(0, delay + jitter); // Ensure delay is not negative
      console.log(`${logPrefix} Retrying ${operationName} in ${actualDelay.toFixed(0)}ms...`);
      await new Promise(resolve => setTimeout(resolve, actualDelay));
      delay *= backoffFactor;
    }
  }
  // This line should theoretically be unreachable due to the throw in the catch block
  throw new Error(`${logPrefix} Retry logic error for ${operationName}: exceeded max attempts without throwing.`);
}

// Fetch the system prompt from the reports_prompts table - now accepts reportType parameter
async function getSystemPrompt(reportType: string, requestId: string): Promise<string> {
  const logPrefix = `[standard-report][${requestId}]`;
  console.log(`${logPrefix} Fetching system prompt for report type: ${reportType}`);

  const fetchPrompt = async () => {
    const { data, error, status } = await supabase
      .from("report_prompts")
      .select("system_prompt")
      .eq("name", reportType) // Changed from hardcoded "standard" to dynamic reportType
      .maybeSingle();

    if (error) {
      console.error(`${logPrefix} Error fetching system prompt (status ${status}):`, error.message);
      // Let retry mechanism handle transient errors, throw for others or if retries exhausted
      if (status === 401 || status === 403 || status === 404) { // Non-retryable DB errors
         throw new Error(`Non-retryable DB error fetching system prompt (${status}): ${error.message}`);
      }
      throw new Error(`Failed to fetch system prompt (status ${status}): ${error.message}`);
    }

    if (!data || !data.system_prompt) {
      console.error(`${logPrefix} No system prompt found for '${reportType}'`);
      throw new Error(`System prompt not found for ${reportType} report`);
    }
    
    console.log(`${logPrefix} Retrieved system prompt for '${reportType}' report type`);
    return data.system_prompt;
  };

  try {
    const systemPrompt = await retryWithBackoff(fetchPrompt, logPrefix, MAX_DB_RETRIES, 500, 2, "database system prompt fetch");
    console.log(`${logPrefix} Successfully retrieved system prompt for ${reportType}`);
    return systemPrompt;
  } catch (err) {
    console.error(`${logPrefix} Unexpected error after retries fetching system prompt:`, err);
    throw err; // Propagate the error to be handled by the main handler
  }
}

// Generate report using OpenAI API
async function generateReport(systemPrompt: string, reportData: any, requestId: string): Promise<string> {
  const logPrefix = `[standard-report][${requestId}]`;
  console.log(`${logPrefix} Generating report with OpenAI GPT-4o`);

  // Enhanced logging of the incoming payload
  console.log(`${logPrefix} Report data endpoint: ${reportData.endpoint}`);
  console.log(`${logPrefix} Report data contains chartData: ${reportData.chartData ? "Yes" : "No"}`);
  
  // Structure data for the prompt
  const userMessage = JSON.stringify({
    chartData: reportData.chartData,
    endpoint: reportData.endpoint,
    ...reportData // Include any other relevant data
  });

  console.log(`${logPrefix} Calling OpenAI API with model: ${OPENAI_MODEL}`);
  console.log(`${logPrefix} API Key format check: ${OPENAI_API_KEY.length > 20 ? "Valid length" : "Invalid length"}`);

  console.log(`${logPrefix} Target API URL: ${OPENAI_ENDPOINT}`);

  const requestBody = {
    model: OPENAI_MODEL,
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: userMessage
      }
    ],
    temperature: 0.2,
    max_tokens: 8192,
    top_p: 0.95,
    frequency_penalty: 0,
    presence_penalty: 0
  };

  const callOpenAIApi = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        controller.abort();
        console.warn(`${logPrefix} OpenAI API call timed out after ${API_TIMEOUT_MS}ms`);
    }, API_TIMEOUT_MS);

    let response;
    try {
        response = await fetch(OPENAI_ENDPOINT, {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
        });
    } catch (fetchError) {
        // This catch is primarily for network errors or if AbortController aborts
        clearTimeout(timeoutId);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
            throw new Error(`OpenAI API call aborted due to timeout (${API_TIMEOUT_MS}ms)`);
        }
        throw fetchError; // Re-throw other fetch errors
    }
    
    clearTimeout(timeoutId); // Clear timeout if fetch completed

    console.log(`${logPrefix} OpenAI API response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${logPrefix} OpenAI API error response: ${response.status} - ${errorText}`);
      const error = new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      // Add status to error object for potential specific handling in retry logic if needed
      (error as any).status = response.status;
      // Do not retry on 400 (bad request) or 404 (model not found) as they are likely permanent for this request
      if (response.status === 400 || response.status === 404 || response.status === 401 || response.status === 403) {
        throw Object.assign(error, { skipRetry: true });
      }
      throw error;
    }

    const data = await response.json();

    if (!data.choices || data.choices.length === 0 || !data.choices[0].message || !data.choices[0].message.content) {
      console.error(`${logPrefix} No content returned from OpenAI API in response:`, JSON.stringify(data));
      throw new Error("Malformed response from OpenAI API: No content in message");
    }

    const generatedText = data.choices[0].message.content;
    console.log(`${logPrefix} Successfully generated report from OpenAI`);
    return generatedText;
  };

  try {
    return await retryWithBackoff(callOpenAIApi, logPrefix, MAX_API_RETRIES, INITIAL_RETRY_DELAY_MS, RETRY_BACKOFF_FACTOR, "OpenAI API call");
  } catch (err) {
    console.error(`${logPrefix} Failed to generate report with OpenAI after retries:`, err);
    // If error has skipRetry, it means it's a non-retryable client error
    if ((err as any).skipRetry) {
        throw new Error(`Permanent OpenAI API error: ${err.message}`);
    }
    throw err; // Propagate other errors
  }
}

// Logging is now handled by the orchestrator

// Main handler function
serve(async (req) => {
  const requestId = crypto.randomUUID().substring(0, 8); // Short unique ID for this request
  const logPrefix = `[standard-report][${requestId}]`;
  const startTime = Date.now();

  console.log(`${logPrefix} Received ${req.method} request for ${req.url}`);

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log(`${logPrefix} Handling OPTIONS request (CORS preflight)`);
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Only accept POST requests
  if (req.method !== "POST") {
    console.warn(`${logPrefix} Method not allowed: ${req.method}`);
    return jsonResponse(
      { error: "Method not allowed", requestId },
      { status: 405 },
      requestId
    );
  }

  try {
    // Parse the request payload
    let reportData;
    try {
      reportData = await req.json();
      console.log(`${logPrefix} Successfully parsed request payload`);
    } catch (parseError) {
      console.error(`${logPrefix} Invalid JSON payload:`, parseError);
      return jsonResponse(
        { error: "Invalid JSON payload", details: parseError.message, requestId },
        { status: 400 },
        requestId
      );
    }
    
    // Extract the report type and selected engine from the payload
    const reportType = reportData.reportType || reportData.report_type || "standard";
    const selectedEngine = reportData.selectedEngine || "standard-report"; // Fall back to default if not provided
    console.log(`${logPrefix} Processing ${reportType} report for endpoint: ${reportData?.endpoint} using engine: ${selectedEngine}`);
    console.log(`${logPrefix} Payload structure check - keys: ${Object.keys(reportData || {}).join(', ')}`);

    // Validate required fields
    if (!reportData || !reportData.chartData || !reportData.endpoint) {
      console.error(`${logPrefix} Missing required fields in request payload. Received:`, reportData);
      
      // Field validation failed - let orchestrator handle logging
      
      return jsonResponse(
        { error: "Missing required fields: chartData and endpoint are required", requestId },
        { status: 400 },
        requestId
      );
    }

    // Fetch the system prompt using the dynamic report type
    const systemPrompt = await getSystemPrompt(reportType, requestId);

    // Generate the report
    const report = await generateReport(systemPrompt, reportData, requestId);
    
    // Log successful report generation
    const durationMs = Date.now() - startTime;
    try {
      const insertLog = await supabase.from("report_logs").insert({
        api_key: reportData.api_key || null,
        user_id: reportData.user_id || null,
        report_type: reportType,
        endpoint: reportData.endpoint,
        report_text: report,
        status: "success",
        duration_ms: durationMs,
        client_id: reportData.client_id || null,
        engine_used: selectedEngine,
        created_at: new Date().toISOString(),
      });

      if (insertLog.error) {
        console.error(`${logPrefix} Failed to log success to report_logs:`, insertLog.error.message);
      } else {
        console.log(`${logPrefix} Successfully logged report generation to report_logs.`);
      }
    } catch (logError) {
      console.error(`${logPrefix} Exception during report_logs insert:`, logError);
    }
    
    // Return the generated report with proper structure
    console.log(`${logPrefix} Successfully processed ${reportType} request in ${Date.now() - startTime}ms`);
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
    console.error(`${logPrefix} Error processing request: ${errorMessage}`, err instanceof Error ? err.stack : err);
    
    // Log error to report_logs
    const durationMs = Date.now() - startTime;
    try {
      const insertLog = await supabase.from("report_logs").insert({
        api_key: reportData?.api_key || null,
        user_id: reportData?.user_id || null,
        report_type: reportData?.reportType || reportData?.report_type || null,
        endpoint: reportData?.endpoint || null,
        report_text: null,
        status: "error",
        error_message: errorMessage,
        duration_ms: durationMs,
        client_id: reportData?.client_id || null,
        engine_used: reportData?.selectedEngine || "standard-report-one",
        created_at: new Date().toISOString(),
      });
      if (insertLog.error) {
        console.error(`${logPrefix} Failed to log error to report_logs:`, insertLog.error.message);
      } else {
        console.log(`${logPrefix} Logged error to report_logs.`);
      }
    } catch (logErr) {
      console.error(`${logPrefix} Exception during report_logs error insert:`, logErr);
    }
    
    return jsonResponse({
      success: false,
      error: errorMessage,
      details: err instanceof Error && (err as any).details ? (err as any).details : undefined,
      requestId
    }, { status: 500 }, requestId);
  }
});

console.log(`${LOG_PREFIX_INIT} Function initialized and ready to process requests`);
