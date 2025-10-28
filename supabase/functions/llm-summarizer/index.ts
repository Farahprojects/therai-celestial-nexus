// Lightweight summarizer agent for conversation context
// Uses Gemini Flash to distill psychological/energetic patterns
// Output: 100-200 token summary (NO astro data)

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

// @ts-ignore - ESM import works in Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin"
};

const json = (status: number, data: any) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });

// Env
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const GOOGLE_API_KEY = Deno.env.get("GOOGLE-LLM-NEW");
const GEMINI_MODEL = "gemini-2.0-flash-exp"; // Fast and cheap for summaries
const TIMEOUT_MS = 15000;

if (!SUPABASE_URL) throw new Error("Missing env: SUPABASE_URL");
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
if (!GOOGLE_API_KEY) throw new Error("Missing env: GOOGLE-LLM-NEW");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const summaryPrompt = `You are a conversation summarizer focused on psychological and energetic context.

Your task: Distill the conversation into a brief summary (100-200 tokens) that captures:
- Emotional patterns and themes
- User's concerns, questions, and desires
- Psychological dynamics and behavioral patterns
- Relational or interpersonal context if present

DO NOT include:
- Astrological data or planetary information (this is stored separately)
- Specific dates, times, or birth data
- Technical details or astro jargon

Focus on the human experience and emotional landscape. Write in a neutral, observational tone.`;

Deno.serve(async (req) => {
  console.log("[llm-summarizer] Request received");

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const { chat_id, from_turn, to_turn } = body || {};

  if (!chat_id || typeof chat_id !== "string") {
    return json(400, { error: "Missing or invalid field: chat_id" });
  }

  const fromTurn = typeof from_turn === "number" ? from_turn : 0;
  const toTurn = typeof to_turn === "number" ? to_turn : 999999;

  console.log(`[llm-summarizer] Generating summary for chat_id: ${chat_id}, turns ${fromTurn}-${toTurn}`);

  try {
    // Fetch messages for the specified turn range
    // Exclude system messages (context-injected astro data)
    const { data: messages, error: fetchError } = await supabase
      .from("messages")
      .select("role, text, created_at")
      .eq("chat_id", chat_id)
      .neq("role", "system")
      .eq("status", "complete")
      .not("text", "is", null)
      .neq("text", "")
      .order("created_at", { ascending: true });

    if (fetchError) {
      console.error("[llm-summarizer] Failed to fetch messages:", fetchError);
      return json(500, { error: "Failed to fetch messages" });
    }

    if (!messages || messages.length === 0) {
      console.log("[llm-summarizer] No messages found, returning empty summary");
      return json(200, { summary: "", message_count: 0 });
    }

    // Build conversation text for summarization
    const conversationText = messages
      .map((m: any) => {
        const role = m.role === "assistant" ? "AI" : "User";
        return `${role}: ${m.text}`;
      })
      .join("\n\n");

    console.log(`[llm-summarizer] Processing ${messages.length} messages (${conversationText.length} chars)`);

    // Call Gemini Flash for summary
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
    const requestBody = {
      system_instruction: {
        role: "system",
        parts: [{ text: summaryPrompt }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: `Summarize this conversation:\n\n${conversationText}` }]
        }
      ],
      generationConfig: {
        temperature: 0.3, // Lower for consistent summaries
        maxOutputTokens: 250
      }
    };

    const resp = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GOOGLE_API_KEY
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.error("[llm-summarizer] Gemini API error:", resp.status, errText);
      return json(502, { error: `Gemini API failed: ${resp.status}` });
    }

    const data = await resp.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const summary = parts.map((p: any) => p?.text || "").join(" ").trim();

    if (!summary) {
      console.error("[llm-summarizer] No summary generated");
      return json(502, { error: "No summary generated" });
    }

    console.log(`[llm-summarizer] Summary generated: ${summary.length} chars`);

    // Store summary in database
    const turnRange = `${fromTurn}-${toTurn}`;
    const { error: insertError } = await supabase
      .from("conversation_summaries")
      .insert({
        chat_id,
        summary_text: summary,
        turn_range: turnRange,
        message_count: messages.length
      });

    if (insertError) {
      console.error("[llm-summarizer] Failed to store summary:", insertError);
      // Don't fail the request - summary was generated successfully
    }

    return json(200, {
      summary,
      message_count: messages.length,
      turn_range: turnRange
    });

  } catch (e: any) {
    console.error("[llm-summarizer] Exception:", e?.message || String(e));
    return json(500, { error: `Summary generation failed: ${e?.message || String(e)}` });
  }
});

