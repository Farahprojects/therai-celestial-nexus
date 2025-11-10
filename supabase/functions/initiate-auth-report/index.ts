// @ts-nocheck - Deno runtime, types checked at deployment
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno&deno-std=0.224.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

// Initialize Supabase client at top level (reused across requests)
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

interface AuthReportRequest {
  chat_id: string;
  report_data: {
    request: string;
    reportType: string;
    person_a: {
      birth_date: string;
      birth_time: string;
      location: string;
      latitude?: number;
      longitude?: number;
      name: string;
      timezone?: string;
      house_system?: string;
    };
    person_b?: {
      birth_date: string;
      birth_time: string;
      location: string;
      latitude?: number;
      longitude?: number;
      name: string;
      timezone?: string;
      house_system?: string;
    };
  };
  email: string;
  name: string;
  mode: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { chat_id, report_data, email, name, mode } = await req.json() as AuthReportRequest;
    
    console.log(`🔄 [initiate-auth-report] Processing request for mode: ${mode}`);

    if (!chat_id || !report_data) {
      return new Response(JSON.stringify({ error: "chat_id and report_data are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Step 1: Verify JWT and get user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
    
    if (userErr || !userRes.user) {
      console.error(`❌ [initiate-auth-report] JWT verification failed:`, userErr);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const user = userRes.user;
    console.log(`✅ [initiate-auth-report] JWT verified for user: ${user.id}`);

    // Step 2: Determine context ID and flow type
    let actualChatId = chat_id;
    let isInsightsReport = false;
    
    // Check if this is an insights report by mode
    if (mode === 'insight') {
      console.log(`🔄 [initiate-auth-report] Insights report flow`);
      isInsightsReport = true;
      actualChatId = chat_id; // Use chat_id for insights
      
      // INSERT into insights table (fire-and-forget)
      supabase.from('insights')
        .insert({
          id: chat_id, // Use chat_id as insight_id (same as conversation)
          user_id: user.id,
          report_type: report_data.reportType,
          status: 'pending',
          is_ready: false
        })
        .then(({ error }) => {
          if (error) {
            console.error(`❌ [initiate-auth-report] Failed to insert insight:`, error);
          } else {
            console.log(`✅ [initiate-auth-report] Insight record created`);
          }
        });
    } else {
      // Verify the conversation belongs to this user (chat flow)
      const { data: conversation, error: convError } = await supabase
        .from("conversations")
        .select("id, user_id")
        .eq("id", chat_id)
        .eq("user_id", user.id)
        .single();

      if (convError || !conversation) {
        console.error(`❌ [initiate-auth-report] Conversation not found or access denied: ${chat_id}`, convError);
        return new Response(JSON.stringify({ error: "Conversation not found or access denied" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      console.log(`✅ [initiate-auth-report] Conversation verified`);
    }

    // Step 3: Build translator-edge payload
    const translatorPayload = {
      ...report_data,
      chat_id: actualChatId, // Always pass chat_id (conversation id, user id for profile, or conversation id for insights)
      user_id: user.id, // Add user_id for credit deduction
      email: email,
      name: name,
      mode: mode
    };

    console.log(`🔄 [initiate-auth-report] Built translator payload`);

    // Step 4: Fire-and-forget call to translator-edge
    EdgeRuntime.waitUntil(
      supabase.functions.invoke('translator-edge', {
        body: translatorPayload
      }).catch((error) => {
        console.error(`❌ [initiate-auth-report] Translator-edge failed: ${chat_id}`, error);
      })
    );

    // Step 5: Save form details to conversations.meta (only for chat flows, skip for insights and profile)
    if (!isInsightsReport && mode !== 'profile') {
      const { error: metaError } = await supabase
        .from("conversations")
        .update({
          meta: {
            last_report_form: {
              request: report_data.request,
              reportType: report_data.reportType,
              person_a: report_data.person_a,
              person_b: report_data.person_b,
              email: email,
              name: name,
              submitted_at: new Date().toISOString()
            }
          },
          updated_at: new Date().toISOString()
        })
        .eq("id", chat_id);

      if (metaError) {
        console.error(`❌ [initiate-auth-report] Failed to save form meta: ${chat_id}`, metaError);
        // Don't fail the request, just log the error
      } else {
        console.log(`✅ [initiate-auth-report] Form meta saved`);
      }
    } else {
      console.log(`✅ [initiate-auth-report] Skipping conversation meta save for ${mode === 'profile' ? 'profile' : 'insights'} flow`);
    }

    console.log(`✅ [initiate-auth-report] Successfully processed`);

    return new Response(JSON.stringify({
      success: true,
      chat_id,
      message: "Astro data submitted successfully",
      user_id: user.id,
      flow_type: isInsightsReport ? 'insight' : 'chat',
      is_generating_report: isInsightsReport,
      report_id: isInsightsReport ? chat_id : null
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error(`❌ [initiate-auth-report] Unexpected error:`, error);
    return new Response(JSON.stringify({ 
      error: "Internal server error",
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
