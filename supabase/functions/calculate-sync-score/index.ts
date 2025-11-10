import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
3. Write ONE short sentence (max 12 words) explaining WHY they sync (the magic between them - make them feel SEEN)
4. Write ONE short sentence (max 12 words) about their GROWTH EDGE (what they're learning together - keep it hopeful and constructive)

CRITICAL RULES:
- Use perfect grammar and spelling
- Write "and" NOT "ad"
- Complete sentences only - no partial words or typos
- No commas in any text
- Be poetic profound and specific
- Make it feel like a yin-yang pair (insight + growth edge complement each other)
- ASCII letters only, no symbols beyond % and & and •

Consider:
- Harmonious aspects (trine sextile conjunction) increase the score
- Challenging aspects (square opposition) add intensity but can lower score
- Today's cosmic energy and how it affects their connection
- The FEELING of their bond not just the math

Respond in JSON format ONLY:
{
  "score": 85,
  "archetype": "The Phoenix Pair",
  "insight": "Honesty meets flow and curiosity grows together",
  "challenge": "Stay open when uncertainty rises"
}

Make them FEEL the magic and see the path forward.`;

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`;
    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500
      }
    };

    const response = await fetch(`${geminiUrl}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!responseText) {
      throw new Error('No response text from Gemini API');
    }
    
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
 * Calculate zodiac sign from birth date (reliable lookup table)
 */
function getZodiacSign(birthDate: string): string {
  const date = new Date(birthDate);
  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate();

  // Zodiac date ranges
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'Aries';
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'Taurus';
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'Gemini';
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'Cancer';
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'Leo';
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'Virgo';
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'Libra';
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'Scorpio';
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'Sagittarius';
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 'Capricorn';
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'Aquarius';
  if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return 'Pisces';
  
  return '';
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
  const includeBadge = rarityPercentile >= 50;
  const layerCount = includeBadge ? 6 : 5;

  return `CRITICAL: Copy all text EXACTLY as written below. Perfect spelling required.

Create a vertical portrait card (9:16 ratio) with ${colorScheme} cosmic background and stars.

EXACT LAYOUT (top to bottom):

1. "${archetype}"
   - top center, white elegant serif, large

2. "${score}%"
   - center of card
   - inside transparent circular glass orb
   - sparkles around it
   - NO solid background

3. "${personAName} & ${personBName}"
   - below score
   - white sans-serif, medium size

4. "${personASign} • ${personBSign}"
   - below names
   - add small ${personASign} icon on LEFT side only
   - add small ${personBSign} icon on RIGHT side only
   - icons outlined (not filled)
   - exactly 2 icons total

5. "${insight}"
   - below zodiac line
   - white text, 2 lines max
   - NO quotes around it

6. "${challenge}"
   - below insight
   - white text, 1 line
   - smaller than insight

${includeBadge ? `7. "Top ${100 - rarityPercentile}% Connection"
   - small purple badge at bottom
   - separate from text above
` : ''}

${includeBadge ? '8' : '7'}. "therai.co"
   - very bottom, small white text

DO NOT ADD:
- Any labels like "NAMES" "ZODIAC" "INSIGHT" "GROWTH EDGE"
- Extra text not listed above
- Solid panels or borders
- Quotation marks
- Random numbers or words

VERIFY spelling of: ${archetype}, ${personAName}, ${personBName}, ${personASign}, ${personBSign}

Final check: exactly ${layerCount} text elements, generous spacing, clean minimal design.`;
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
        .select('swiss_data, request_payload')
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
    const requestPayload = translatorLog.request_payload || {};

    console.log('[calculate-sync-score] Swiss data fetched');

    // Extract person names and birth dates from request payload
    let personAName = 'Person A';
    let personBName = 'Person B';
    let personABirthDate = '';
    let personBBirthDate = '';
    
    if (conversation?.title) {
      const title = conversation.title.replace('Sync Score: ', '');
      const parts = title.split(' & ');
      personAName = parts[0] || 'Person A';
      personBName = parts[1] || 'Person B';
    }

    // Extract birth dates from request payload (passed from initiate-auth-report)
    if (requestPayload?.person_a?.birth_date) {
      personABirthDate = requestPayload.person_a.birth_date;
    }
    if (requestPayload?.person_b?.birth_date) {
      personBBirthDate = requestPayload.person_b.birth_date;
    }

    // Calculate zodiac signs from birth dates (reliable lookup) - BEFORE using them
    const personASign = personABirthDate ? getZodiacSign(personABirthDate) : '';
    const personBSign = personBBirthDate ? getZodiacSign(personBBirthDate) : '';
    
    console.log(`[calculate-sync-score] Zodiac signs: ${personASign} & ${personBSign}`);

    // 🤖 LLM-DRIVEN ANALYSIS: Ask Gemini Flash to analyze the connection
    console.log(`[calculate-sync-score] Asking LLM to analyze ${personAName} & ${personBName}`);
    const llmAnalysis = await analyzeSyncWithLLM(swissData, personAName, personBName);

    // Strip ALL commas from text to keep it clean
    llmAnalysis.insight = llmAnalysis.insight.replace(/,/g, '');
    llmAnalysis.challenge = llmAnalysis.challenge.replace(/,/g, '');
    llmAnalysis.archetype = llmAnalysis.archetype.replace(/,/g, '');
    
    // Also strip commas from names and signs for image generation
    const cleanPersonAName = personAName.replace(/,/g, '');
    const cleanPersonBName = personBName.replace(/,/g, '');
    const cleanPersonASign = personASign.replace(/,/g, '');
    const cleanPersonBSign = personBSign.replace(/,/g, '');

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
    
    const cardPrompt = generateSyncCardPrompt(
      llmAnalysis.score,
      llmAnalysis.archetype,
      llmAnalysis.insight,
      llmAnalysis.challenge,
      cleanPersonAName,
      cleanPersonBName,
      cleanPersonASign,
      cleanPersonBSign,
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
