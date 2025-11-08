// @ts-nocheck - Deno runtime
// create-conversation-with-title: Generate smart title using Gemini 2.0 Flash and create conversation
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const GOOGLE_API_KEY = Deno.env.get('GOOGLE-LLM-NEW');

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY || !GOOGLE_API_KEY) {
  throw new Error('Missing required environment variables');
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function generateTitle(message: string): Promise<string> {
  // Fallback for very short messages
  if (message.trim().length < 10) {
    return 'New Chat';
  }

  try {
    const prompt = `Generate a concise 3-4 word title for a conversation that starts with this message. Return ONLY the title, nothing else.

Message: "${message}"

Title:`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 20,
          },
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('[Title Gen] Gemini API error:', response.status);
      return 'New Chat';
    }

    const data = await response.json();
    const generatedTitle = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (generatedTitle && generatedTitle.length > 0) {
      // Clean up the title (remove quotes, limit length)
      const cleanTitle = generatedTitle
        .replace(/^["']|["']$/g, '')
        .slice(0, 50)
        .trim();
      
      return cleanTitle || 'New Chat';
    }

    return 'New Chat';
  } catch (error) {
    console.error('[Title Gen] Error:', error);
    return 'New Chat';
  }
}

async function getAuthUserId(req: Request): Promise<string> {
  const auth = req.headers.get('Authorization');
  if (!auth) throw new Error('Missing Authorization header');

  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error('Invalid or expired token');
  return data.user.id;
}

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    // Authenticate user
    const userId = await getAuthUserId(req);

    // Parse request body
    const body = await req.json();
    const { message, mode = 'chat', report_data } = body;

    if (!message || typeof message !== 'string') {
      return jsonResponse({ error: 'message is required' }, 400);
    }

    // Generate title using Gemini 2.0 Flash
    console.log('[Title Gen] Generating title for message:', message.slice(0, 50));
    const title = await generateTitle(message);
    console.log('[Title Gen] Generated title:', title);

    // Create conversation with generated title
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const conversationData: any = {
      user_id: userId,
      title,
      mode,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Include report_data if provided (for astro/swiss modes)
    if (report_data) {
      conversationData.meta = { report_data };
    }

    const { data: conversation, error: convError } = await admin
      .from('conversations')
      .insert(conversationData)
      .select('id')
      .single();

    if (convError) {
      console.error('[Title Gen] Failed to create conversation:', convError);
      return jsonResponse({ error: 'Failed to create conversation' }, 500);
    }

    console.log('[Title Gen] Created conversation:', conversation.id);

    return jsonResponse({
      success: true,
      conversation_id: conversation.id,
      title,
    });

  } catch (error) {
    console.error('[Title Gen] Error:', error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500
    );
  }
});

