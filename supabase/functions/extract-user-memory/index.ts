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

const json = (status, data) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });

// Memory extraction prompt, single best memory with value scoring and safety gates
const extractionPrompt = `
You are a memory extraction system for an astrology-based AI companion focused on energy patterns, cycles, and self-relationship.

Given a short conversation window (latest user + assistant turn with brief context), decide whether there is exactly one valuable memory to save about the user.

Only save if it materially helps future personalization and has enduring or seasonal value.

Memory schema:

type: one of [fact, emotion, goal, pattern, relationship]
text: 1-2 sentences, concise, neutral, non-judgmental
confidence: 0.50-1.00 (how certain the statement is correct)
value_score: 0.00-1.00 (how useful this is for future personalization)
time_horizon: "enduring" (months+), "seasonal" (weeks to months), "ephemeral" (days)
rationale: one sentence explaining why this adds value

Rules:

Prefer enduring or seasonal memories. Avoid ephemeral logistics (e.g., "tomorrow", "next call", "this weekend").
Do not store medical diagnoses, financial hardship claims, exact addresses, phone numbers, emails, or government IDs.
Focus on energy patterns, emotional tendencies, motivations, goals, relationship dynamics, recurring cycles, and significant life facts.
If content is unclear, speculative, or only about the AI, skip.
If multiple candidates exist, choose the single best one by value_score.
If nothing is clearly useful, return decision=skip.

Output STRICT JSON (no markdown, no comments):
{
"decision": "save" | "skip",
"memory": {
"type": "fact" | "emotion" | "goal" | "pattern" | "relationship",
"text": "...",
"confidence": 0.0,
"value_score": 0.0,
"time_horizon": "enduring" | "seasonal" | "ephemeral",
"rationale": "..."
}
}

Examples to SAVE:

"User feels anxious during Mercury retrogrades and plans extra self-care" (pattern, seasonal)
"User intends to practice clearer boundary-setting with their sister this quarter" (goal, seasonal)
"User started a new role as a product designer in 2024" (fact, enduring)
"User notices feeling energized during Mars transits and uses that for workouts" (pattern, seasonal)

Examples to SKIP:

Pleasantries, praise/complaints about the AI, scheduling, one-off errands, vague speculation, or sensitive PII.
Medical or financial diagnoses (unless anonymized and explicitly user-provided goals without sensitive claims, and still prefer skip).

Return only the JSON object described above.
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const { conversation_id, message_id, user_id } = await req.json();

    if (!conversation_id || !message_id || !user_id) {
      return json(400, { error: "Missing required fields" });
    }

    // Ensure this message exists and is an assistant message we act upon
    const { data: msg, error: msgErr } = await supabase
      .from("messages")
      .select("id, chat_id, role, status, created_at")
      .eq("id", message_id)
      .single();

    if (msgErr || !msg) return json(400, { error: "Message not found" });
    if (msg.role !== "assistant" || msg.status !== "complete") {
      return json(200, { message: "Not an eligible assistant message", skipped: true });
    }

    // Check idempotency: already extracted for this message?
    const { data: existing } = await supabase
      .from("user_memory")
      .select("id")
      .eq("conversation_id", conversation_id)
      .eq("source_message_id", message_id)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return json(200, { message: "Already extracted", skipped: true });
    }

    // Validate conversation -> profile, and ownership
    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .select("id, profile_id, mode, user_id")
      .eq("id", conversation_id)
      .single();

    if (convErr || !conv) return json(400, { error: "Conversation not found" });
    if (!conv.profile_id) return json(200, { message: "No profile selected", skipped: true });
    if (conv.user_id !== user_id) return json(403, { error: "User mismatch for conversation" });

    const { data: profile, error: profileErr } = await supabase
      .from("user_profile_list")
      .select("id, is_primary, user_id")
      .eq("id", conv.profile_id)
      .single();

    if (profileErr || !profile) return json(400, { error: "Profile not found" });
    if (!profile.is_primary || profile.user_id !== user_id) {
      return json(200, { message: "Not primary profile or user mismatch", skipped: true });
    }

    // Build a small context window up to the assistant message
    const { data: windowMsgs, error: windowErr } = await supabase
      .from("messages")
      .select("id, role, text, created_at")
      .eq("chat_id", conversation_id)
      .lte("created_at", msg.created_at)
      .eq("status", "complete")
      .order("created_at", { ascending: false })
      .limit(8);

    if (windowErr || !windowMsgs || windowMsgs.length === 0) {
      return json(400, { error: "No messages found for context" });
    }

    const conversationText = windowMsgs
      .slice()
      .reverse()
      .map(m => `${m.role === "assistant" ? "AI" : "User"}: ${m.text}`)
      .join("\n\n");

    // Call Gemini for extraction (one best candidate or skip)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
    const requestBody = {
      system_instruction: {
        role: "system",
        parts: [{ text: extractionPrompt }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: `Analyze this short conversation window and return either one valuable memory or skip:\n\n${conversationText}` }]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 300,
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

    if (!resp.ok) throw new Error(`Gemini API error: ${resp.status}`);

    const data = await resp.json();
    const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const parsed = safeJson(responseText) || { decision: "skip" };

    if (parsed.decision !== "save" || !parsed.memory) {
      return json(200, { message: "No valuable memory this turn", count: 0 });
    }

    const mem = sanitizeMemory(parsed.memory);

    // Hard filters: only store if high-value & safe
    if (!isAllowedType(mem.type)) {
      return json(200, { message: "Rejected: unsupported type", skipped: true });
    }

    if (!passesSafety(mem.text)) {
      return json(200, { message: "Rejected: safety/PII/medical/financial", skipped: true });
    }

    // Minimum quality thresholds
    if (!mem.text || mem.text.length < 10 || mem.text.length > 300) {
      return json(200, { message: "Rejected: low content value", skipped: true });
    }

    if ((mem.confidence ?? 0) < 0.82) {
      return json(200, { message: "Rejected: low confidence", skipped: true });
    }

    if ((mem.value_score ?? 0) < 0.72) {
      return json(200, { message: "Rejected: low value", skipped: true });
    }

    if (mem.time_horizon === "ephemeral") {
      return json(200, { message: "Rejected: ephemeral", skipped: true });
    }

    // Dedup: canonical hash + fuzzy text similarity fallback
    const canonical = canonicalize(mem.text);
    const canonicalHash = await sha256Hex(canonical);

    // First try hash-based match if column exists
    let duplicateHandled = false;
    let usedHashDedup = false;

    try {
      const { data: existingByHash, error: hashErr } = await supabase
        .from("user_memory")
        .select("id, memory_text, reference_count")
        .eq("user_id", user_id)
        .eq("profile_id", conv.profile_id)
        .eq("is_active", true)
        .eq("canonical_hash", canonicalHash)
        .limit(1)
        .maybeSingle();

      if (!hashErr && existingByHash) {
        await supabase
          .from("user_memory")
          .update({
            reference_count: (existingByHash.reference_count ?? 0) + 1,
            last_referenced_at: new Date().toISOString()
          })
          .eq("id", existingByHash.id);

        duplicateHandled = true;
        usedHashDedup = true;
      }
    } catch (_) {
      // Column may not exist; fall through to fuzzy dedup
    }

    if (!duplicateHandled) {
      // Fuzzy dedup on recent memories (Jaccard similarity)
      const { data: recentMemories } = await supabase
        .from("user_memory")
        .select("id, memory_text, reference_count")
        .eq("user_id", user_id)
        .eq("profile_id", conv.profile_id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(200);

      if (recentMemories && recentMemories.length > 0) {
        const SIM_THRESHOLD = 0.7;
        const normalizedNew = canonical; // Already normalized
        for (const ex of recentMemories) {
          const sim = jaccardSimilarity(normalizedNew, canonicalize(ex.memory_text));
          if (sim >= SIM_THRESHOLD) {
            await supabase
              .from("user_memory")
              .update({
                reference_count: (ex.reference_count ?? 0) + 1,
                last_referenced_at: new Date().toISOString()
              })
              .eq("id", ex.id);
            duplicateHandled = true;
            break;
          }
        }
      }
    }

    if (duplicateHandled) {
      // Mark this message as processed to ensure one-per-turn idempotency
      await markSourceSeen(conversation_id, message_id, {
        user_id,
        profile_id: conv.profile_id,
        origin_mode: conv.mode
      });

      return json(200, {
        message: usedHashDedup ? "Duplicate (hash) -> reference_count++" : "Duplicate (fuzzy) -> reference_count++",
        count: 0,
        duplicates: 1
      });
    }

    // Insert a single memory
    const memoryRow = {
      user_id,
      profile_id: conv.profile_id,
      conversation_id,
      source_message_id: message_id,
      memory_text: mem.text,
      memory_type: mem.type,
      confidence_score: clamp(mem.confidence ?? 0.85, 0, 1),
      origin_mode: conv.mode,
      reference_count: 1,
      canonical_hash: canonicalHash, // If column exists, it's used; otherwise ignored
      memory_metadata: {
        time_horizon: mem.time_horizon,
        value_score: clamp(mem.value_score ?? 0.75, 0, 1),
        rationale: mem.rationale?.slice(0, 300) ?? null,
        extractor: "gemini",
        extractor_model: GEMINI_MODEL
      },
      created_at: new Date().toISOString()
    };

    const insertRes = await supabase.from("user_memory").insert([memoryRow]);
    if (insertRes.error) throw insertRes.error;

    return json(200, { message: "Memory saved", count: 1, duplicates: 0 });
  } catch (e) {
    console.error("[extract-user-memory] Error:", e);
    return json(500, { error: e.message ?? "Unknown error" });
  }
});

// Utility: robust JSON parsing (handles code fences or stray text)
function safeJson(text) {
  try {
    // Strip Markdown fences if present
    const stripped = text.trim().replace(/^json\s*|\s*$/g, "");
    return JSON.parse(stripped);
  } catch {
    return null;
  }
}

function isAllowedType(t) {
  return ["fact", "emotion", "goal", "pattern", "relationship"].includes(String(t || "").toLowerCase());
}

// Simple safety filters (PII, medical, financial, direct contact)
function passesSafety(text) {
  const lower = (text || "").toLowerCase();

  // Disallow contact info/PII patterns
  const hasEmail = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text);
  const hasPhone = /(\+?\d{1,3}[-.\s]?)?(\(?\d{2,4}\)?[-.\s]?)?\d{3}[-.\s]?\d{3,4}/.test(text);
  const hasAddressHints = /(street|st\.|ave\.|avenue|road|rd\.|apartment|apt\.|suite|unit|zip)/i.test(text);

  if (hasEmail || hasPhone || hasAddressHints) return false;

  // Medical/financial keywords (coarse filter, err on skip)
  const medical = /(diagnosed|diagnosis|prescribed|antidepressant|bipolar|adhd|ptsd|autism|diabetes|cancer|therapy plan)/i.test(lower);
  const financial = /(bankruptcy|debt crisis|foreclosure|cannot pay rent|loan default|eviction)/i.test(lower);

  if (medical || financial) return false;

  return true;
}

// Canonicalization for stable hashing and fuzzy matching
function canonicalize(text) {
  if (!text) return "";

  // Lowercase, remove punctuation, collapse spaces, remove common stopwords
  const stop = new Set(["the","a","an","and","or","but","if","on","in","at","to","for","of","with","about","into","during","including","over","between","out","up","down","from","as","by","is","are","was","were","be","been","being","this","that","these","those","i","me","my","mine","you","your","yours"]);

  const cleaned = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = cleaned.split(" ").filter(w => w && !stop.has(w));
  return tokens.join(" ");
}

async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hashBuffer)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// Fuzzy similarity: Jaccard of tokens on canonicalized strings
function jaccardSimilarity(a, b) {
  const setA = new Set(a.split(" ").filter(Boolean));
  const setB = new Set(b.split(" ").filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const w of setA) if (setB.has(w)) intersection++;
  return intersection / (setA.size + setB.size - intersection);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function sanitizeMemory(mem) {
  const type = String(mem?.type || "").toLowerCase();
  const time_horizon = ["enduring","seasonal","ephemeral"].includes(mem?.time_horizon) ? mem.time_horizon : "seasonal";
  const text = String(mem?.text || "").trim().slice(0, 500);
  const confidence = Number(mem?.confidence ?? 0.85);
  const value_score = Number(mem?.value_score ?? 0.75);
  const rationale = mem?.rationale ? String(mem.rationale).trim() : "";

  return { type, text, confidence, value_score, time_horizon, rationale };
}

// Mark a source message as "seen" by inserting a zero-length memory row if needed
// or by relying on source_message_id uniqueness. If your DB has a unique index
// on (source_message_id), you can skip this helper.
async function markSourceSeen(conversation_id, message_id, extra = {}) {
  // No-op placeholder; relies on unique (source_message_id) and prior check.
  return true;
}
