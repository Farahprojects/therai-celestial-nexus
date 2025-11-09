// Together Mode LLM Handler
// Dedicated handler for multi-participant relationship insights

import { createPooledClient } from "../_shared/supabaseClient.ts";
import { checkLimit, incrementUsage } from "../_shared/limitChecker.ts";

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

const supabase = createPooledClient();

const json = (status: number, data: any) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });

const togetherModePrompt = `You are an AI guide observing a shared conversation, with access to each person's energy patterns and compatibility dynamics.

Your role: Offer reframed perspectives and energy insights that support forward movement and shared understanding.

Guidelines:
1. **Use their actual names** - Always refer to people by their first names (provided in the data), never "Participant 1/2"
2. **Plain language only** - NO astro jargon, NO technical terms like "Venus in Leo," "synastry," "aspects," "transits," "houses," etc.
3. **Energy awareness** - Identify current dynamics using their natural patterns + conversation tone
4. **Reframe constructively** - If tension exists, reframe toward understanding and growth
5. **Forward movement** - Always point toward next steps, shared goals, or alignment opportunities
6. **Be direct** - Skip metaphors and flowery language. Say what you mean clearly.

Tone: Warm, direct, a bit playful. Contractions welcome. Gently observant but not preachy.

Format: Cohesive paragraph (not a list). End with an invitation or reflective question that moves them forward.

CRITICAL: 
- Never diagnose problems. Offer energy intervention and reframed insights only.
- Never mention "chart," "planets," "signs," or any astrological terminology.
- Use their names naturally, like a friend would.`;

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
  
  // ✅ @THERAI LIMIT CHECK: Only paid users can invoke @therai in Together Mode
  if (user_id) {
    const limitCheck = await checkLimit(supabase, user_id, 'therai_calls', 1);
    
    console.info(JSON.stringify({
      event: "therai_limit_check",
      user_id,
      allowed: limitCheck.allowed,
      current_usage: limitCheck.current_usage,
      remaining: limitCheck.remaining,
      limit: limitCheck.limit,
      is_unlimited: limitCheck.is_unlimited
    }));
    
    if (!limitCheck.allowed) {
      console.warn(JSON.stringify({
        event: "therai_limit_exceeded",
        user_id,
        limit: limitCheck.limit,
        current_usage: limitCheck.current_usage
      }));
      
      // Return friendly message instead of error
      const limitMessage = limitCheck.limit === 3
        ? `You've used your ${limitCheck.limit} @therai insights today. Upgrade to Growth for unlimited relationship insights! ✨`
        : `You've reached your @therai limit for today. Upgrade to Growth for unlimited insights!`;
      
      return json(200, {
        role: 'assistant',
        text: limitMessage,
        meta: { limit_exceeded: true, feature: 'therai_calls' }
      });
    }
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
    
    // Fetch participant names from profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', participantIds);
    
    console.log(`[together-mode] Found ${profiles?.length || 0} profiles with names`);
    
    // Create user_id to name mapping
    const userIdToName = new Map<string, string>();
    profiles?.forEach(profile => {
      if (profile.display_name) {
        userIdToName.set(profile.id, profile.display_name);
      }
    });
    
    // Find profile conversations for each participant (mode='profile')
    const { data: profileConversations } = await supabase
      .from('conversations')
      .select('id, user_id')
      .in('user_id', participantIds)
      .eq('mode', 'profile');
    
    console.log(`[together-mode] Found ${profileConversations?.length || 0} profile conversations`);
    
    // Get swiss data from translator_logs using profile conversation chat_ids
    const profileChatIds = profileConversations?.map(c => c.id) || [];
    const { data: translatorLogs } = await supabase
      .from('translator_logs')
      .select('chat_id, swiss_data, request_type')
      .in('chat_id', profileChatIds)
      .order('created_at', { ascending: false }); // Get most recent if multiple
    
    console.log(`[together-mode] Found ${translatorLogs?.length || 0} translator_logs entries`);
    
    // Build participant contexts from swiss_data
    let participantContexts: string[] = [];
    
    if (translatorLogs && translatorLogs.length > 0) {
      // Group by chat_id to get unique entries (most recent)
      const uniqueLogs = new Map();
      translatorLogs.forEach(log => {
        if (!uniqueLogs.has(log.chat_id)) {
          uniqueLogs.set(log.chat_id, log);
        }
      });
      
      participantContexts = Array.from(uniqueLogs.values()).map((log, idx) => {
        const profileConv = profileConversations?.find(c => c.id === log.chat_id);
        const userId = profileConv?.user_id;
        
        // Use actual name from profiles, or fall back to generic label
        const participantName = (userId && userIdToName.has(userId))
          ? userIdToName.get(userId)
          : `Person ${idx + 1}`;
        
        return `\n\n=== Energy Data for ${participantName} ===\n${JSON.stringify(log.swiss_data, null, 2)}`;
      });
    } else {
      console.log("[together-mode] No translator_logs found, falling back to system messages");
      
      // Fallback: Fetch system messages (backward compatibility for old conversations)
      const { data: systemMessages } = await supabase
        .from('messages')
        .select('text, user_name, user_id')
        .eq('chat_id', chat_id)
        .eq('role', 'system')
        .eq('status', 'complete')
        .not('text', 'is', null)
        .neq('text', '')
        .order('created_at', { ascending: true });
      
      if (systemMessages && systemMessages.length > 0) {
        participantContexts = systemMessages.map((msg, idx) => {
          // Try to use actual name from profiles first, then user_name, then fallback
          const actualName = (msg.user_id && userIdToName.has(msg.user_id)) 
            ? userIdToName.get(msg.user_id)
            : msg.user_name || `Person ${idx + 1}`;
          
          return `\n\n=== Energy Data for ${actualName} ===\n${msg.text}`;
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
      
      // Call chat-send for error message (includes multi-participant broadcast)
      await fetch(`${SUPABASE_URL}/functions/v1/chat-send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({
          chat_id,
          role: 'assistant',
          text: "I'm having trouble connecting right now. Please try again in a moment.",
          mode: 'together',
          user_id,
          user_name: 'Therai',
          meta: { error: true }
        })
      }).catch(err => {
        console.error("[together-mode] Failed to send error message:", err);
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
    
    // Call chat-send to save assistant message (includes multi-participant broadcast)
    await fetch(`${SUPABASE_URL}/functions/v1/chat-send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        chat_id,
        role: 'assistant',
        text: assistantText,
        mode: 'together',
        user_id,
        user_name: 'Therai',
        meta: {
          together_mode_analysis: true,
          analyzed_participants: participantContexts.length,
          trigger_type: 'manual',
          latency_ms: Date.now() - startTime,
          used_translator_logs: translatorLogs && translatorLogs.length > 0
        }
      })
    }).catch(err => {
      console.error("[together-mode] Failed to send message via chat-send:", err);
    });
    
    // ✅ INCREMENT @THERAI USAGE: Track successful @therai call
    if (user_id) {
      console.info(JSON.stringify({
        event: "incrementing_therai_usage",
        user_id,
        feature_type: "therai_calls",
        amount: 1
      }));
      
      const incrementResult = await incrementUsage(supabase, user_id, 'therai_calls', 1);
      
      if (!incrementResult.success) {
        console.error(JSON.stringify({
          event: "therai_increment_failed",
          reason: incrementResult.reason,
          user_id
        }));
      } else {
        console.info(JSON.stringify({
          event: "therai_increment_success",
          user_id
        }));
      }
    }
    
    console.log(`[together-mode] Completed in ${Date.now() - startTime}ms`);
    
    return json(200, { success: true });
    
  } catch (error) {
    console.error("[together-mode] Error:", error);
    return json(500, { error: String(error) });
  }
});

