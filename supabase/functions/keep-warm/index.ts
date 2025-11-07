//


// Keep warm function - pings edge functions to prevent cold starts
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

// Configuration
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// List of edge functions to keep warm
const EDGE_FUNCTIONS = [
  "translator-edge",
  "standard-report",
  "standard-report-one", 
  "standard-report-two",
  "validate-promo-code",
  "verify-guest-payment",
  "initiate-report-flow",
  "get-report-data",
  "report-orchestrator",
  "chat-send",
  "llm-handler-gemini",
  "conversation-manager",
];

// Only keep critical-path edge functions warm
const CRITICAL_FUNCTIONS = new Set([
  "chat-send",
  "llm-handler-gemini",
  "conversation-manager",
]);

// Simple warm-up payload for all functions
const WARM_PAYLOAD = { warm: true };

// Ping a single edge function
async function pingEdgeFunction(functionName: string): Promise<{ success: boolean; duration: number; error?: string }> {
  const startTime = Date.now();
  const edgeUrl = `${SUPABASE_URL}/functions/v1/${functionName}`;
  
  try {
    const response = await fetch(edgeUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify(WARM_PAYLOAD),
    });
    
    const duration = Date.now() - startTime;
    
    if (response.ok) {
      return { success: true, duration };
    } else {
      return { 
        success: false, 
        duration, 
        error: `HTTP ${response.status}: ${response.statusText}` 
      };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    return { 
      success: false, 
      duration, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

// Ping all edge functions
async function pingAllFunctions(): Promise<{
  total: number;
  successful: number;
  failed: number;
  results: Record<string, { success: boolean; duration: number; error?: string }>;
}> {
  const functionsToPing = EDGE_FUNCTIONS.filter((name) => CRITICAL_FUNCTIONS.has(name));
  const skippedFunctions = EDGE_FUNCTIONS.filter((name) => !CRITICAL_FUNCTIONS.has(name));

  console.log(
    `[keep-warm] Starting warm ping for ${functionsToPing.length}/${EDGE_FUNCTIONS.length} critical functions`
  );

  if (skippedFunctions.length > 0) {
    console.log(`[keep-warm] Skipping non-critical functions: ${skippedFunctions.join(", ")}`);
  }

  const results: Record<string, { success: boolean; duration: number; error?: string }> = {};
  let successful = 0;
  let failed = 0;
  
  // Ping all functions concurrently
  const pingPromises = functionsToPing.map(async (functionName) => {
    const result = await pingEdgeFunction(functionName);
    results[functionName] = result;
    
    if (result.success) {
      successful++;
      console.log(`[keep-warm] ✅ ${functionName}: ${result.duration}ms`);
    } else {
      failed++;
      console.error(`[keep-warm] ❌ ${functionName}: ${result.error} (${result.duration}ms)`);
    }
  });
  
  await Promise.all(pingPromises);
  
  const summary = {
    total: functionsToPing.length,
    successful,
    failed,
    skipped: skippedFunctions,
    results,
  };
  
  console.log(`[keep-warm] Summary: ${successful}/${functionsToPing.length} successful`);
  return summary;
}

// Main handler
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const startTime = Date.now();
    const summary = await pingAllFunctions();
    const totalDuration = Date.now() - startTime;
    
    return new Response(JSON.stringify({
      success: true,
      message: "Warm ping completed",
      summary,
      totalDuration,
      timestamp: new Date().toISOString(),
    }), {
      status: 200,
      headers: corsHeaders,
    });
    
  } catch (error) {
    console.error("[keep-warm] Error during warm ping:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}); 
