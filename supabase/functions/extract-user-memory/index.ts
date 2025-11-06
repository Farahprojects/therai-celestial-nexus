// @ts-nocheck
// Extract user memories from profile-based conversations
// Runs async after AI responds when user has selected "My Main Profile"

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const GOOGLE_API_KEY = Deno.env.get("GOOGLE-LLM-NEW");
const GEMINI_MODEL = "gemini-2.0-flash-exp";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !GOOGLE_API_KEY) {
  throw new Error("Missing required environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or GOOGLE-LLM-NEW)");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const json = (status: number, data: any) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });

const extractionPrompt = `You are a memory extraction system analyzing a conversation turn between a user and their astrology AI companion.

Your task: Extract 0-3 memorable insights about the user from this exchange.

Memory types:
- fact: Concrete information about user's life (job, relationships, events)
- emotion: Emotional states or patterns
- goal: User's aspirations, intentions, or objectives
- pattern: Recurring behavioral or thought patterns
- relationship: Information about connections with others

Rules:
1. Only extract meaningful, non-obvious information
2. Skip pleasantries, opinions about the AI, or ephemeral logistics
3. Do NOT store medical diagnoses or financial claims (or mark very low confidence)
4. Write concise memory_text (1-2 sentences max)
5. Assign confidence score 0.5-1.0 based on clarity

Output strict JSON:
{
  "memories": [
    {"type":"goal","text":"...","confidence":0.86},
    {"type":"pattern","text":"...","confidence":0.78}
  ]
}

Examples of what NOT to save:
- "User said thank you"
- "User asked about the AI's capabilities"
- "User wants to schedule a call tomorrow" (too ephemeral)

Examples of what TO save:
- "User launched a coaching business in October 2024" (fact)
- "User feels anxious during Mercury retrograde periods" (pattern)
- "User's goal: Improve communication with partner by year-end" (goal)`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const { conversation_id, message_id, user_id } = await req.json();

    if (!conversation_id || !message_id || !user_id) {
      return json(400, { error: "Missing required fields" });
    }

    // Check idempotency: already extracted for this message?
    const { data: existing } = await supabase
      .from("user_memory")
      .select("id")
      .eq("conversation_id", conversation_id)
      .eq("source_message_id", message_id)
      .limit(1)
      .single();

    if (existing) {
      return json(200, { message: "Already extracted", skipped: true });
    }

    // Validate conversation has profile_id and profile is primary
    const { data: conv } = await supabase
      .from("conversations")
      .select("profile_id, mode, user_id")
      .eq("id", conversation_id)
      .single();

    if (!conv?.profile_id) {
      return json(200, { message: "No profile selected", skipped: true });
    }

    const { data: profile } = await supabase
      .from("user_profile_list")
      .select("is_primary, user_id")
      .eq("id", conv.profile_id)
      .single();

    if (!profile?.is_primary || profile.user_id !== user_id) {
      return json(200, { message: "Not primary profile or user mismatch", skipped: true });
    }

    // Rate limit: Only extract every 3-5 assistant messages
    const { count: assistantCountResult, error: assistantCountError } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("chat_id", conversation_id)
      .eq("role", "assistant");

    if (assistantCountError) {
      console.error("[extract-user-memory] Failed to count assistant messages", assistantCountError);
      return json(500, { error: "Failed to count assistant messages" });
    }

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count: recentExtractionsResult, error: recentExtractionsError } = await supabase
      .from("user_memory")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversation_id)
      .gte("created_at", tenMinutesAgo);

    if (recentExtractionsError) {
      console.error("[extract-user-memory] Failed to count recent extractions", recentExtractionsError);
      return json(500, { error: "Failed to count recent extractions" });
    }

    const assistantMessageCount = assistantCountResult ?? 0;
    const recentExtractionsCount = recentExtractionsResult ?? 0;

    if (recentExtractionsCount > 0 && assistantMessageCount < 5) {
      return json(200, { message: "Rate limited: too soon after last extraction", skipped: true });
    }

    // Get the message and previous context (last 4 messages)
    const { data: messages } = await supabase
      .from("messages")
      .select("role, text, created_at")
      .eq("chat_id", conversation_id)
      .eq("status", "complete")
      .order("created_at", { ascending: false })
      .limit(5);

    if (!messages || messages.length === 0) {
      return json(400, { error: "No messages found" });
    }

    const conversationText = messages
      .reverse()
      .map(m => `${m.role === "assistant" ? "AI" : "User"}: ${m.text}`)
      .join("\n\n");

    // Call Gemini for extraction
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
    const requestBody = {
      system_instruction: {
        role: "system",
        parts: [{ text: extractionPrompt }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: `Analyze this conversation turn and extract memories:\n\n${conversationText}` }]
        }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 500,
        responseMimeType: "application/json"
      }
    };

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
    const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const result = JSON.parse(responseText);
    const memories = result.memories || [];

    if (memories.length === 0) {
      return json(200, { message: "No memories extracted", count: 0 });
    }

    // Simple text-based deduplication
    const { data: recentMemories } = await supabase
      .from("user_memory")
      .select("id, memory_text, reference_count")
      .eq("user_id", user_id)
      .eq("profile_id", conv.profile_id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(50);

    const memoriesToInsert = [];

    for (const mem of memories.slice(0, 3).filter((m: any) => (m.confidence ?? 0) >= 0.85)) {
      // Check similarity (simple text overlap)
      let isDuplicate = false;
      if (recentMemories) {
        for (const existing of recentMemories) {
          const similarity = textSimilarity(mem.text, existing.memory_text);
          if (similarity > 0.65) {
            // Increment reference_count instead
            await supabase
              .from("user_memory")
              .update({
                reference_count: existing.reference_count + 1,
                last_referenced_at: new Date().toISOString()
              })
              .eq("id", existing.id);
            isDuplicate = true;
            break;
          }
        }
      }

      if (!isDuplicate) {
        memoriesToInsert.push({
          user_id,
          profile_id: conv.profile_id,
          conversation_id,
          source_message_id: message_id,
          memory_text: mem.text,
          memory_type: mem.type,
          confidence_score: mem.confidence || 0.85,
          origin_mode: conv.mode,
          created_at: new Date().toISOString()
        });
      }
    }

    if (memoriesToInsert.length > 0) {
      const { error } = await supabase
        .from("user_memory")
        .insert(memoriesToInsert);

      if (error) throw error;
    }

    return json(200, {
      message: "Memories extracted",
      count: memoriesToInsert.length,
      duplicates: memories.length - memoriesToInsert.length
    });

  } catch (e) {
    console.error("[extract-user-memory] Error:", e);
    return json(500, { error: e.message });
  }
});

// Simple text similarity (Jaccard index of words)
function textSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  return intersection.size / union.size;
}

