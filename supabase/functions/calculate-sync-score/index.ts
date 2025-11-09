import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenAI } from "https://esm.sh/@google/genai@^1.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "600",
  "Content-Type": "application/json",
};

interface ScoreBreakdown {
  overall: number;
  archetype_name: string;
  ai_insight: string;
  ai_challenge: string;
  calculated_at: string;
  rarity_percentile: number;
  card_image_url?: string | null;
}

interface LLMSyncResponse {
  score: number;
  archetype: string;
  insight: string;
  challenge: string;
}

/**
 * Calculate rarity percentile based on score distribution
 */
function calculateRarity(score: number): number {
  if (score >= 95) return 99;
  if (score >= 90) return 95;
  if (score >= 85) return 90;
  if (score >= 80) return 85;
  if (score >= 75) return 75;
  if (score >= 70) return 65;
  if (score >= 60) return 50;
  return Math.max(0, Math.round((score / 60) * 50));
}

/**
 * Extract key aspects from Swiss data for LLM analysis
 */
function extractAspectsForLLM(swissData: any): string {
  const aspects = swissData?.blocks?.synastry_aspects?.pairs || 
                  swissData?.synastry_aspects?.pairs || 
                  [];

  if (aspects.length === 0) return "No aspects found.";

  // Group by type
  const byType: Record<string, string[]> = {};
  aspects.forEach((aspect: any) => {
    if (!aspect?.type || !aspect?.a || !aspect?.b) return;
    const key = aspect.type.toLowerCase();
    if (!byType[key]) byType[key] = [];
    byType[key].push(`${aspect.a}-${aspect.b}`);
  });

  // Format for LLM
  const lines = Object.entries(byType).map(([type, connections]) => 
    `${type}: ${connections.slice(0, 5).join(', ')}${connections.length > 5 ? '...' : ''}`
  );

  return lines.join('\n');
}

/**
 * Ask Gemini Flash to analyze synastry and generate dynamic score
 */
async function analyzeSyncWithLLM(
  swissData: any,
  personAName: string,
  personBName: string
): Promise<LLMSyncResponse> {
  const apiKey = Deno.env.get("GOOGLE-LLM-NEW");
  if (!apiKey) throw new Error("Missing GOOGLE-LLM-NEW");

  const genAI = new GoogleGenAI({ apiKey });
  
  // Extract aspects for analysis
  const aspectsSummary = extractAspectsForLLM(swissData);
  const today = new Date().toISOString().split('T')[0];

  // System prompt for dynamic sync analysis
  const prompt = `You are a cosmic relationship analyst. Analyze this astrological synastry data and provide FOUR specific outputs:

TODAY'S DATE: ${today}

SYNASTRY ASPECTS BETWEEN ${personAName} & ${personBName}:
${aspectsSummary}

Your task:
1. Calculate a SYNC SCORE (0-100) based on how these two souls align RIGHT NOW at this cosmic moment
2. Assign them an ARCHETYPE (a poetic 2-4 word name like "The Phoenix Pair" "Cosmic Counterparts" "Fire Meets Fire")
3. Write ONE powerful sentence explaining WHY they sync (the magic between them - make them feel SEEN)
4. Write ONE sentence about their GROWTH EDGE (what they're learning together - keep it hopeful and constructive)

CRITICAL RULES:
- Use perfect grammar and spelling
- Write "and" NOT "ad"
- Complete sentences only - no partial words or typos
- No commas in any text
- Be poetic profound and specific
- Make it feel like a yin-yang pair (insight + growth edge complement each other)

Consider:
- Harmonious aspects (trine sextile conjunction) increase the score
- Challenging aspects (square opposition) add intensity but can lower score
- Today's cosmic energy and how it affects their connection
- The FEELING of their bond not just the math

Respond in JSON format ONLY:
{
  "score": 85,
  "archetype": "The Phoenix Pair",
  "insight": "You both thrive when honesty meets flow - a bond that grows through shared curiosity",
  "challenge": "Learning to stay open even when it feels uncertain"
}

Make them FEEL the magic and see the path forward.`;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    console.log('[calculate-sync-score] LLM raw response:', responseText);
    
    // Parse JSON from response (handle markdown code blocks)
    let jsonText = responseText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
    }
    
    const parsed = JSON.parse(jsonText);
    
    // Validate response
    if (!parsed.score || !parsed.archetype || !parsed.insight || !parsed.challenge) {
      throw new Error('LLM response missing required fields');
    }
    
    // Ensure score is in range
    const score = Math.min(100, Math.max(0, Math.round(parsed.score)));
    
    return {
      score,
      archetype: parsed.archetype,
      insight: parsed.insight,
      challenge: parsed.challenge,
    };
  } catch (error) {
    console.error('[calculate-sync-score] LLM analysis failed:', error);
    // Fallback to basic calculation
    return {
      score: 75,
      archetype: "Cosmic Connection",
      insight: "Your energies create a unique space of understanding and growth",
      challenge: "Finding balance between independence and togetherness",
    };
  }
}

/**
 * Extract zodiac signs from Swiss data
 */
function extractZodiacSigns(swissData: any): { personA: string; personB: string } {
  const person1Sun = swissData?.person1?.planets?.Sun?.sign || '';
  const person2Sun = swissData?.person2?.planets?.Sun?.sign || '';
  
  return {
    personA: person1Sun || '',
    personB: person2Sun || '',
  };
}

/**
 * Generate image prompt for connection card
 */
function generateSyncCardPrompt(
  score: number,
  archetype: string,
  insight: string,
  challenge: string,
  personAName: string,
  personBName: string,
  personASign: string,
  personBSign: string,
  rarityPercentile: number
): string {
  // Always use purple/magenta for that premium mystical feel
  const colorScheme = score >= 80 
    ? 'deep purple and magenta gradient with cosmic sparkles'
    : score >= 60
      ? 'rich purple and violet gradient with soft glow'
      : 'warm purple and pink gradient with gentle shimmer';

  return `Create an elegant mystical connection card in portrait orientation (9:16).

DESIGN STRUCTURE (top to bottom with generous spacing):

1. TOP SECTION (celestial background):
   - Background: ${colorScheme} with subtle star field and ethereal glow
   - Very elegant and premium feeling

2. SCORE (center focal point):
   - Huge white number: "${score}%"
   - Add subtle sparkle effects around the number
   - Most prominent element on card

3. ARCHETYPE (below score):
   - Text: "${archetype}"
   - Font: Elegant italic serif
   - Size: Medium-large
   - Color: White with soft glow

4. NAMES WITH SIGNS (tight grouping):
   - Line 1: "${personAName} & ${personBName}"
   - Font: Clean modern sans-serif medium weight
   - Line 2 (directly below smaller): "${personASign} • ${personBSign}"
   - Font: Light weight smaller size
   - Color: Light gray/white
   - Keep these two lines close together as one unit

5. DIVIDER:
   - Subtle thin line or just extra spacing

6. INSIGHT (positive magic):
   - Text: "${insight}"
   - Font: Medium weight sans-serif
   - Size: Readable but not huge
   - Color: White
   - Proper line spacing for readability

7. GROWTH EDGE (hopeful challenge):
   - Label: "Growth Edge:" in smaller lighter text
   - Text: "${challenge}"
   - Font: Light weight sans-serif slightly smaller
   - Color: Soft white/gray
   - Keep this section distinct but harmonious

${rarityPercentile >= 50 ? `8. RARITY BADGE:
   - Small purple badge with sparkle icon
   - Text: "Top ${100 - rarityPercentile}% Connection"
   - Position: Lower section
` : ''}

9. WATERMARK (bottom):
   - Text: "therai.co"
   - Very subtle and elegant
   - Small size light gray

STYLE REQUIREMENTS:
- Premium Apple-inspired minimalist aesthetic
- Generous negative space between sections (don't crowd)
- Soft glows around text for depth
- Professional typography hierarchy
- Mystical but sophisticated (not cheesy)
- Instagram-ready quality
- Clean readable modern
- Purple/magenta tones throughout (no blue)

TYPOGRAPHY:
- Use proper spacing between sections
- Headers slightly bolder or different weight
- Body text clean and readable
- Maintain visual hierarchy

COLORS:
- Background: ${colorScheme}
- Primary text: Pure white
- Secondary text: Light gray (rgba 255 255 255 0.8)
- Accents: Soft purple glows
- Badge: Rich purple
- Keep it elegant and premium`;
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

    // 🚀 PARALLEL FETCH: Get translator log and conversation data simultaneously
    const [logResult, conversationResult] = await Promise.all([
      supabase
        .from('translator_logs')
        .select('swiss_data')
        .eq('chat_id', chat_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from('conversations')
        .select('title, user_id')
        .eq('id', chat_id)
        .single()
    ]);

    const { data: translatorLog, error: logError } = logResult;
    if (logError || !translatorLog) {
      console.error('[calculate-sync-score] Error fetching translator log:', logError);
      return new Response(
        JSON.stringify({ error: "Could not fetch synastry data" }),
        { status: 404, headers: corsHeaders }
      );
    }

    const { data: conversation, error: convError } = conversationResult;
    if (convError || !conversation) {
      console.error('[calculate-sync-score] Error fetching conversation:', convError);
      return new Response(
        JSON.stringify({ error: "Could not fetch conversation data" }),
        { status: 404, headers: corsHeaders }
      );
    }

    const swissData = translatorLog.swiss_data;
    const userId = conversation.user_id;

    console.log('[calculate-sync-score] Swiss data fetched');

    // Extract person names from conversation title
    let personAName = 'Person A';
    let personBName = 'Person B';
    
    if (conversation?.title) {
      const title = conversation.title.replace('Sync Score: ', '');
      const parts = title.split(' & ');
      personAName = parts[0] || 'Person A';
      personBName = parts[1] || 'Person B';
    }

    // 🤖 LLM-DRIVEN ANALYSIS: Ask Gemini Flash to analyze the connection
    console.log(`[calculate-sync-score] Asking LLM to analyze ${personAName} & ${personBName}`);
    const llmAnalysis = await analyzeSyncWithLLM(swissData, personAName, personBName);

    console.log(`[calculate-sync-score] LLM generated: ${llmAnalysis.score}% - ${llmAnalysis.archetype}`);
    console.log(`[calculate-sync-score] Insight: ${llmAnalysis.insight}`);
    console.log(`[calculate-sync-score] Challenge: ${llmAnalysis.challenge}`);

    // Calculate rarity percentile
    const rarityPercentile = calculateRarity(llmAnalysis.score);

    // Build score breakdown for storage and API response
    const scoreBreakdown: ScoreBreakdown = {
      overall: llmAnalysis.score,
      archetype_name: llmAnalysis.archetype,
      ai_insight: llmAnalysis.insight,
      ai_challenge: llmAnalysis.challenge,
      calculated_at: new Date().toISOString(),
      rarity_percentile: rarityPercentile,
    };

    // 📸 Generate connection card image
    console.log('[calculate-sync-score] Generating connection card...');
    
    // Extract zodiac signs for credibility
    const zodiacSigns = extractZodiacSigns(swissData);
    
    const cardPrompt = generateSyncCardPrompt(
      llmAnalysis.score,
      llmAnalysis.archetype,
      llmAnalysis.insight,
      llmAnalysis.challenge,
      personAName,
      personBName,
      zodiacSigns.personA,
      zodiacSigns.personB,
      rarityPercentile
    );

    // Create a placeholder message for the connection card
    const { data: newMessage, error: messageError } = await supabase
      .from('messages')
      .insert({
        chat_id: chat_id,
        user_id: userId,
        role: 'assistant',
        text: 'Generating your connection card...',
        status: 'pending',
        meta: {
          message_type: 'image',
          sync_score: true,
        }
      })
      .select()
      .single();

    if (messageError || !newMessage) {
      console.error('[calculate-sync-score] Failed to create message:', messageError);
    }

    // 🚀 Broadcast the placeholder message so frontend displays it immediately
    if (newMessage) {
      const channelName = `user-realtime:${userId}`;
      supabase.channel(channelName).send({
        type: 'broadcast',
        event: 'message-insert',
        payload: {
          chat_id: chat_id,
          message: newMessage
        }
      }, { httpSend: true }).catch((broadcastError) => {
        console.error('[calculate-sync-score] Message broadcast failed:', broadcastError);
      });
    }

    // 🚀 FIRE-AND-FORGET: Store score metadata immediately (don't wait for image)
    supabase
      .from('conversations')
      .update({
        meta: {
          sync_score: scoreBreakdown,
        },
      })
      .eq('id', chat_id)
      .then(({ error: updateError }) => {
        if (updateError) {
          console.error('[calculate-sync-score] Error updating conversation:', updateError);
        } else {
          console.log('[calculate-sync-score] Score metadata stored');
        }
      });

    // 🚀 FIRE-AND-FORGET: Generate image asynchronously (don't block response)
    if (newMessage) {
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/image-generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          chat_id: chat_id,
          prompt: cardPrompt,
          user_id: userId,
          mode: 'sync',
          image_id: newMessage.id,
        }),
      })
        .then(async (imageResponse) => {
          if (imageResponse.ok) {
            const imageData = await imageResponse.json();
            console.log('[calculate-sync-score] Card image generated:', imageData.image_url);
            
            // Update conversation meta with image URL
            await supabase
              .from('conversations')
              .update({
                meta: {
                  sync_score: {
                    ...scoreBreakdown,
                    card_image_url: imageData.image_url,
                  },
                },
              })
              .eq('id', chat_id);
          } else {
            console.error('[calculate-sync-score] Image generation failed:', await imageResponse.text());
          }
        })
        .catch((imageError) => {
          console.error('[calculate-sync-score] Image generation error:', imageError);
        });
    }

    // ⚡ Return immediately (don't wait for image!)
    console.log('[calculate-sync-score] Returning immediately, image generating in background');
    return new Response(
      JSON.stringify({ 
        success: true, 
        score: scoreBreakdown,
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
