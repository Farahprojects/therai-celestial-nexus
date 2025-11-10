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

interface MemeGeneration {
  caption: MemeCaption;
  imagePrompt: string;
}

interface MemeData {
  caption: MemeCaption;
  calculated_at: string;
  image_url?: string | null;
}

/**
 * Generate meme caption and image prompt from Swiss synastry data
 * Single LLM call - no lookup tables, no fallbacks, fail fast
 */
async function generateMeme(
  swissData: any,
  personAName: string,
  personBName: string
): Promise<MemeGeneration> {
  const GOOGLE_API_KEY = Deno.env.get("GOOGLE-LLM-NEW");
  const GEMINI_MODEL = "gemini-2.5-flash";

  if (!GOOGLE_API_KEY) throw new Error("Missing GOOGLE-LLM-NEW");

  // Send FULL Swiss data to LLM - let it extract what it needs
  const swissDataJson = JSON.stringify(swissData, null, 2);
  
  console.log(`[Meme] Swiss data size: ${swissDataJson.length} chars - SENDING FULL DATA TO LLM`);
  console.log(`[Meme] Swiss data structure preview (first 500 chars for debugging only):`, swissDataJson.substring(0, 500));

  const prompt = `You are a creative meme writer and visual concept designer for an AI that creates astrology memes. Humour welcome 

Input:
- Couple: ${personAName} & ${personBName}
- Swiss Ephemeris Synastry Data (complete):
${swissDataJson}

Your task:
FIRST: Analyze the synastry data above and extract the most significant aspects and patterns. Look for aspects between planets, signs, houses, and any other relevant astrological data.

THEN:
1. **Analyze the pattern** — determine the dominant emotional tone of this relationship. These are examples, do not just copy them:
   - "Harmony / Flow" → warmth, beauty, connection
   - "Friction / Wounds" → tension, irony, humor
   - "Ego Clash / Projection" → power, pride, shadow work
   - "Emotional Avoidance / Overthinking" → irony, subtle humor
   - "Intensity / Obsession" → magnetic, dramatic, cinematic
   - "Soul Mirror / Growth" → profound, transformative, poetic

2. **Create a caption** that blends humor, truth, and insight. It should feel emotionally resonant or ironic — something that makes users tag a friend.
   - Max 20 words
   - Tone: Gen Z with humour  
   - Relatable hallmark memes is the goal that relates and will go viral 
   **IMPORTANT Tell image genrator to Check spelling and wording before finalising**

3. **Generate an image prompt** that visually expresses the same theme.
   - Must be 9:16 vertical composition.
   - Focus on viral styles.
   - Include aesthetic cues that fit the emotional tone you identified.
   - Include overlay text:
     - Top: "${personAName} & ${personBName}"
     - Center: the meme caption
     - Bottom: "therai.co"
     
**IMPORTANT Tell image genrator to Check spelling and wording before finalising** 
Return only clean JSON with no markdown:
{
  "caption": "text here",
  "imagePrompt": "text here"
}`;

  const requestBody = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { 
      temperature: 1.0, // More creative variability
      topP: 0.8,
      topK: 40,
      maxOutputTokens: 20000, // Increased to handle reasoning tokens (thoughtsTokenCount ~999) + output
      responseMimeType: "application/json"
    }
  };
  
  console.log(`[Meme] Sending to LLM - prompt length: ${prompt.length} chars (includes FULL Swiss data: ${swissDataJson.length} chars)`);
  console.log(`[Meme] Prompt contains Swiss data: ${prompt.includes(swissDataJson.substring(0, 50))}`);
  // Log full prompt only if it's reasonable size (under 10k chars), otherwise just confirm it's there
  if (prompt.length < 10000) {
    console.log(`[Meme] Full prompt:\n${prompt}`);
  } else {
    console.log(`[Meme] Prompt is large (${prompt.length} chars) - contains full Swiss data`);
  }

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
    const errorText = await resp.text().catch(() => "");
    console.error('[Meme] Gemini API error:', resp.status, errorText);
    throw new Error(`Gemini API error: ${resp.status} - ${errorText}`);
  }

  const data = await resp.json();
  
  // Extract response text - check multiple possible locations
  const candidateParts = data?.candidates?.[0]?.content?.parts || [];
  const textPart = candidateParts.find((p: any) => p?.text);
  const responseText = textPart?.text || '';
  
  console.log('[Meme] Response received:', responseText.length, 'chars');
  
  // Fail fast if empty response
  if (!responseText || responseText.trim().length === 0) {
    console.error('[Meme] Empty response from Gemini:', JSON.stringify(data, null, 2));
    throw new Error('Empty response from Gemini API');
  }
  
  // Parse JSON - should be clean since we use responseMimeType
  let parsed;
  try {
    parsed = JSON.parse(responseText.trim());
  } catch (parseError) {
    console.error('[Meme] JSON parse error:', parseError);
    console.error('[Meme] Response text:', responseText);
    throw new Error(`Failed to parse JSON response: ${parseError}`);
  }
  
  // Validate required fields - fail fast if missing
  if (!parsed.caption || !parsed.imagePrompt) {
    console.error('[Meme] Missing required fields:', parsed);
    throw new Error('LLM response missing required fields: caption or imagePrompt');
  }
  
  // Convert simple caption string to MemeCaption format for compatibility
  const memeCaption = {
    format: 'quote' as const,
    quoteText: parsed.caption,
    attribution: `${personAName} & ${personBName}`
  };
  
  return {
    caption: memeCaption,
    imagePrompt: parsed.imagePrompt
  };
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
    console.log('[calculate-sync-score] Swiss data structure:', JSON.stringify({
      has_blocks: !!swissData?.blocks,
      has_synastry_aspects: !!swissData?.synastry_aspects,
      has_blocks_synastry_aspects: !!swissData?.blocks?.synastry_aspects,
      blocks_keys: swissData?.blocks ? Object.keys(swissData.blocks) : [],
      top_level_keys: swissData ? Object.keys(swissData) : []
    }));

    // Extract person names from conversation title
    let personAName = 'Person A';
    let personBName = 'Person B';
    
    if (conversation?.title) {
      const title = conversation.title.replace('Sync Score: ', '');
      const parts = title.split(' & ');
      personAName = parts[0] || 'Person A';
      personBName = parts[1] || 'Person B';
    }

    // 🎭 MEME GENERATION - Single LLM call, no lookup tables, fail fast
    console.log(`[Meme] Generating meme for ${personAName} & ${personBName}`);
    
    const memeGeneration = await generateMeme(swissData, personAName, personBName);
    
    console.log(`[Meme] Caption: ${memeGeneration.caption.quoteText}`);
    console.log(`[Meme] Image prompt: ${memeGeneration.imagePrompt.length} chars`);

    // Build meme data for storage
    const memeData: MemeData = {
      caption: memeGeneration.caption,
      calculated_at: new Date().toISOString(),
    };

    // Use LLM-generated image prompt directly
    const imagePrompt = memeGeneration.imagePrompt;

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
