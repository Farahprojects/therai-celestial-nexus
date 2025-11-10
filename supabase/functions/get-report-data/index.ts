
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Utility function to validate UUID format
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[get-report-data][${requestId}] 🚀 Request started at ${new Date().toISOString()} - DEPLOYMENT TRIGGER`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[get-report-data] Missing environment variables");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Server configuration error",
          timestamp: new Date().toISOString()
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse and validate request body
    let requestBody;
    try {
      requestBody = await req.json();
      console.log("[get-report-data] Request body received:", { keys: Object.keys(requestBody) });
      
      // Warm-up check
      if (requestBody?.warm === true) {
        return new Response("Warm-up", { status: 200, headers: corsHeaders });
      }
    } catch (parseError) {
      console.error("[get-report-data] Failed to parse JSON:", parseError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Invalid JSON in request body",
          timestamp: new Date().toISOString()
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { chat_id } = requestBody;

    // Validate chat_id
    if (!chat_id || typeof chat_id !== 'string' || !isValidUUID(chat_id)) {
      console.error("[get-report-data] Invalid chat_id format:", chat_id);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "chat_id must be a valid UUID",
          timestamp: new Date().toISOString()
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[get-report-data][${requestId}] 📋 Fetching report data`);

    // Initialize Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: Check conversation mode to determine data source
    console.log(`[get-report-data][${requestId}] 🔍 Checking conversation mode...`);
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("mode, user_id")
      .eq("id", chat_id)
      .single();
    
    if (convError || !conversation) {
      console.error(`[get-report-data] Failed to fetch conversation:`, convError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Conversation not found",
          timestamp: new Date().toISOString()
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const conversationMode = conversation.mode;
    const userId = conversation.user_id;
    console.log(`[get-report-data][${requestId}] Conversation mode: ${conversationMode}`);

    // Step 2: Determine which chat_id to use for fetching astro data
    let dataChatId = chat_id; // Default: use the current chat_id

    // For chat/together modes, fetch from the user's profile conversation
    if (conversationMode === 'chat' || conversationMode === 'together') {
      console.log(`[get-report-data][${requestId}] Chat/Together mode detected, looking up profile conversation...`);
      
      const { data: profileConv, error: profileError } = await supabase
        .from("conversations")
        .select("id")
        .eq("user_id", userId)
        .eq("mode", "profile")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (profileConv) {
        dataChatId = profileConv.id;
        console.log(`[get-report-data][${requestId}] Using profile conversation: ${dataChatId}`);
      } else {
        console.warn(`[get-report-data][${requestId}] No profile conversation found for user: ${userId}`);
        // Continue with original chat_id - may not find data, but that's expected
      }
    }

    // Step 3: Fetch report data from report_logs
    console.log(`[get-report-data][${requestId}] 🔍 Fetching report_logs data from: ${dataChatId}...`);
    const { data: reportLogs, error: reportLogsError } = await supabase
      .from("report_logs")
      .select("report_text, created_at")
      .eq("chat_id", dataChatId)
      .single();
    
    let reportLogData: { report_text: string } | null = null;
    if (!reportLogsError && reportLogs) {
      reportLogData = reportLogs as { report_text: string };
    } else {
      console.warn(`[get-report-data] Could not fetch report_logs:`, reportLogsError);
    }

    // Step 4: Fetch translator data from translator_logs
    console.log(`[get-report-data][${requestId}] 🔍 Fetching translator_logs data from: ${dataChatId}...`);
    const { data: translatorLogs, error: translatorLogsError } = await supabase
      .from("translator_logs")
      .select("swiss_data, request_type, created_at")
      .eq("chat_id", dataChatId)
      .single();
    
    let translatorLogData: { swiss_data: any; request_type?: string } | null = null;
    if (!translatorLogsError && translatorLogs) {
      translatorLogData = translatorLogs as { swiss_data: any; request_type?: string };
    } else {
      console.warn(`[get-report-data] Could not fetch translator_logs:`, translatorLogsError);
    }

    // Check if we have any data (either report text OR Swiss data)
    const hasReportText = !!reportLogData?.report_text;
    const hasSwissData = !!translatorLogData?.swiss_data;
    const hasAnyData = hasReportText || hasSwissData;
    
    if (!hasAnyData) {
      console.warn(`[get-report-data] No data found - no report_text or swiss_data: ${chat_id}`);
      return new Response(
        JSON.stringify({ 
          ready: false, 
          error: "No report or astro data found",
          timestamp: new Date().toISOString()
        }),
        { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare complete report data for frontend
    const reportData = {
      report_content: reportLogData?.report_text || null,
      swiss_data: translatorLogData?.swiss_data || null,
      metadata: {
        content_type: hasReportText && hasSwissData ? 'both' : (hasReportText ? 'ai' : 'astro'),
        has_ai_report: hasReportText,
        has_swiss_data: hasSwissData,
        is_ready: true,
        report_type: translatorLogData?.request_type || 'unknown',
        request_type: translatorLogData?.request_type || null
      }
    };

    const processingTime = Date.now() - startTime;
    console.log(`[get-report-data][${requestId}] ✅ Report data retrieved in ${processingTime}ms`);
    
    // Return report data
    return new Response(
      JSON.stringify({ 
        ok: true, 
        ready: true, 
        data: reportData
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error("[get-report-data] Unexpected error:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
        processing_time_ms: processingTime,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});