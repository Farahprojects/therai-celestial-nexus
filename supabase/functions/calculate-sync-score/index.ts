import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "600",
  "Content-Type": "application/json",
};

// Aspect types and their weights
const HARMONIOUS_ASPECTS = ['trine', 'sextile', 'conjunction'];
const CHALLENGING_ASPECTS = ['square', 'opposition'];

// Planet importance weights (higher = more important)
const PLANET_WEIGHTS: Record<string, number> = {
  'Sun': 3,
  'Moon': 3,
  'Venus': 2.5,
  'Mars': 2,
  'Mercury': 2,
  'Jupiter': 1.5,
  'Saturn': 1.5,
  'Ascendant': 2,
  'MC': 1.5,
  'Uranus': 1,
  'Neptune': 1,
  'Pluto': 1,
};

interface AspectData {
  type: string;
  a: string; // planet name A
  b: string; // planet name B
  orb?: number;
}

interface ScoreBreakdown {
  overall: number;
  astrological: number;
  breakdown: {
    harmonious_aspects: number;
    challenging_aspects: number;
    weighted_score: number;
    key_connections: string[];
  };
  calculated_at: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { chat_id } = await req.json();

    if (!chat_id) {
      return new Response(
        JSON.stringify({ error: "chat_id is required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[calculate-sync-score] Processing for chat_id: ${chat_id}`);

    // 1. Fetch the latest translator log for this chat to get Swiss data
    const { data: translatorLog, error: logError } = await supabase
      .from('translator_logs')
      .select('swiss_data')
      .eq('chat_id', chat_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (logError || !translatorLog) {
      console.error('[calculate-sync-score] Error fetching translator log:', logError);
      return new Response(
        JSON.stringify({ error: "Could not fetch synastry data" }),
        { status: 404, headers: corsHeaders }
      );
    }

    const swissData = translatorLog.swiss_data;
    console.log('[calculate-sync-score] Swiss data fetched');

    // 2. Parse synastry aspects from Swiss data
    const aspects: AspectData[] = swissData?.blocks?.synastry_aspects?.pairs || 
                                   swissData?.synastry_aspects?.pairs || 
                                   [];

    if (!aspects || aspects.length === 0) {
      console.error('[calculate-sync-score] No aspects found in Swiss data');
      return new Response(
        JSON.stringify({ error: "No synastry aspects found" }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[calculate-sync-score] Found ${aspects.length} aspects`);

    // 3. Calculate score based on aspects
    let harmoniousCount = 0;
    let challengingCount = 0;
    let weightedHarmonious = 0;
    let weightedChallenging = 0;
    const keyConnections: string[] = [];

    aspects.forEach((aspect: AspectData) => {
      const aspectType = aspect.type.toLowerCase();
      
      // Get planet weights (default to 1 if not found)
      const planetAWeight = PLANET_WEIGHTS[aspect.a] || 1;
      const planetBWeight = PLANET_WEIGHTS[aspect.b] || 1;
      const avgWeight = (planetAWeight + planetBWeight) / 2;

      if (HARMONIOUS_ASPECTS.includes(aspectType)) {
        harmoniousCount++;
        weightedHarmonious += avgWeight;
        
        // Track key connections (important planets with harmonious aspects)
        if (avgWeight >= 2) {
          keyConnections.push(`${aspect.a} ${aspect.type} ${aspect.b}`);
        }
      } else if (CHALLENGING_ASPECTS.includes(aspectType)) {
        challengingCount++;
        weightedChallenging += avgWeight;
      }
    });

    // 4. Calculate overall score
    // Formula: Base 50 + (weighted harmonious * 8) - (weighted challenging * 4)
    // Normalized to 0-100 range
    const rawScore = 50 + (weightedHarmonious * 8) - (weightedChallenging * 4);
    const overallScore = Math.min(100, Math.max(0, Math.round(rawScore)));

    console.log(`[calculate-sync-score] Score calculated: ${overallScore}`);
    console.log(`[calculate-sync-score] Harmonious: ${harmoniousCount}, Challenging: ${challengingCount}`);

    // 5. Build score breakdown
    const scoreBreakdown: ScoreBreakdown = {
      overall: overallScore,
      astrological: overallScore, // For now, it's the same as overall
      breakdown: {
        harmonious_aspects: harmoniousCount,
        challenging_aspects: challengingCount,
        weighted_score: Math.round(rawScore * 10) / 10,
        key_connections: keyConnections.slice(0, 5), // Top 5 connections
      },
      calculated_at: new Date().toISOString(),
    };

    // 6. Store result in conversations.meta
    const { error: updateError } = await supabase
      .from('conversations')
      .update({
        meta: {
          sync_score: scoreBreakdown,
        },
      })
      .eq('id', chat_id);

    if (updateError) {
      console.error('[calculate-sync-score] Error updating conversation:', updateError);
      return new Response(
        JSON.stringify({ error: "Failed to store score" }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log(`[calculate-sync-score] Score stored successfully`);

    // 7. Return the score
    return new Response(
      JSON.stringify({ 
        success: true, 
        score: scoreBreakdown 
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('[calculate-sync-score] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});

