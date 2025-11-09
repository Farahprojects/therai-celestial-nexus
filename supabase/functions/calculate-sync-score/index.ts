import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GeminiFlash } from "your-llm-library"; // Replace with your actual LLM client library

// --- Configuration & Types ---

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ... [Interfaces like AspectData, AstrologicalAnalysis, etc. remain the same] ...

interface ScoreBreakdown {
  // ... [Previous fields] ...
  share_url: string; // The vital new addition for virality
  rarity_percentile: number;
}

// --- Core Logic Functions ---

/**
 * Calculates the synastry score. Now includes resilience against malformed data.
 */
function calculateAstrologicalScore(aspects: AspectData[]): AstrologicalAnalysis {
  let weightedHarmonious = 0;
  let weightedChallenging = 0;
  const keyConnections: string[] = [];

  aspects.forEach((aspect) => {
    // 🛡️ RESILIENCE: Guard against malformed aspect data to prevent crashes.
    if (!aspect?.type || !aspect?.a || !aspect?.b) {
      console.warn("Skipping malformed aspect:", aspect);
      return; 
    }
    
    // ... [The rest of the weighting and orb logic remains the same] ...
    // ...
  });

  // ... [The rest of the score calculation remains the same] ...
  // ...
  
  return { /* ... analysis object ... */ };
}


/**
 * Queries the database for a real rarity percentile.
 * (This function remains the same)
 */
async function getRealRarity(supabase: SupabaseClient, score: number): Promise<number> {
    // ...
}

/**
 * Calls the LLM to get a creative interpretation of the astrological data.
 * (This function remains the same)
 */
async function getLLMInterpretation(analysis: AstrologicalAnalysis): Promise<LLMResponse> {
    // ...
}


// --- Main Handler ---

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { chat_id } = await req.json();
    if (!chat_id) {
      return new Response(JSON.stringify({ error: "chat_id is required" }), { status: 400, headers: corsHeaders });
    }

    // 🚀 SPEED: Fetch independent data in parallel to reduce latency.
    const [logResult, conversationResult] = await Promise.all([
      supabase.from('translator_logs').select('swiss_data, user_id').eq('chat_id', chat_id).order('created_at', { ascending: false }).limit(1).single(),
      supabase.from('conversations').select('title').eq('id', chat_id).single()
    ]);

    const { data: log, error: logError } = logResult;
    if (logError || !log) throw new Error(`Could not fetch synastry data: ${logError?.message}`);

    const { data: conversation, error: convError } = conversationResult;
    if (convError || !conversation) throw new Error(`Could not fetch conversation data: ${convError?.message}`);
    
    const aspects: AspectData[] = log.swiss_data?.blocks?.synastry_aspects?.pairs || [];
    if (aspects.length === 0) throw new Error("No synastry aspects found");
    
    const user_id = log.user_id;
    if (!user_id) throw new Error("User ID not found in log");

    // 2. Perform Calculations (unchanged)
    const analysis = calculateAstrologicalScore(aspects);
    const [rarityPercentile, llmResponse] = await Promise.all([
        getRealRarity(supabase, analysis.overallScore),
        getLLMInterpretation(analysis),
    ]);

    // 🔗 VIRALITY: Generate the unique shareable URL.
    const shareUrl = `${Deno.env.get("APP_BASE_URL")}/share/sync/${chat_id}`;

    // 3. Assemble Final Breakdown
    const scoreBreakdown: ScoreBreakdown = {
      // ... [all previous breakdown fields] ...
      rarity_percentile: rarityPercentile,
      share_url: shareUrl, // Include the share URL in the final object
    };
    
    // ... [Placeholder message creation & broadcast remains the same] ...
    
    // 5. Asynchronously Trigger Image Generation (The confirmed scalable pattern)
    fetch(`${Deno.env.get("SUPABASE_URL")!}/functions/v1/image-generate-sync-card`, {
      // ... [body remains the same] ...
    }).catch(e => console.error("Error triggering image generation:", e.message));

    // 6. Store Score & Share URL, then Return Immediately
    await supabase.from('conversations').update({ 
      meta: { 
        sync_score: scoreBreakdown 
      } 
    }).eq('id', chat_id);

    return new Response(JSON.stringify({ success: true, score: scoreBreakdown }), { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('[calculate-sync-score] Fatal Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
