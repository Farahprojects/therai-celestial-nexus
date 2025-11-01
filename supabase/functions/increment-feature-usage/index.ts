// Increment Feature Usage Edge Function
// Centralized endpoint for incrementing feature usage with comprehensive logging
// Called by: google-whisper, google-text-to-speech, standard-report engines

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: any, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().substring(0, 8);
  const startTime = Date.now();

  console.info(JSON.stringify({
    event: "increment_feature_usage_request",
    request_id: requestId,
    method: req.method
  }));

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed", requestId }, 405);
  }

  try {
    // Parse request body
    const body = await req.json();
    const { user_id, feature_type, amount, source } = body;

    console.info(JSON.stringify({
      event: "increment_feature_usage_params",
      request_id: requestId,
      user_id,
      feature_type,
      amount,
      source
    }));

    // Input validation
    if (!user_id || typeof user_id !== 'string') {
      console.error(`[increment-feature-usage][${requestId}] Invalid user_id`);
      return jsonResponse({
        success: false,
        error: "Invalid user_id",
        requestId
      }, 400);
    }

    if (!feature_type || !['voice_seconds', 'insights_count'].includes(feature_type)) {
      console.error(`[increment-feature-usage][${requestId}] Invalid feature_type: ${feature_type}`);
      return jsonResponse({
        success: false,
        error: "Invalid feature_type. Must be 'voice_seconds' or 'insights_count'",
        requestId
      }, 400);
    }

    if (!amount || amount <= 0 || !Number.isInteger(amount)) {
      console.error(`[increment-feature-usage][${requestId}] Invalid amount: ${amount}`);
      return jsonResponse({
        success: false,
        error: "Invalid amount. Must be a positive integer",
        requestId
      }, 400);
    }

    const currentPeriod = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
    
    console.info(JSON.stringify({
      event: "increment_feature_usage_start",
      request_id: requestId,
      user_id,
      feature_type,
      amount,
      period: currentPeriod,
      source: source || 'unknown'
    }));

    // Call the specific increment function based on feature type
    const rpcFunction = feature_type === 'voice_seconds' 
      ? 'increment_voice_seconds'
      : 'increment_insights_count';

    const rpcParams = feature_type === 'voice_seconds'
      ? { p_user_id: user_id, p_seconds: amount, p_period: currentPeriod }
      : { p_user_id: user_id, p_count: amount, p_period: currentPeriod };

    console.info(JSON.stringify({
      event: "calling_rpc",
      request_id: requestId,
      rpc_function: rpcFunction,
      params: rpcParams
    }));
    
    const { error, data } = await supabase.rpc(rpcFunction, rpcParams);

    if (error) {
      console.error(JSON.stringify({
        event: "rpc_call_failed",
        request_id: requestId,
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        function: rpcFunction,
        params: rpcParams
      }));
      
      return jsonResponse({
        success: false,
        error: error.message,
        code: error.code,
        requestId
      }, 500);
    }

    const duration = Date.now() - startTime;
    console.info(JSON.stringify({
      event: "increment_feature_usage_success",
      request_id: requestId,
      user_id,
      feature_type,
      amount,
      period: currentPeriod,
      duration_ms: duration
    }));

    // Flush logs before returning response
    await new Promise(r => setTimeout(r, 50));

    return jsonResponse({
      success: true,
      feature_type,
      amount,
      period: currentPeriod,
      duration_ms: duration,
      requestId
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error(JSON.stringify({
      event: "increment_feature_usage_exception",
      request_id: requestId,
      error: errorMessage
    }));
    
    return jsonResponse({
      success: false,
      error: errorMessage,
      requestId
    }, 500);
  }
});

