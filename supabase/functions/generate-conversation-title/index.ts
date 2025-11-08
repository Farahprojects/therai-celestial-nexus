// @ts-nocheck
// Edge function to generate conversation titles from first message
// Uses Gemini 2.0 Flash for fast, cheap title generation (3-4 words max)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !GEMINI_API_KEY) {
  throw new Error("Missing required environment variables");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function generateTitle(message: string): Promise<string> {
  const prompt = `Generate a concise 3-4 word title for a conversation that starts with this message. Only return the title, nothing else.

Message: "${message}"

Title:`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 20,
            topP: 0.9,
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const title = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    
    if (!title || title.length < 2) {
      return "New Chat"; // Fallback
    }

    // Limit to 50 chars max
    return title.length > 50 ? title.substring(0, 47) + "..." : title;
  } catch (error) {
    console.error("[generate-conversation-title] Gemini API error:", error);
    return "New Chat"; // Fallback on error
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversation_id, message, user_id } = await req.json();

    if (!conversation_id || !message) {
      return new Response(
        JSON.stringify({ error: "conversation_id and message required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[generate-conversation-title] Generating title for conversation: ${conversation_id}`);

    // Generate title using Gemini 2.0 Flash
    const title = await generateTitle(message);

    console.log(`[generate-conversation-title] Generated title: "${title}"`);

    // Update conversation title and get full updated conversation
    const { data: updatedConversation, error: updateError } = await supabase
      .from("conversations")
      .update({ 
        title,
        updated_at: new Date().toISOString()
      })
      .eq("id", conversation_id)
      .select("*")
      .single();

    if (updateError) {
      console.error("[generate-conversation-title] DB update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update title" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[generate-conversation-title] Successfully updated conversation ${conversation_id} with title "${title}"`);

    // Broadcast update to unified channel (fire-and-forget)
    if (user_id && updatedConversation) {
      const broadcastChannel = supabase.channel(`user-realtime:${user_id}`);
      broadcastChannel.send({
        type: 'broadcast',
        event: 'conversation-update',
        payload: {
          eventType: 'UPDATE',
          data: updatedConversation
        }
      }, { httpSend: true })
        .then(() => {
          console.log(`[generate-conversation-title] Broadcast sent for conversation ${conversation_id}`);
        })
        .catch((err) => {
          console.error(`[generate-conversation-title] Broadcast failed:`, err);
        })
        .finally(() => {
          supabase.removeChannel(broadcastChannel).catch(() => {});
        });
    }

    return new Response(
      JSON.stringify({ success: true, title }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[generate-conversation-title] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

