import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "600",
  "Content-Type": "application/json",
};

// Initialize Supabase client at top level (reused across requests)
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface MemeCaption {
  format: 'top_bottom' | 'quote' | 'text_only';
  topText?: string;
  bottomText?: string;
  quoteText?: string;
  attribution?: string;
}

interface PatternAnalysis {
  category: 'wounds' | 'harmony' | 'ego_clash' | 'emotional_avoidance' | 'intensity' | 'soul_mirror';
  intensity: number;
  primaryAspects: string[];
  secondaryPattern?: string;
}

interface PsychologicalTheme {
  core: string;
  subtext: string;
  tone: 'funny' | 'ironic' | 'deep' | 'smart' | 'chaotic';
}

interface MemeData {
  caption: MemeCaption;
  pattern_category: string;
  theme_core: string;
  tone: string;
  calculated_at: string;
  image_url?: string | null;
}

/**
 * Step 1: PATTERN DETECTION
 * Analyze aspects to identify dominant emotional/relational pattern
 */
function detectDominantPattern(swissData: any): PatternAnalysis {
  const aspects = swissData?.blocks?.synastry_aspects?.pairs || 
                  swissData?.synastry_aspects?.pairs || 
                  [];
  
  // Scoring for each category
  const scores = {
    wounds: 0,
    harmony: 0,
    ego_clash: 0,
    emotional_avoidance: 0,
    intensity: 0,
    soul_mirror: 0
  };
  
  const primaryAspects: string[] = [];
  
  aspects.forEach((aspect: any) => {
    const type = aspect.type?.toLowerCase();
    const planetA = aspect.a?.toLowerCase();
    const planetB = aspect.b?.toLowerCase();
    
    if (!type || !planetA || !planetB) return;
    
    // WOUNDS / FRICTION: squares, oppositions, Saturn/Chiron involvement
    if (type === 'opposition' || type === 'square') {
      scores.wounds += 15;
      if (planetA.includes('saturn') || planetB.includes('saturn') ||
          planetA.includes('chiron') || planetB.includes('chiron')) {
        scores.wounds += 10;
        primaryAspects.push(`${planetA}-${planetB} ${type}`);
      }
      // Mars-Venus tension = classic friction
      if ((planetA.includes('mars') && planetB.includes('venus')) ||
          (planetA.includes('venus') && planetB.includes('mars'))) {
        scores.wounds += 12;
        primaryAspects.push(`Mars-Venus ${type}`);
      }
    }
    
    // HARMONY / FLOW: trines, sextiles, Moon-Venus connections
    if (type === 'trine' || type === 'sextile') {
      scores.harmony += 15;
      if ((planetA.includes('moon') || planetB.includes('moon')) &&
          (planetA.includes('venus') || planetB.includes('venus'))) {
        scores.harmony += 12;
        primaryAspects.push(`Moon-Venus ${type}`);
      }
    }
    
    // EGO CLASH: Sun-Pluto, Sun-Mars, Mercury-Mars
    if ((planetA.includes('sun') && planetB.includes('pluto')) ||
        (planetA.includes('pluto') && planetB.includes('sun'))) {
      scores.ego_clash += 20;
      primaryAspects.push(`Sun-Pluto ${type}`);
    }
    if ((planetA.includes('sun') && planetB.includes('mars')) ||
        (planetA.includes('mars') && planetB.includes('sun'))) {
      scores.ego_clash += 15;
      primaryAspects.push(`Sun-Mars ${type}`);
    }
    
    // EMOTIONAL AVOIDANCE: Moon-Saturn, Mercury-Saturn
    if (((planetA.includes('moon') || planetA.includes('mercury')) && planetB.includes('saturn')) ||
        ((planetB.includes('moon') || planetB.includes('mercury')) && planetA.includes('saturn'))) {
      scores.emotional_avoidance += 18;
      primaryAspects.push(`${planetA}-Saturn ${type}`);
    }
    
    // INTENSITY / OBSESSION: Pluto involvement, 8th house, Scorpio
    if (planetA.includes('pluto') || planetB.includes('pluto')) {
      scores.intensity += 15;
      primaryAspects.push(`Pluto ${type}`);
    }
    
    // SOUL MIRROR / GROWTH: North Node, Uranus, Neptune harmonics
    if ((planetA.includes('node') || planetB.includes('node') ||
         planetA.includes('uranus') || planetB.includes('uranus') ||
         planetA.includes('neptune') || planetB.includes('neptune')) &&
        (type === 'trine' || type === 'sextile' || type === 'conjunction')) {
      scores.soul_mirror += 18;
      primaryAspects.push(`${planetA}-${planetB} ${type}`);
    }
  });
  
  // Find dominant category
  const dominant = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)[0];
  
  return {
    category: dominant[0] as any,
    intensity: dominant[1],
    primaryAspects: primaryAspects.slice(0, 3),
  };
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
 * Step 2: PSYCHOLOGICAL THEME EXTRACTION
 * Convert astrological pattern into human psychology
 */
function extractPsychologicalTheme(
  pattern: PatternAnalysis, 
  personAName: string,
  personBName: string
): PsychologicalTheme {
  const themes: Record<string, PsychologicalTheme> = {
    wounds: {
      core: "Love through friction",
      subtext: "growth happens in the tension",
      tone: 'ironic'
    },
    harmony: {
      core: "Effortless understanding",
      subtext: "rare cosmic luck",
      tone: 'deep'
    },
    ego_clash: {
      core: "Who runs this relationship",
      subtext: "both think it's them",
      tone: 'funny'
    },
    emotional_avoidance: {
      core: "Feelings are scary",
      subtext: "so we intellectualize everything",
      tone: 'funny'
    },
    intensity: {
      core: "It's not toxic it's transformative",
      subtext: "obsessive but make it spiritual",
      tone: 'chaotic'
    },
    soul_mirror: {
      core: "They came to change your life",
      subtext: "not fix it",
      tone: 'deep'
    }
  };
  
  return themes[pattern.category] || themes.harmony;
}

/**
 * Step 3: MEME CAPTION GENERATION
 * LLM generates the perfect meme text based on theme
 */
async function generateMemeCaption(
  theme: PsychologicalTheme,
  pattern: PatternAnalysis,
  personAName: string,
  personBName: string,
  aspectsSummary: string
): Promise<MemeCaption> {
  const GOOGLE_API_KEY = Deno.env.get("GOOGLE-LLM-NEW");
  const GEMINI_MODEL = "gemini-2.5-flash";
  
  if (!GOOGLE_API_KEY) throw new Error("Missing GOOGLE-LLM-NEW");

  const prompt = `You are a cosmic meme curator creating viral relationship content.

RELATIONSHIP DATA:
${personAName} & ${personBName}

DOMINANT PATTERN: ${pattern.category}
PSYCHOLOGICAL THEME: ${theme.core} - ${theme.subtext}
TONE: ${theme.tone}
KEY ASPECTS: ${aspectsSummary}

Your task: Create a MEME CAPTION that captures their dynamic.

CATEGORY-SPECIFIC ANGLES:
- wounds/friction: "when you love them but also want to strangle them" humor
- harmony: "that rare kind of peace you can't explain" beauty
- ego_clash: "who's really running the relationship?" irony
- emotional_avoidance: "when you write a 3-page text instead of saying how you feel" dry wit
- intensity: "it's not toxic it's transformative 😇" dark humor  
- soul_mirror: "they came to shake your timeline not your peace" deep aesthetic

FORMAT OPTIONS:
1. TOP/BOTTOM: Two-line impact meme
   Example: 
   TOP: "When your Saturn hits their Moon"
   BOTTOM: "and suddenly you're their therapist"

2. QUOTE: Single profound statement
   Example: "The chaos between us isn't a warning. It's the point."

3. TEXT_ONLY: One killer line
   Example: "Love language: pointing out each other's cognitive distortions"

RULES:
- Max 15 words per line
- Must feel REAL and shareable
- No generic therapy speak
- Make them laugh think or feel seen
- Be specific to their aspects
- ${theme.tone === 'funny' ? 'Prioritize humor' : theme.tone === 'deep' ? 'Prioritize profundity' : 'Balance wit and insight'}

Respond in JSON format ONLY:
{
  "format": "top_bottom",
  "topText": "...",
  "bottomText": "...",
  "quoteText": "...",
  "attribution": "${personAName} & ${personBName}"
}`;

  try {
    const requestBody = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.85, maxOutputTokens: 300 }
    };

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
    const resp = await fetch(geminiUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "x-goog-api-key": GOOGLE_API_KEY 
      },
      body: JSON.stringify(requestBody)
    });

    if (!resp.ok) {
      throw new Error(`Gemini API error: ${resp.status}`);
    }

    const data = await resp.json();
    const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    console.log('[Meme] LLM raw response:', responseText);
    
    let jsonText = responseText.trim()
      .replace(/^```json\n/, '')
      .replace(/\n```$/, '')
      .replace(/^```\n/, '')
      .replace(/\n```$/, '');
    
    const parsed = JSON.parse(jsonText);
    return parsed;
    
  } catch (error) {
    console.error('[Meme] Caption generation failed:', error);
    // Fallback meme based on theme
    return {
      format: 'quote',
      quoteText: theme.tone === 'funny' 
        ? "When you both think you're the therapist in this relationship"
        : theme.tone === 'chaotic'
        ? "The chaos between us isn't a warning. It's the point."
        : "That rare kind of peace you can't explain to anyone else",
      attribution: `${personAName} & ${personBName}`
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
 * Step 4: CINEMATIC IMAGE PROMPT
 * Generate visual that matches emotional tone
 */
function generateMemeImagePrompt(
  caption: MemeCaption,
  theme: PsychologicalTheme,
  pattern: PatternAnalysis,
  personASign: string,
  personBSign: string
): string {
  // Map tone to visual style
  const visualStyles = {
    funny: {
      mood: "playfully ironic",
      scene: "couple in an absurdly cinematic everyday moment",
      color: "warm desaturated tones with dramatic lighting",
      energy: "comedic tension"
    },
    ironic: {
      mood: "beautifully contradictory",
      scene: "two figures in opposing poses that somehow work together",
      color: "contrasting warm and cool tones",
      energy: "push-pull dynamic"
    },
    deep: {
      mood: "profoundly intimate",
      scene: "two souls in a cosmic ethereal space",
      color: "dreamy purples and deep blues with soft glows",
      energy: "transcendent connection"
    },
    smart: {
      mood: "intellectually charged",
      scene: "couple in a minimalist modern setting with symbolic elements",
      color: "clean monochrome with accent color",
      energy: "cerebral chemistry"
    },
    chaotic: {
      mood: "intense and magnetic",
      scene: "dramatic storm or fire metaphor with two figures drawn together",
      color: "high contrast reds and blacks",
      energy: "obsessive attraction"
    }
  };
  
  const style = visualStyles[theme.tone] || visualStyles.deep;
  
  // Build meme-specific text layout
  const textLayout = caption.format === 'top_bottom' 
    ? `
TOP TEXT (white bold sans-serif, top edge): "${caption.topText}"
BOTTOM TEXT (white bold sans-serif, bottom edge): "${caption.bottomText}"`
    : caption.format === 'quote'
    ? `
CENTER TEXT (elegant white serif, centered): "${caption.quoteText}"
ATTRIBUTION (small text, bottom right): "— ${caption.attribution}"`
    : `
TEXT (centered, white bold): "${caption.quoteText}"`;

  return `Create a cinematic meme-style image (9:16 portrait ratio).

VISUAL STYLE:
- Mood: ${style.mood}
- Scene: ${style.scene}
- Color palette: ${style.color}
- Energy: ${style.energy}
- Zodiac elements: subtle ${personASign} and ${personBSign} symbolism

AESTHETIC RULES:
- Cinematic film grain
- Emotionally charged
- Instagram-worthy shareable quality
- NOT stock photo - feels like a movie still
- Faces can be silhouetted or obscured (mystery > clarity)

TEXT OVERLAY:
${textLayout}

DO NOT:
- Make it look like a standard infographic
- Use generic couple poses
- Add extra labels or decorative text
- Make it overly literal

The image should make someone FEEL the emotion before they read the text.`;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { chat_id, message_id } = await req.json();

    if (!chat_id) {
      return new Response(
        JSON.stringify({ error: "chat_id is required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[calculate-sync-score] Processing for chat_id: ${chat_id}, message_id: ${message_id || 'none'}`);

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
    
    console.log(`[Meme] Zodiac signs: ${personASign} & ${personBSign}`);

    // 🎭 MEME GENERATION PIPELINE
    console.log(`[Meme] Generating meme for ${personAName} & ${personBName}`);
    
    // Step 1: Detect dominant pattern
    const pattern = detectDominantPattern(swissData);
    console.log(`[Meme] Pattern detected: ${pattern.category} (intensity: ${pattern.intensity})`);
    
    // Step 2: Extract psychological theme
    const theme = extractPsychologicalTheme(pattern, personAName, personBName);
    console.log(`[Meme] Theme: ${theme.core} (${theme.tone})`);
    
    // Step 3: Generate meme caption via LLM
    const aspectsSummary = extractAspectsForLLM(swissData);
    const caption = await generateMemeCaption(theme, pattern, personAName, personBName, aspectsSummary);
    console.log(`[Meme] Caption format: ${caption.format}`);
    if (caption.topText) console.log(`[Meme] Top: ${caption.topText}`);
    if (caption.bottomText) console.log(`[Meme] Bottom: ${caption.bottomText}`);
    if (caption.quoteText) console.log(`[Meme] Quote: ${caption.quoteText}`);
    
    // Build meme data for storage
    const memeData: MemeData = {
      caption,
      pattern_category: pattern.category,
      theme_core: theme.core,
      tone: theme.tone,
      calculated_at: new Date().toISOString(),
    };

    // 📸 Generate cinematic meme image
    console.log('[Meme] Generating cinematic image...');
    
    const imagePrompt = generateMemeImagePrompt(
      caption,
      theme,
      pattern,
      personASign,
      personBSign
    );

    // ✅ OPTIMIZATION: Use existing placeholder message if provided (avoids duplicate creation)
    let targetMessage = null;
    
    if (message_id) {
      // Check if placeholder already exists (created by frontend)
      const { data: existingMessage } = await supabase
        .from('messages')
        .select('*')
        .eq('id', message_id)
        .single();
      
      if (existingMessage) {
        console.log('[calculate-sync-score] Using existing placeholder message:', message_id);
        targetMessage = existingMessage;
      }
    }
    
    // Create placeholder only if not provided or doesn't exist
    if (!targetMessage) {
      console.log('[calculate-sync-score] Creating new placeholder message');
      const { data: newMessage, error: messageError } = await supabase
        .from('messages')
        .insert({
          id: message_id || crypto.randomUUID(), // Use provided ID if available
          chat_id: chat_id,
          user_id: userId,
          role: 'assistant',
          text: '',
          status: 'pending',
          meta: {
            message_type: 'image',
            sync_score: true,
            status: 'generating'
          }
        })
        .select()
        .single();

      if (messageError || !newMessage) {
        console.error('[calculate-sync-score] Failed to create message:', messageError);
      } else {
        targetMessage = newMessage;
      }
    }

    // 🚀 Broadcast the placeholder message so frontend displays it (skip if frontend already has it)
    if (targetMessage && !message_id) {
      const channelName = `user-realtime:${userId}`;
      supabase.channel(channelName).send({
        type: 'broadcast',
        event: 'message-insert',
        payload: {
          chat_id: chat_id,
          message: targetMessage
        }
      }, { httpSend: true }).catch((broadcastError) => {
        console.error('[calculate-sync-score] Message broadcast failed:', broadcastError);
      });
    }

    // 🚀 FIRE-AND-FORGET: Store meme metadata immediately (don't wait for image)
    supabase
      .from('conversations')
      .update({
        meta: {
          sync_meme: memeData,
        },
      })
      .eq('id', chat_id)
      .then(({ error: updateError }) => {
        if (updateError) {
          console.error('[Meme] Error updating conversation:', updateError);
        } else {
          console.log('[Meme] Meme metadata stored');
        }
      });

    // 🚀 FIRE-AND-FORGET: Generate image asynchronously (don't block response)
    if (targetMessage) {
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/image-generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          chat_id: chat_id,
          prompt: imagePrompt,
          user_id: userId,
          mode: 'sync',
          image_id: targetMessage.id,
        }),
      })
        .then(async (imageResponse) => {
          if (imageResponse.ok) {
            const imageData = await imageResponse.json();
            console.log('[Meme] Image generated:', imageData.image_url);
            
            // Update conversation meta with image URL
            await supabase
              .from('conversations')
              .update({
                meta: {
                  sync_meme: {
                    ...memeData,
                    image_url: imageData.image_url,
                  },
                },
              })
              .eq('id', chat_id);
          } else {
            console.error('[Meme] Image generation failed:', await imageResponse.text());
          }
        })
        .catch((imageError) => {
          console.error('[Meme] Image generation error:', imageError);
        });
    }

    // ⚡ Return immediately (don't wait for image!)
    console.log('[Meme] Returning immediately, image generating in background');
    return new Response(
      JSON.stringify({ 
        success: true, 
        meme: memeData,
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
