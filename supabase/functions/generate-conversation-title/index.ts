// generate-conversation-title
// Simple edge function that generates a 3-4 word title for a conversation
// using Gemini 2.0 Flash based on the first user message

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

import { createPooledClient } from "../_shared/supabaseClient.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin"
};

const json = (status: number, data: any) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
  });

// Environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const GOOGLE_API_KEY = Deno.env.get("GOOGLE-LLM-NEW");

if (!SUPABASE_URL) throw new Error("Missing env: SUPABASE_URL");
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
if (!GOOGLE_API_KEY) throw new Error("Missing env: GOOGLE-LLM-NEW");

const supabase = createPooledClient();

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().substring(0, 8);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const { conversation_id, message } = body;

  if (!conversation_id || typeof conversation_id !== "string") {
    return json(400, { error: "Missing or invalid field: conversation_id" });
  }

  if (!message || typeof message !== "string") {
    return json(400, { error: "Missing or invalid field: message" });
  }

  console.info(JSON.stringify({
    event: "generate_title_start",
    request_id: requestId,
    conversation_id,
    message_length: message.length
  }));

  try {
    // Generate title using Gemini 2.0 Flash
    const prompt = `Generate a concise, natural 3-4 word title for a conversation that starts with this message. Return ONLY the title, no quotes or extra text.

Message: "${message.substring(0, 200)}"

Title:`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GOOGLE_API_KEY}`;
    
    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 20,
          topP: 0.9
        }
      })
    });

    if (!geminiResponse.ok) {
      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    let title = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    // Fallback to "New Chat" if generation failed or is empty
    if (!title || title.length === 0) {
      console.warn(JSON.stringify({
        event: "generate_title_empty_response",
        request_id: requestId,
        conversation_id
      }));
      title = "New Chat";
    }

    // Remove quotes if present
    title = title.replace(/^["']|["']$/g, '');

    // Limit to 50 characters max
    if (title.length > 50) {
      title = title.substring(0, 50).trim();
    }

    console.info(JSON.stringify({
      event: "generate_title_generated",
      request_id: requestId,
      conversation_id,
      title
    }));

    // Update conversation title
    const { error: updateError } = await supabase
      .from('conversations')
      .update({ 
        title,
        updated_at: new Date().toISOString() 
      })
      .eq('id', conversation_id);

    if (updateError) {
      console.error(JSON.stringify({
        event: "generate_title_update_failed",
        request_id: requestId,
        conversation_id,
        error: updateError.message
      }));
      return json(500, { error: "Failed to update conversation title" });
    }

    console.info(JSON.stringify({
      event: "generate_title_complete",
      request_id: requestId,
      conversation_id,
      title
    }));

    return json(200, { 
      success: true, 
      conversation_id, 
      title 
    });

  } catch (error) {
    console.error(JSON.stringify({
      event: "generate_title_error",
      request_id: requestId,
      conversation_id,
      error: error instanceof Error ? error.message : String(error)
    }));

    // Fallback: update with "New Chat" if generation completely fails
    try {
      await supabase
        .from('conversations')
        .update({ 
          title: "New Chat",
          updated_at: new Date().toISOString() 
        })
        .eq('id', conversation_id);
    } catch (fallbackError) {
      console.error(JSON.stringify({
        event: "generate_title_fallback_failed",
        request_id: requestId,
        conversation_id,
        error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
      }));
    }

    return json(500, { 
      error: "Failed to generate title",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

