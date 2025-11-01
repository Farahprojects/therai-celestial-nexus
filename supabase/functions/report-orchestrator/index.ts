import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "600",
  "Content-Type": "application/json",
};

// Get Supabase URL for edge function calls
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

interface ReportPayload {
  endpoint: string;
  report_type: string;
  chat_id?: string;
  user_id?: string;
  chartData: any;
  [k: string]: any;
}

// Available engines for DB-driven round-robin selection
const ENGINES = [
  "standard-report-three",
  "standard-report-four",
];

// DB-driven engine selection based on the most recent engine_used in report_logs
async function getNextEngine(): Promise<string> {
  try {
    const { data, error } = await sb
      .from("report_logs")
      .select("engine_used, created_at")
      .not("engine_used", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.warn("[report-orchestrator] Engine lookup failed, defaulting to first engine:", error.message);
      return ENGINES[0];
    }

    const lastEngine: string | undefined = Array.isArray(data) && data.length > 0 ? (data[0] as any).engine_used : undefined;
    const lastIndex = lastEngine ? ENGINES.indexOf(lastEngine) : -1;
    const nextIndex = ((lastIndex >= 0 ? lastIndex : -1) + 1) % ENGINES.length;
    const selectedEngine = ENGINES[nextIndex];

    console.log(`[report-orchestrator] Selected engine: ${selectedEngine} (db-driven)`);
    return selectedEngine;
  } catch (e: any) {
    console.warn("[report-orchestrator] Engine selection error, defaulting to first engine:", e?.message || e);
    return ENGINES[0];
  }
}

// Call the selected engine (fire-and-forget)
function callEngineFireAndForget(engine: string, payload: ReportPayload): void {
  const edgeUrl = `${supabaseUrl}/functions/v1/${engine}`;
  // Explicitly build the payload to prevent passing through an api_key
  const requestPayload = { 
    chat_id: payload.chat_id || payload.user_id,
    user_id: payload.chat_id || payload.user_id,
    endpoint: payload.endpoint,
    report_type: payload.report_type,
    chartData: payload.chartData,
    mode: payload.mode,
    system_prompt_type: payload.system_prompt_type,
    selectedEngine: engine,
    engine_used: engine,
  };
  
  console.log(`[report-orchestrator] Calling engine: ${engine}`);
  
  fetch(edgeUrl, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${supabaseServiceKey}`
    },
    body: JSON.stringify(requestPayload),
  })
  .then(response => {
    console.log(`[report-orchestrator] Engine ${engine} response status:`, response.status);
    if (!response.ok) {
      console.error(`[report-orchestrator] Engine ${engine} failed with status:`, response.status);
    }
  })
  .catch(error => {
    console.error(`[report-orchestrator] Engine ${engine} fire-and-forget failed:`, error);
  });
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const payload: ReportPayload = await req.json();
    
    // Warm-up check
    if (payload?.warm === true) {
      return new Response("Warm-up", { status: 200, headers: corsHeaders });
    }
    
    console.log(`[report-orchestrator] Processing request for report type: ${payload.report_type}`);
    
    // Default system prompt type
    let systemPromptType = 'adult';

    // Age check for child-specific prompt (from chartData if available)
    if (payload.chartData?.birthDate) {
      try {
        const birthDate = new Date(payload.chartData.birthDate);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        
        if (age < 12) {
          systemPromptType = 'child';
          console.log(`[report-orchestrator] Child under 12 detected (age: ${age}). Using child prompt.`);
        }
      } catch (e) {
        console.error(`[report-orchestrator] Error during age check:`, (e as any).message);
      }
    }
    
    // Step 1: Select next engine using DB-driven selection from report_logs
    const selectedEngine = await getNextEngine();
    
    // Step 2: Call the engine (fire-and-forget), passing the system prompt type
    const enginePayload = { ...payload, system_prompt_type: systemPromptType };
    callEngineFireAndForget(selectedEngine, enginePayload);
    
    // Return immediately - don't wait for engine response
    return new Response(JSON.stringify({ 
      success: true,
      engine: selectedEngine,
      message: "Report generation initiated"
    }), {
      status: 200,
      headers: corsHeaders,
    });
    
  } catch (error) {
    console.error("[report-orchestrator] Request processing failed:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: "Internal server error" 
    }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}); 
