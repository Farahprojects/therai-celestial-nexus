// File: /supabase/functions/google-places-autocomplete/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function transformGoogleResponse(googleData: any) {
  if (!googleData || !googleData.predictions) return [];
  return googleData.predictions.map((p: any) => ({
    place_id: p.place_id,
    description: p.description,
  }));
}

Deno.serve(async (req) => {
  console.log('🌍 Google Places Autocomplete function called');
  console.log('📋 Request URL:', req.url);
  console.log('📋 Request method:', req.method);

  if (req.method === 'OPTIONS') {
    console.log('📋 Handling CORS preflight request');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('📋 Content-Type:', req.headers.get('content-type'));

    const body = await req.text();
    console.log('📋 Raw request body:', body);

    // --- AUTHENTICATION CHECK ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('❌ Missing Authorization header');
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.log('❌ Invalid or expired token:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('✅ User authenticated:', user.id);
    // ---------------------------

    let parsedBody;
    try {
      parsedBody = JSON.parse(body);
      console.log('📋 Parsed JSON body:', parsedBody);
    } catch (parseError) {
      console.log('❌ JSON parse error:', parseError);
      throw new Error('Invalid JSON in request body');
    }

    const { query } = parsedBody;
    console.log('🔍 Processing request with input:', query, 'types: geocode');

    if (!query) {
      console.log('❌ No input provided');
      throw new Error('Query parameter is required in request body');
    }

    if (typeof query !== 'string' || query.trim() === '') {
      console.log('❌ Invalid query type or empty string');
      throw new Error('Query must be a non-empty string');
    }

    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!GOOGLE_API_KEY) {
      console.log('❌ Missing Google Maps API key');
      throw new Error('Google Maps API key not configured');
    }

    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query.trim())}&key=${GOOGLE_API_KEY}`;
    console.log('🌐 Making request to Google Places API');

    const response = await fetch(url);
    if (!response.ok) {
      console.log('❌ Google API request failed:', response.status, response.statusText);
      throw new Error(`Google Autocomplete API request failed: ${response.status}`);
    }

    const googleData = await response.json();
    console.log('📊 Google API response status:', googleData.status);

    if (googleData.status !== 'OK' && googleData.status !== 'ZERO_RESULTS') {
      console.log('❌ Google API error:', googleData.status, googleData.error_message);
      throw new Error(`Google API error: ${googleData.status}`);
    }

    const cleanData = transformGoogleResponse(googleData);
    console.log('✅ Successfully processed', cleanData.length, 'predictions');

    return new Response(JSON.stringify(cleanData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.log('❌ Function error:', error instanceof Error ? error.message : String(error));
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})