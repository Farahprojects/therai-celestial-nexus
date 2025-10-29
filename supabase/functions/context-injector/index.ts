// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Optimizes astrological data for AI injection by abbreviating keys and
 * converting simple objects to arrays to reduce token count.
 * @param {any} data The original astrological data object.
 * @returns {any} The optimized data object.
 */
function optimizeSwissData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  // Use a recursive function to process each node (object, array, or primitive)
  function processNode(node: any): any {
    // If it's not an object/array, return it as is
    if (node === null || typeof node !== 'object') {
      return node;
    }

    // If it's an array, process each item in the array
    if (Array.isArray(node)) {
      return node.map(item => processNode(item));
    }

    // --- This is the core logic for objects ---

    const keys = Object.keys(node);
    
    // PATTERN 1a: Check for objects like { type: "Planet", deg: 11.83, sign: "Cancer" }
    // and convert them to a more compact array: ["Planet", 11.83, "Cancer"]
    if (keys.length === 3 && keys.includes('type') && keys.includes('deg') && keys.includes('sign')) {
      return [node.type, node.deg, node.sign];
    }
    
    // PATTERN 1b: Check for objects like { deg: 11.83, sign: "Cancer" }
    // and convert them to a more compact array: [11.83, "Cancer"]
    if (keys.length === 2 && keys.includes('deg') && keys.includes('sign')) {
      return [node.deg, node.sign];
    }
    
    // PATTERN 2: Abbreviate common, long key names
    const optimizedObj: { [key: string]: any } = {};
    for (const [key, value] of Object.entries(node)) {
      let newKey = key;
      switch (key) {
        case 'type':
          newKey = 't';
          break;
        case 'retrograde':
          newKey = 'r';
          break;
        case 'house_system':
          newKey = 'hs';
          break;
        case 'zodiac_type':
          newKey = 'zt';
          break;
        // Add other abbreviations as needed
        // case 'datetime_utc': newKey = 'utc'; break; 
      }
      // Recursively process the value and assign it to the new (or old) key
      optimizedObj[newKey] = processNode(value);
    }
    return optimizedObj;
  }

  // Deep clone to avoid modifying the original object and start the process
  const dataToOptimize = JSON.parse(JSON.stringify(data));
  return processNode(dataToOptimize);
}


Deno.serve(async (req) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  // Context injector for authenticated users - simplified version
  console.log(`[context-injector][${requestId}] 🚀 Context injection started at ${new Date().toISOString()}`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body
    const requestBody = await req.json();
    console.log(`[context-injector][${requestId}] Request body received:`, { keys: Object.keys(requestBody) });
    
    // Warm-up check
    if (requestBody?.warm === true) {
      return new Response("Warm-up", { status: 200, headers: corsHeaders });
    }

        const { chat_id, mode, report_text, injection_type } = requestBody;

    // Basic chat_id validation
    if (!chat_id || typeof chat_id !== 'string') {
      console.error(`[context-injector][${requestId}] Invalid chat_id:`, chat_id);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "chat_id is required",
          timestamp: new Date().toISOString()
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mode validation
    if (!mode || typeof mode !== 'string') {
      console.error(`[context-injector][${requestId}] Invalid mode:`, mode);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "mode is required",
          timestamp: new Date().toISOString()
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[context-injector][${requestId}] 📋 Processing context injection for chat_id: ${chat_id}, injection_type: ${injection_type || 'swiss_data'}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    // Determine injection type and build appropriate context
    let contextContent = "";
    let contextType = injection_type || 'swiss_data';
    
    if (injection_type === 'report' && report_text) {
      // Called from standard-report engines - inject report text
      console.log(`[context-injector][${requestId}] 📄 Injecting report text (${report_text.length} chars)...`);
      contextContent = `AI Report generated for this conversation:\n\n${report_text}`;
    } else {
      // Called from translator-edge - inject Swiss data (original behavior)
      console.log(`[context-injector][${requestId}] 🔍 Fetching Swiss data...`);
      const { data: translatorLogs } = await supabase
        .from("translator_logs")
        .select("swiss_data")
        .eq("chat_id", chat_id)
        .single();

      if (translatorLogs?.swiss_data) {
        // Optimize Swiss data by removing redundant fields to reduce token usage
        const optimizedSwissData = optimizeSwissData(translatorLogs.swiss_data);
        contextContent = `Astro data available for this conversation:\n${JSON.stringify(optimizedSwissData, null, 2)}`;
      } else {
        contextContent = "Astro data context injected for this conversation.";
      }
    }

    // Check if this specific context type has already been injected
    console.log(`[context-injector][${requestId}] 🔍 Checking if ${contextType} context already injected...`);
    const { data: existingContext } = await supabase
      .from("messages")
      .select("id")
      .eq("chat_id", chat_id)
      .eq("context_injected", true)
      .eq("meta->>injection_type", contextType)
      .limit(1);

    if (existingContext && existingContext.length > 0) {
      console.log(`[context-injector][${requestId}] ✅ ${contextType} context already injected for chat_id: ${chat_id}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `${contextType} context already injected`,
          chat_id,
          injection_type: contextType,
          timestamp: new Date().toISOString()
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[context-injector][${requestId}] 💉 Injecting ${contextType} context message (${contextContent.length} chars)...`);

    // Insert the context message as a system message (invisible to UI)
    const { data: contextMessage, error: insertError } = await supabase
      .from("messages")
      .insert({
        chat_id,
        role: "system",
        text: contextContent,
        status: "complete",
        context_injected: true,
        mode: mode,
        meta: {
          injection_type: contextType,
          has_swiss_data: contextType === 'swiss_data',
          has_report_text: contextType === 'report',
          injection_timestamp: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (insertError) {
      console.error(`[context-injector][${requestId}] Failed to inject context:`, insertError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Failed to inject context into messages",
          details: insertError.message,
          timestamp: new Date().toISOString()
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Invalidate Gemini cache since system message has changed
    console.log(`[context-injector][${requestId}] 🔄 Invalidating Gemini cache for chat_id: ${chat_id}`);
    const { error: cacheDeleteError } = await supabase
      .from("conversation_caches")
      .delete()
      .eq("chat_id", chat_id);
    
    if (cacheDeleteError) {
      console.warn(`[context-injector][${requestId}] ⚠️  Failed to invalidate cache:`, cacheDeleteError.message);
      // Don't fail the request - cache will be recreated on next LLM call
    } else {
      console.log(`[context-injector][${requestId}] ✅ Cache invalidated, will be recreated on next message`);
    }

    const processingTime = Date.now() - startTime;
    console.log(`[context-injector][${requestId}] ✅ ${contextType} context injected successfully in ${processingTime}ms`);
    console.log(`[context-injector][${requestId}] 📝 Message ID: ${contextMessage.id}, Chat ID: ${chat_id}`);
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: `${contextType} context successfully injected`,
        data: {
          message_id: contextMessage.id,
          chat_id,
          injection_type: contextType,
          content_length: contextContent.length,
          has_swiss_data: contextType === 'swiss_data',
          has_report_text: contextType === 'report',
          processing_time_ms: processingTime
        },
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`[context-injector][${requestId}] Unexpected error:`, error);
    
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
