
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { placeId } = await req.json();
    if (!placeId) throw new Error('placeId is required');

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
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
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

    console.log(`🔍 Processing place details request for placeId: ${placeId}`);

    // Re-init service role client ONLY for caching if needed (or just use the authenticated client if RLS allows)
    // The original code used service role for caching. We can keep a separate client for that if we want, 
    // but typically we should check if the user is allowed to cache? 
    // For now, let's keep the service role client for the background cache operation to ensure it works as before,
    // but the READ operation is now gated by the Auth Check above.
    const serviceRoleClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log(`🔍 Processing place details request for placeId: ${placeId}`);

    // --- 1. ALWAYS FETCH FROM GOOGLE (no cache check to avoid race conditions) ---
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY')!;
    const fields = 'geometry,name';
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${GOOGLE_API_KEY}&fields=${fields}`;

    console.log(`🌐 Calling Google Places API: ${url.replace(GOOGLE_API_KEY, '[REDACTED]')}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Google Place Details API request failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('📍 Google API response:', JSON.stringify(data, null, 2));

    if (data.status !== 'OK') {
      throw new Error(`Google API Error: ${data.status}`);
    }

    // --- 2. RETURN CLEAN DATA TO FRONTEND IMMEDIATELY ---
    const placeDataToReturn = {
      name: data.result.name,
      latitude: data.result.geometry.location.lat,
      longitude: data.result.geometry.location.lng
    };

    console.log('📤 Returning place data:', placeDataToReturn);

    // --- 3. CACHE IN BACKGROUND (fire-and-forget) ---
    const placeDataToCache = {
      place_id: placeId,
      place: data.result.name,
      lat: data.result.geometry.location.lat,
      lon: data.result.geometry.location.lng,
    };

    // Cache asynchronously without waiting for result
    serviceRoleClient
      .from('geo_cache')
      .insert(placeDataToCache)
      .then(({ error: insertError }) => {
        if (insertError) {
          console.error('❌ Failed to cache place data:', insertError);
        } else {
          console.log('✅ Successfully cached place data (background)');
        }
      });

    return new Response(JSON.stringify(placeDataToReturn), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Edge function error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})
