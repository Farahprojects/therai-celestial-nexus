// @ts-nocheck - Deno runtime
// generate-conversation-title: Generate smart title using Gemini 2.0 Flash (no DB operations)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GOOGLE_API_KEY = Deno.env.get('GOOGLE-LLM-NEW');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

if (!GOOGLE_API_KEY || !SUPABASE_URL || !ANON_KEY) {
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
    return 'Chat';
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
      return 'Chat';
    }

    const data = await response.json();
    const generatedTitle = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (generatedTitle && generatedTitle.length > 0) {
      // Clean up the title (remove quotes, limit length)
      const cleanTitle = generatedTitle
        .replace(/^["']|["']$/g, '')
        .slice(0, 50)
        .trim();
      
      return cleanTitle || 'Chat';
    }

    return 'Chat';
  } catch (error) {
    console.error('[Title Gen] Error:', error);
    return 'Chat';
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
    await getAuthUserId(req);

    // Parse request body
    const body = await req.json();
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return jsonResponse({ error: 'message is required' }, 400);
    }

    // Generate title using Gemini 2.0 Flash
    console.log('[Title Gen] Generating title for message:', message.slice(0, 50));
    const title = await generateTitle(message);
    console.log('[Title Gen] Generated title:', title);

    return jsonResponse({
      success: true,
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

