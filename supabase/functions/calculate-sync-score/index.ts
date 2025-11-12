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

interface PersonData {
  name: string;
  gender: 'male' | 'female' | 'non-binary' | 'unknown';
  birthData?: any;
}

interface MemeGeneration {
  caption: MemeCaption;
  imagePrompt: string;
  personA: PersonData;
  personB: PersonData;
}

interface MemeData {
  caption: MemeCaption;
  calculated_at: string;
  image_url?: string | null;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Extract first name from full name (removes surnames)
 * Handles: "John Doe" -> "John", "Mary Jane Smith" -> "Mary", "SingleName" -> "SingleName"
 */
function getFirstName(fullName: string): string {
  if (!fullName?.trim()) return fullName || 'Person';
  const parts = fullName.trim().split(/\s+/);
  return parts[0] || 'Person';
}

/**
 * Sanitize and validate Swiss data before sending to LLM
 */
function prepareSwissData(swissData: any): string {
  if (!swissData) {
    throw new Error('Swiss data is null or undefined');
  }
  
  // Remove any sensitive or unnecessary fields
  const sanitized = {
    ...swissData,
    // Add specific fields you want to include
  };
  
  return JSON.stringify(sanitized, null, 2);
}

/**
 * Retry logic for API calls with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = baseDelay * Math.pow(2, i);
      console.log(`[Retry] Attempt ${i + 1} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}

// ============================================================================
// MEME GENERATION
// ============================================================================

/**
 * Generate meme caption and image prompt from Swiss synastry data
 * IMPROVED PROMPT: Better spelling control, clearer humor guidelines, structured output
 */
async function generateMeme(
  swissData: any,
  personAName: string,
  personBName: string
): Promise<MemeGeneration> {
  const GOOGLE_API_KEY = Deno.env.get("GOOGLE-LLM-NEW");
  const GEMINI_MODEL = "gemini-2.5-flash";

  if (!GOOGLE_API_KEY) {
    throw new Error("Missing GOOGLE-LLM-NEW environment variable");
  }

  const swissDataJson = prepareSwissData(swissData);
  
  console.log(`[Meme] Generating for ${personAName} & ${personBName}`);
  console.log(`[Meme] Swiss data size: ${swissDataJson.length} chars`);

  // ========================================================================
  // IMPROVED PROMPT: More explicit instructions for humor and spelling
  // ========================================================================
  const prompt = `You are an expert meme creator. Your memes go VIRAL because they're:
- Laugh-out-loud funny with sharp wit
- Emotionally relatable and surprisingly accurate
- Written: Gen Z Tone

CONTEXT:
Couple: ${personAName} & ${personBName}

ASTROLOGICAL DATA (Swiss Ephemeris):
${swissDataJson}

YOUR TASK (complete ALL steps):

STEP 1: ANALYZE THE DATA
Look for the most striking patterns in the synastry that is viral meme worthy:
- Strong aspects (conjunctions, oppositions, trines, squares)
- Dominant planetary energies
- Sign and house placements
- Overall relationship dynamic (harmonious/challenging/intense)

STEP 2: CREATE A VIRAL MEME CAPTION
Requirements:
✓ Maximum 15 words (concise = punchier)
✓ Make it FUNNY - use irony, exaggeration, or unexpected twists
✓ Natural language - avoid astro jargon unless it's the punchline

STEP 3: CREATE IMAGE GENERATION PROMPT
Requirements:
✓ 9:16 vertical format (portrait/story mode)
✓ Viral aesthetic: clean, modern, eye-catching
✓ Style references: use "in the style of [aesthetic]" for consistency
  Examples: "Polaroid photography", "Y2K digital art", "cinematic film still", "retro vaporwave"
✓ Clear visual metaphor for the astrological dynamic
✓ Specify mood/lighting that matches the energy
✓ CRITICAL: Center caption to be wrapped in commars 
✓ Include text overlay instructions:
  - Top overlay: "${personAName} & ${personBName}" (clean sans-serif font)
  - Center overlay: [your meme caption in commers] (bold, high contrast)
  - Bottom overlay: "therai.co" (small, subtle)




OUTPUT FORMAT (strict JSON, no markdown):
{
  "caption": "your hilarious, perfectly-spelled caption here",
  "imagePrompt": "detailed image generation prompt with style, composition, text overlays, and aesthetic specifications"
}

Remember: Viral memes are SHORT, FUNNY, and PERFECTLY EXECUTED. Quality over complexity.`;

  const requestBody = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { 
      temperature: 0.9, // Balanced creativity with consistency
      topP: 0.85,
      topK: 40,
      maxOutputTokens: 40096,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: 0 }
    }
  };

  // Use retry logic for API call
  const data = await retryWithBackoff(async () => {
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
      throw new Error(`Gemini API error: ${resp.status}`);
    }

    return await resp.json();
  });

  // Extract and validate response
  const candidateParts = data?.candidates?.[0]?.content?.parts || [];
  const textPart = candidateParts.find((p: any) => p?.text);
  const responseText = textPart?.text?.trim() || '';
  
  if (!responseText) {
    console.error('[Meme] Empty response from Gemini');
    throw new Error('Empty response from Gemini API');
  }
  
  console.log('[Meme] Response received:', responseText.length, 'chars');
  
  // Parse and validate JSON
  let parsed: { caption: string; imagePrompt: string };
  try {
    parsed = JSON.parse(responseText);
  } catch (parseError) {
    console.error('[Meme] JSON parse error:', parseError);
    console.error('[Meme] Response:', responseText.substring(0, 500));
    throw new Error('Failed to parse LLM response as JSON');
  }
  
  // Validate required fields
  if (!parsed.caption || !parsed.imagePrompt) {
    console.error('[Meme] Missing required fields:', parsed);
    throw new Error('LLM response missing caption or imagePrompt');
  }
  
  // Additional validation: check caption length
  if (parsed.caption.length > 150) {
    console.warn('[Meme] Caption too long, truncating:', parsed.caption);
    parsed.caption = parsed.caption.substring(0, 147) + '...';
  }
  
  // Convert to MemeCaption format
  const memeCaption: MemeCaption = {
    format: 'quote',
    quoteText: parsed.caption,
    attribution: `${personAName} & ${personBName}`
  };
  
  console.log('[Meme] ✓ Caption:', parsed.caption);
  console.log('[Meme] ✓ Image prompt length:', parsed.imagePrompt.length);
  
  return {
    caption: memeCaption,
    imagePrompt: parsed.imagePrompt
  };
}

// ============================================================================
// MESSAGE MANAGEMENT
// ============================================================================

/**
 * Get or create placeholder message for meme generation
 */
async function getOrCreatePlaceholderMessage(
  chat_id: string,
  user_id: string,
  message_id?: string
): Promise<any> {
  // Try to use existing placeholder if provided
  if (message_id) {
    const { data: existingMessage } = await supabase
      .from('messages')
      .select('*')
      .eq('id', message_id)
      .single();
    
    if (existingMessage) {
      console.log('[Message] Using existing placeholder:', message_id);
      return existingMessage;
    }
  }
  
  // Create new placeholder
  console.log('[Message] Creating new placeholder');
  const { data: newMessage, error: messageError } = await supabase
    .from('messages')
    .insert({
      id: message_id || crypto.randomUUID(),
      chat_id: chat_id,
      user_id: user_id,
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

  if (messageError) {
    console.error('[Message] Failed to create placeholder:', messageError);
    throw new Error('Failed to create placeholder message');
  }

  return newMessage;
}

/**
 * Broadcast message to user's realtime channel
 */
async function broadcastMessage(
  user_id: string,
  chat_id: string,
  message: any
): Promise<void> {
  try {
    const channelName = `user-realtime:${user_id}`;
    await supabase.channel(channelName).send({
      type: 'broadcast',
      event: 'message-insert',
      payload: { chat_id, message }
    }, { httpSend: true });
    
    console.log('[Broadcast] Message sent to channel:', channelName);
  } catch (error) {
    console.error('[Broadcast] Failed:', error);
    // Non-critical error, don't throw
  }
}

// ============================================================================
// BACKGROUND TASKS
// ============================================================================

/**
 * Generate and store meme image (fire-and-forget)
 */
function generateMemeImageAsync(
  chat_id: string,
  user_id: string,
  message_id: string,
  imagePrompt: string,
  memeData: MemeData
): void {
  const imageGenUrl = `${supabaseUrl}/functions/v1/image-generate`;
  
  fetch(imageGenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseServiceKey}`,
    },
    body: JSON.stringify({
      chat_id,
      prompt: imagePrompt,
      user_id,
      mode: 'sync',
      image_id: message_id,
    }),
  })
    .then(async (response) => {
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ImageGen] Failed:', response.status, errorText);
        return;
      }
      
      const imageData = await response.json();
      console.log('[ImageGen] ✓ Success:', imageData.image_url);
      
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
      
      console.log('[ImageGen] ✓ Conversation updated with image URL');
    })
    .catch((error) => {
      console.error('[ImageGen] Error:', error);
    });
}

/**
 * Store meme metadata (fire-and-forget)
 */
function storeMemeMetadataAsync(chat_id: string, memeData: MemeData): void {
  supabase
    .from('conversations')
    .update({
      meta: {
        sync_meme: memeData,
      },
    })
    .eq('id', chat_id)
    .then(({ error }) => {
      if (error) {
        console.error('[Metadata] Storage failed:', error);
      } else {
        console.log('[Metadata] ✓ Stored');
      }
    })
    .catch((error) => {
      console.error('[Metadata] Error:', error);
    });
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Parse and validate request
    const { chat_id, message_id } = await req.json();

    if (!chat_id) {
      return new Response(
        JSON.stringify({ error: "chat_id is required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`\n[SyncScore] Starting for chat_id: ${chat_id}`);

    // ========================================================================
    // STEP 1: PARALLEL FETCH - Get translator log and conversation data
    // ========================================================================
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

    // Validate translator log
    const { data: translatorLog, error: logError } = logResult;
    if (logError || !translatorLog?.swiss_data) {
      console.error('[SyncScore] Missing synastry data:', logError);
      return new Response(
        JSON.stringify({ error: "Synastry data not found" }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Validate conversation
    const { data: conversation, error: convError } = conversationResult;
    if (convError || !conversation) {
      console.error('[SyncScore] Missing conversation:', convError);
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        { status: 404, headers: corsHeaders }
      );
    }

    const swissData = translatorLog.swiss_data;
    const userId = conversation.user_id;

    console.log('[SyncScore] ✓ Data fetched');

    // ========================================================================
    // STEP 2: EXTRACT NAMES
    // ========================================================================
    let personAName = 'Person A';
    let personBName = 'Person B';
    
    if (conversation?.title) {
      const title = conversation.title.replace('Sync Score: ', '');
      const parts = title.split(' & ');
      personAName = getFirstName(parts[0] || 'Person A');
      personBName = getFirstName(parts[1] || 'Person B');
    }

    console.log(`[SyncScore] Names: ${personAName} & ${personBName}`);

    // ========================================================================
    // STEP 3: GENERATE MEME (critical path - must succeed)
    // ========================================================================
    const memeGeneration = await generateMeme(swissData, personAName, personBName);
    
    const memeData: MemeData = {
      caption: memeGeneration.caption,
      calculated_at: new Date().toISOString(),
    };

    console.log('[SyncScore] ✓ Meme generated');

    // ========================================================================
    // STEP 4: CREATE/GET PLACEHOLDER MESSAGE
    // ========================================================================
    const targetMessage = await getOrCreatePlaceholderMessage(
      chat_id,
      userId,
      message_id
    );

    // Broadcast placeholder if newly created
    if (!message_id) {
      await broadcastMessage(userId, chat_id, targetMessage);
    }

    // ========================================================================
    // STEP 5: FIRE-AND-FORGET ASYNC TASKS
    // ========================================================================
    
    // Store meme metadata
    storeMemeMetadataAsync(chat_id, memeData);
    
    // Generate image
    if (targetMessage) {
      generateMemeImageAsync(
        chat_id,
        userId,
        targetMessage.id,
        memeGeneration.imagePrompt,
        memeData
      );
    }

    // ========================================================================
    // STEP 6: RETURN IMMEDIATELY
    // ========================================================================
    const duration = Date.now() - startTime;
    console.log(`[SyncScore] ✓ Complete in ${duration}ms`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        meme: memeData,
        processing_time_ms: duration
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[SyncScore] ✗ Error after ${duration}ms:`, error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || "Internal server error",
        processing_time_ms: duration
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
