import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "600",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { chat_id, selected_profile_id, user_id } = await req.json();

    if (!chat_id || !selected_profile_id || !user_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: chat_id, selected_profile_id, user_id" }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[create-sync-score] Processing for chat_id: ${chat_id}, user: ${user_id}`);

    // 🚀 PARALLEL FETCH: Get both profiles simultaneously
    const [primaryResult, selectedResult] = await Promise.all([
      supabase
        .from('user_profile_list')
        .select('*')
        .eq('user_id', user_id)
        .eq('is_primary', true)
        .single(),
      supabase
        .from('user_profile_list')
        .select('*')
        .eq('id', selected_profile_id)
        .eq('user_id', user_id) // Security: ensure profile belongs to user
        .single()
    ]);

    const { data: primaryProfile, error: primaryError } = primaryResult;
    if (primaryError || !primaryProfile) {
      console.error('[create-sync-score] Error fetching primary profile:', primaryError);
      return new Response(
        JSON.stringify({ error: "Primary profile not found. Please set up your profile in Settings." }),
        { status: 404, headers: corsHeaders }
      );
    }

    const { data: selectedProfile, error: selectedError } = selectedResult;
    if (selectedError || !selectedProfile) {
      console.error('[create-sync-score] Error fetching selected profile:', selectedError);
      return new Response(
        JSON.stringify({ error: "Selected profile not found or access denied." }),
        { status: 404, headers: corsHeaders }
      );
    }

    console.log(`[create-sync-score] Profiles loaded: ${primaryProfile.name} & ${selectedProfile.name}`);

    // Prepare payload for Swiss API translator
    const translatorPayload = {
      chat_id: chat_id,
      report_data: {
        person1: {
          name: primaryProfile.name,
          birth_date: primaryProfile.birth_date,
          birth_time: primaryProfile.birth_time,
          birth_location: primaryProfile.birth_location,
          latitude: primaryProfile.birth_latitude,
          longitude: primaryProfile.birth_longitude,
          place_id: primaryProfile.birth_place_id,
          timezone: primaryProfile.timezone,
        },
        person2: {
          name: selectedProfile.name,
          birth_date: selectedProfile.birth_date,
          birth_time: selectedProfile.birth_time,
          birth_location: selectedProfile.birth_location,
          latitude: selectedProfile.birth_latitude,
          longitude: selectedProfile.birth_longitude,
          place_id: selectedProfile.birth_place_id,
          timezone: selectedProfile.timezone,
        },
        reportType: null, // No report needed, just Swiss synastry data
      },
    };

    // 📡 Call Swiss API translator (server-to-server, no CORS issues)
    console.log('[create-sync-score] Calling swiss-api-translator...');
    
    const translatorResponse = await fetch(`${supabaseUrl}/functions/v1/swiss-api-translator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify(translatorPayload),
    });

    if (!translatorResponse.ok) {
      const errorText = await translatorResponse.text();
      console.error('[create-sync-score] Swiss API translator error:', errorText);
      return new Response(
        JSON.stringify({ error: "Failed to process astrological data", details: errorText }),
        { status: 500, headers: corsHeaders }
      );
    }

    const translatorData = await translatorResponse.json();
    console.log('[create-sync-score] Swiss data processed successfully');

    // Return success
    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Sync score conversation created successfully",
        profiles: {
          person1: primaryProfile.name,
          person2: selectedProfile.name,
        }
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('[create-sync-score] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});

