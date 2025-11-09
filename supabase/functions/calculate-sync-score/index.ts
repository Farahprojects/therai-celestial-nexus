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
    dominant_theme: string; // e.g., "communication", "emotional", "balanced"
  };
  poetic_headline: string;
  ai_insight: string;
  calculated_at: string;
  rarity_percentile: number; // 0-100, where 95 means "rarer than 95%"
}

// Determine the dominant theme of the connection based on key aspects
function determineDominantTheme(keyConnections: string[]): string {
  if (keyConnections.length === 0) return 'balanced';
  
  const connectionStr = keyConnections.join(' ').toLowerCase();
  
  // Communication planets: Mercury
  if (connectionStr.includes('mercury')) return 'communication';
  
  // Emotional planets: Moon, Venus
  if (connectionStr.includes('moon') || connectionStr.includes('venus')) return 'emotional';
  
  // Action/passion planets: Mars, Sun
  if (connectionStr.includes('mars') || connectionStr.includes('sun')) return 'dynamic';
  
  // Intellectual/expansive: Jupiter
  if (connectionStr.includes('jupiter')) return 'growth';
  
  return 'balanced';
}

// Generate poetic headline based on score and theme
function generatePoeticHeadline(score: number, theme: string): string {
  if (score >= 90) {
    const highScoreHeadlines: Record<string, string> = {
      communication: 'A Perfect Conversation',
      emotional: 'Two Hearts, One Rhythm',
      dynamic: 'Fire Meets Fire',
      growth: 'Infinite Potential',
      balanced: 'Cosmic Counterparts',
    };
    return highScoreHeadlines[theme] || 'Cosmic Counterparts';
  } else if (score >= 75) {
    const goodScoreHeadlines: Record<string, string> = {
      communication: 'Words Flow Like Water',
      emotional: 'Hearts in Harmony',
      dynamic: 'Energetic Alignment',
      growth: 'Journey Together',
      balanced: 'Natural Connection',
    };
    return goodScoreHeadlines[theme] || 'Natural Connection';
  } else if (score >= 60) {
    return 'Growing Together';
  } else if (score >= 40) {
    return 'Learning & Evolving';
  } else {
    return 'Opposite Energies';
  }
}

// Generate AI insight about the connection
function generateAiInsight(score: number, theme: string, keyConnections: string[]): string {
  const themeInsights: Record<string, string[]> = {
    communication: [
      'Your energies create a rare space where words carry weight and meaning.',
      'Conversation flows effortlessly between you, like a river finding its path.',
      'You speak different languages, yet somehow understand each other perfectly.',
    ],
    emotional: [
      'Your hearts beat to the same cosmic rhythm, creating profound understanding.',
      'Emotions flow freely between you, creating a sacred space of vulnerability.',
      'You feel what the other feels, as if connected by invisible threads.',
    ],
    dynamic: [
      'Your combined energy could move mountains or start revolutions.',
      'Together, you create a force that transforms everything it touches.',
      'Action and ambition merge into something greater than the sum.',
    ],
    growth: [
      'Together, you expand into versions of yourselves you never knew existed.',
      'Your connection is a catalyst for mutual evolution and discovery.',
      'Every moment together opens new doors to possibility.',
    ],
    balanced: [
      'Your energies create a rare space where logic and intuition can dance together.',
      'A connection this balanced is rarer than you might think.',
      'You complement each other in ways that feel both natural and magical.',
    ],
  };
  
  const insights = themeInsights[theme] || themeInsights.balanced;
  
  // Choose insight based on score
  if (score >= 80) return insights[0];
  if (score >= 60) return insights[1];
  return insights[2];
}

// Calculate rarity percentile based on score distribution
function calculateRarity(score: number): number {
  // Assume normal distribution of scores with mean ~60, std dev ~15
  // This is a simplified approximation
  if (score >= 95) return 99;
  if (score >= 90) return 95;
  if (score >= 85) return 90;
  if (score >= 80) return 85;
  if (score >= 75) return 75;
  if (score >= 70) return 65;
  if (score >= 60) return 50;
  return Math.max(0, Math.round((score / 60) * 50));
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

    // 4.5. Determine dominant theme and generate poetic content
    const dominantTheme = determineDominantTheme(keyConnections);
    const poeticHeadline = generatePoeticHeadline(overallScore, dominantTheme);
    const aiInsight = generateAiInsight(overallScore, dominantTheme, keyConnections);
    const rarityPercentile = calculateRarity(overallScore);

    // 5. Build score breakdown
    const scoreBreakdown: ScoreBreakdown = {
      overall: overallScore,
      astrological: overallScore, // For now, it's the same as overall
      breakdown: {
        harmonious_aspects: harmoniousCount,
        challenging_aspects: challengingCount,
        weighted_score: Math.round(rawScore * 10) / 10,
        key_connections: keyConnections.slice(0, 5), // Top 5 connections
        dominant_theme: dominantTheme,
      },
      poetic_headline: poeticHeadline,
      ai_insight: aiInsight,
      calculated_at: new Date().toISOString(),
      rarity_percentile: rarityPercentile,
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

