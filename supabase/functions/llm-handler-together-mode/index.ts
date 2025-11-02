// Together Mode LLM Handler
// Dedicated handler for multi-participant relationship insights

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const GOOGLE_API_KEY = Deno.env.get("GOOGLE-LLM-NEW");
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-2.0-flash-exp";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !GOOGLE_API_KEY) {
  throw new Error("Missing environment variables");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const json = (status: number, data: any) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });

const togetherModePrompt = `You are an AI guide observing a shared conversation between two people, with access to their astrological compatibility data.

Your role: Offer energy insights and reframed perspectives to support forward movement and shared alignment.

Guidelines:
1. **Energy Awareness** - Identify current energetic dynamics using astro patterns + conversation tone
2. **Reframe Constructively** - If tension exists, reframe toward understanding and growth
3. **Forward Movement** - Always point toward next steps, shared goals, or alignment opportunities
4. **Reference Charts** - Use synastry aspects (how charts interact) in plain language
5. **Track Patterns** - Notice emotional/communication patterns in actual messages

Tone: Warm, direct, gently observant. Not a therapist, but an aware third party with energetic insight.

Format: Cohesive paragraph (not a list). End with an invitation or reflective question that moves them forward.

CRITICAL: Never diagnose problems. Offer energy intervention and reframed insights only.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  
  const startTime = Date.now();
  console.log("[together-mode] Request received");
  
  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }
  
  const { chat_id, text, user_id } = body;
  
  if (!chat_id || !text) {
    return json(400, { error: "Missing chat_id or text" });
  }
  
  try {
    console.log("[together-mode] Fetching participant data");
    
    // Get all participants in this conversation
    const { data: participants } = await supabase
      .from('conversations_participants')
      .select('user_id')
      .eq('conversation_id', chat_id);
    
    const participantIds = participants?.map(p => p.user_id) || [];
    console.log(`[together-mode] Found ${participantIds.length} participants`);
    
    // Try to fetch primary profiles first (new onboarding flow)
    const { data: primaryProfiles } = await supabase
      .from('user_profile_list')
      .select('user_id, name, birth_date, birth_time, birth_location, birth_latitude, birth_longitude, notes')
      .in('user_id', participantIds)
      .eq('is_primary', true);
    
    let participantContexts: string[] = [];
    
    if (primaryProfiles && primaryProfiles.length > 0) {
      console.log(`[together-mode] Using ${primaryProfiles.length} primary profiles`);
      
      // Build context from primary profiles
      participantContexts = primaryProfiles.map((profile) => {
        return `\n\n=== AstroData for ${profile.name} ===
Birth Date: ${profile.birth_date}
Birth Time: ${profile.birth_time}
Birth Location: ${profile.birth_location}
Coordinates: ${profile.birth_latitude}, ${profile.birth_longitude}
${profile.notes ? `Notes: ${profile.notes}` : ''}`;
      });
    } else {
      console.log("[together-mode] No primary profiles found, falling back to system messages");
      
      // Fallback: Fetch system messages (backward compatibility)
      const { data: systemMessages } = await supabase
        .from('messages')
        .select('text, user_name')
        .eq('chat_id', chat_id)
        .eq('role', 'system')
        .eq('status', 'complete')
        .not('text', 'is', null)
        .neq('text', '')
        .order('created_at', { ascending: true });
      
      if (systemMessages && systemMessages.length > 0) {
        participantContexts = systemMessages.map((msg, idx) => {
          const name = msg.user_name || `Participant ${idx + 1}`;
          return `\n\n=== AstroData for ${name} ===\n${msg.text}`;
        });
      }
    }
    
    if (participantContexts.length === 0) {
      console.log("[together-mode] No astro data found");
      // Insert graceful response
      await supabase.from('messages').insert({
        chat_id,
        role: 'assistant',
        text: "I don't have astrological context for this conversation yet. Would you like to add birth data?",
        status: 'complete',
        meta: { together_mode_analysis: true, no_data: true }
      });
      return json(200, { success: true, no_data: true });
    }
    
    const systemText = participantContexts.join('\n\n');
    console.log(`[together-mode] Loaded ${participantContexts.length} participant contexts`);
    
    // Fetch conversation history (last 15 messages for relationship context)
    const { data: history } = await supabase
      .from('messages')
      .select('role, text')
      .eq('chat_id', chat_id)
      .neq('role', 'system')
      .eq('status', 'complete')
      .not('text', 'is', null)
      .neq('text', '')
      .order('created_at', { ascending: false })
      .limit(15);
    
    // Build Gemini request
    const contents: any[] = [];
    
    if (history && history.length > 0) {
      for (let i = history.length - 1; i >= 0; i--) {
        contents.push({
          role: history[i].role === 'assistant' ? 'model' : 'user',
          parts: [{ text: history[i].text }]
        });
      }
    }
    
    contents.push({
      role: 'user',
      parts: [{ text }]
    });
    
    const requestBody = {
      system_instruction: {
        role: "system",
        parts: [{ text: `${togetherModePrompt}\n\n[Compatibility Data]\n${systemText}` }]
      },
      contents,
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 800
      }
    };
    
    // Call Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
    
    console.log("[together-mode] Calling Gemini API");
    const resp = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GOOGLE_API_KEY
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000)
    });
    
    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.error("[together-mode] Gemini API error:", resp.status, errText);
      
      // Insert error message
      await supabase.from('messages').insert({
        chat_id,
        role: 'assistant',
        text: "I'm having trouble connecting right now. Please try again in a moment.",
        status: 'complete',
        meta: { error: true }
      });
      return json(502, { error: "Gemini API failed" });
    }
    
    const data = await resp.json();
    const assistantText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    if (!assistantText) {
      console.error("[together-mode] No response text from Gemini");
      return json(502, { error: "No response from Gemini" });
    }
    
    console.log("[together-mode] Gemini response received");
    
    // Insert assistant response with metadata
    await supabase.from('messages').insert({
      chat_id,
      role: 'assistant',
      text: assistantText,
      status: 'complete',
      user_id,
      user_name: 'Therai',
      meta: {
        together_mode_analysis: true,
        analyzed_participants: participantContexts.length,
        trigger_type: 'manual',
        latency_ms: Date.now() - startTime,
        used_primary_profiles: !!(primaryProfiles && primaryProfiles.length > 0)
      }
    });
    
    console.log(`[together-mode] Completed in ${Date.now() - startTime}ms`);
    
    return json(200, { success: true });
    
  } catch (error) {
    console.error("[together-mode] Error:", error);
    return json(500, { error: String(error) });
  }
});

