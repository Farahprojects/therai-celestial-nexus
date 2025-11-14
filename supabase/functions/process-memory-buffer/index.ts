// @ts-nocheck
// Intelligent Memory Buffer Processor
// Analyzes accumulated observations and decides what to commit, cache, or discard
// Triggered by: 1) inactivity timeout, 2) buffer threshold, 3) manual invocation

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
  throw new Error("Missing required environment variables");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const json = (status, data) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });

// Intelligent buffer analysis prompt
const bufferAnalysisPrompt = `
You are an intelligent memory consolidation system for an astrology AI companion.

Your task: analyze a set of buffered observations about a user and decide which should be committed to long-term memory, cached for medium-term, or discarded.

Context provided:
- Buffered observations: temporary observations awaiting validation
- Recent conversation turns: messages since observations were made
- Existing memories: already committed user memories

Analysis process:

1. VALIDATION: Check if observations are still accurate given recent turns
   - Was it contradicted? (discard)
   - Was it clarified/expanded? (merge or update)
   - Was it confirmed? (commit)
   - Still uncertain? (keep in buffer)

2. DEDUPLICATION: Check against existing memories
   - Already exists? (discard buffer item)
   - More specific than existing? (supersede)
   - Complementary? (merge)

3. CONSOLIDATION: Look for patterns across buffer items
   - Multiple observations about same topic? (merge into one)
   - Contradictory observations? (keep most recent/confident)
   - Progressive refinement? (keep final state)

4. TIER ASSIGNMENT:
   - long_term: enduring facts, core patterns (months+)
   - medium_term: seasonal patterns, current goals (weeks to months)
   - discard: ephemeral logistics, contradicted, low value

Output STRICT JSON (no markdown):
{
  "actions": [
    {
      "buffer_id": "uuid",
      "action": "commit" | "discard" | "merge" | "supersede" | "keep_buffered",
      "tier": "long_term" | "medium_term" | null,
      "reasoning": "one sentence why",
      "merge_with_buffer_ids": ["uuid"] | null,
      "supersedes_memory_id": "uuid" | null,
      "updated_text": "final consolidated text" | null,
      "updated_confidence": 0.0-1.0 | null,
      "updated_value_score": 0.0-1.0 | null
    }
  ],
  "summary": "brief summary of buffer processing decisions"
}

Rules:
- Favor confirmation over speculation
- Merge similar observations to reduce redundancy
- Discard contradicted or superseded items
- Keep uncertain items buffered (action: "keep_buffered") until next check
- Only commit high-value, validated observations
- Minimum confidence for commit: 0.75
- Minimum value_score for commit: 0.65
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const { conversation_id, user_id, force = false } = await req.json();

    console.log("[process-memory-buffer] Request received:", {
      conversation_id,
      user_id,
      force
    });

    if (!conversation_id || !user_id) {
      return json(400, { error: "Missing required fields: conversation_id, user_id" });
    }

    // Check if processing is already scheduled (prevent duplicates)
    const { data: activity } = await supabase
      .from("conversation_activity")
      .select("buffer_processing_scheduled, pending_buffer_count, last_activity_at")
      .eq("conversation_id", conversation_id)
      .single();

    if (!force && activity?.buffer_processing_scheduled) {
      console.log("[process-memory-buffer] Processing already scheduled, skipping");
      return json(200, { message: "Processing already scheduled", skipped: true });
    }

    if (!activity || activity.pending_buffer_count === 0) {
      console.log("[process-memory-buffer] No pending buffer items");
      return json(200, { message: "No pending buffer items", skipped: true });
    }

    // Mark as processing
    await supabase
      .from("conversation_activity")
      .update({ 
        buffer_processing_scheduled: true,
        updated_at: new Date().toISOString()
      })
      .eq("conversation_id", conversation_id);

    // Fetch pending buffer items for this conversation
    const { data: bufferItems, error: bufferError } = await supabase
      .from("user_memory_buffer")
      .select("*")
      .eq("conversation_id", conversation_id)
      .eq("user_id", user_id)
      .eq("status", "pending")
      .order("first_seen_at", { ascending: true });

    if (bufferError || !bufferItems || bufferItems.length === 0) {
      console.log("[process-memory-buffer] No buffer items found:", bufferError);
      
      // Reset scheduling flag
      await supabase
        .from("conversation_activity")
        .update({ buffer_processing_scheduled: false })
        .eq("conversation_id", conversation_id);
      
      return json(200, { message: "No buffer items to process", count: 0 });
    }

    console.log(`[process-memory-buffer] Processing ${bufferItems.length} buffer items`);

    // Fetch conversation context (messages since earliest buffer item)
    const earliestBufferTime = bufferItems[0].first_seen_at;
    const { data: recentMessages } = await supabase
      .from("messages")
      .select("role, text, created_at")
      .eq("chat_id", conversation_id)
      .eq("status", "complete")
      .gte("created_at", earliestBufferTime)
      .order("created_at", { ascending: true })
      .limit(20);

    // Fetch existing memories for deduplication
    const { data: existingMemories } = await supabase
      .from("user_memory")
      .select("id, memory_text, memory_type, confidence_score")
      .eq("user_id", user_id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(50);

    // Build analysis context
    const contextText = buildAnalysisContext(bufferItems, recentMessages, existingMemories);

    // Call Gemini for intelligent analysis
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
    const requestBody = {
      system_instruction: {
        role: "system",
        parts: [{ text: bufferAnalysisPrompt }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: contextText }]
        }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2000,
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
      const errorText = await resp.text();
      console.error("[process-memory-buffer] Gemini API error:", resp.status, errorText);
      
      // Reset scheduling flag on error
      await supabase
        .from("conversation_activity")
        .update({ buffer_processing_scheduled: false })
        .eq("conversation_id", conversation_id);
      
      throw new Error(`Gemini API error: ${resp.status}`);
    }

    const data = await resp.json();
    const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const analysis = safeJson(responseText) || { actions: [] };

    console.log("[process-memory-buffer] Analysis received:", {
      action_count: analysis.actions?.length || 0,
      summary: analysis.summary
    });

    // Process each action
    const results = {
      committed: 0,
      discarded: 0,
      merged: 0,
      kept_buffered: 0,
      errors: []
    };

    for (const action of analysis.actions || []) {
      try {
        await processAction(action, conversation_id, user_id, bufferItems, existingMemories, results);
      } catch (err) {
        console.error("[process-memory-buffer] Action processing error:", err);
        results.errors.push({
          buffer_id: action.buffer_id,
          error: err.message
        });
      }
    }

    // Update activity tracking
    await supabase
      .from("conversation_activity")
      .update({
        last_buffer_processed_at: new Date().toISOString(),
        buffer_processing_scheduled: false,
        updated_at: new Date().toISOString()
      })
      .eq("conversation_id", conversation_id);

    console.log("[process-memory-buffer] Processing complete:", results);

    return json(200, {
      message: "Buffer processed",
      results,
      analysis_summary: analysis.summary
    });

  } catch (e) {
    console.error("[process-memory-buffer] Error:", e);
    
    // Try to reset scheduling flag on error
    if (req.json) {
      try {
        const { conversation_id } = await req.json();
        if (conversation_id) {
          await supabase
            .from("conversation_activity")
            .update({ buffer_processing_scheduled: false })
            .eq("conversation_id", conversation_id);
        }
      } catch (_) {
        // Ignore errors during cleanup
      }
    }
    
    return json(500, { error: e.message ?? "Unknown error" });
  }
});

// Build context for AI analysis
function buildAnalysisContext(bufferItems, recentMessages, existingMemories) {
  let context = "# Buffer Analysis Context\n\n";

  // Buffered observations
  context += "## Buffered Observations (awaiting validation):\n\n";
  bufferItems.forEach((item, idx) => {
    context += `${idx + 1}. [ID: ${item.id}]\n`;
    context += `   Type: ${item.observation_type}\n`;
    context += `   Text: "${item.observation_text}"\n`;
    context += `   Confidence: ${item.confidence_score}, Value: ${item.value_score}\n`;
    context += `   Time horizon: ${item.time_horizon}\n`;
    context += `   First seen: ${item.first_seen_at}, Turns observed: ${item.turns_observed}\n\n`;
  });

  // Recent conversation turns
  if (recentMessages && recentMessages.length > 0) {
    context += "## Recent Conversation Turns (since first buffer item):\n\n";
    recentMessages.forEach((msg) => {
      context += `${msg.role === "assistant" ? "AI" : "User"}: ${msg.text}\n\n`;
    });
  }

  // Existing memories
  if (existingMemories && existingMemories.length > 0) {
    context += "## Existing Long-term Memories:\n\n";
    existingMemories.forEach((mem, idx) => {
      context += `${idx + 1}. [ID: ${mem.id}] ${mem.memory_type}: "${mem.memory_text}" (confidence: ${mem.confidence_score})\n`;
    });
  }

  context += "\n## Your task:\n";
  context += "Analyze the buffered observations against recent conversation and existing memories.\n";
  context += "For each buffer item, decide: commit (to which tier), discard, merge, supersede, or keep_buffered.\n";
  context += "Return your analysis as structured JSON following the schema provided.\n";

  return context;
}

// Process individual action from AI analysis
async function processAction(action, conversation_id, user_id, bufferItems, existingMemories, results) {
  const bufferItem = bufferItems.find(item => item.id === action.buffer_id);
  if (!bufferItem) {
    console.warn(`[process-memory-buffer] Buffer item not found: ${action.buffer_id}`);
    return;
  }

  switch (action.action) {
    case "commit":
      await commitToMemory(bufferItem, action, conversation_id, user_id);
      results.committed++;
      break;

    case "discard":
      await discardBufferItem(bufferItem, action.reasoning);
      results.discarded++;
      break;

    case "merge":
      await mergeBufferItems(bufferItem, action, conversation_id, user_id, bufferItems);
      results.merged++;
      break;

    case "supersede":
      await supersedeMemoryOrBuffer(bufferItem, action, conversation_id, user_id, existingMemories);
      results.committed++;
      break;

    case "keep_buffered":
      await updateBufferItem(bufferItem, {
        turns_observed: bufferItem.turns_observed + 1,
        last_seen_at: new Date().toISOString(),
        extraction_metadata: {
          ...bufferItem.extraction_metadata,
          last_analysis: action.reasoning,
          analyzed_at: new Date().toISOString()
        }
      });
      results.kept_buffered++;
      break;

    default:
      console.warn(`[process-memory-buffer] Unknown action: ${action.action}`);
  }
}

// Commit buffer item to long-term or medium-term memory
async function commitToMemory(bufferItem, action, conversation_id, user_id) {
  const finalText = action.updated_text || bufferItem.observation_text;
  const finalConfidence = action.updated_confidence ?? bufferItem.confidence_score;
  const finalValueScore = action.updated_value_score ?? bufferItem.value_score;

  // Check minimum thresholds
  if (finalConfidence < 0.75 || finalValueScore < 0.65) {
    console.log(`[process-memory-buffer] Commit rejected - below threshold:`, {
      confidence: finalConfidence,
      value_score: finalValueScore
    });
    await discardBufferItem(bufferItem, "Below minimum thresholds for commit");
    return;
  }

  // Dedup check
  const canonical = canonicalize(finalText);
  const canonicalHash = await sha256Hex(canonical);

  const { data: existing } = await supabase
    .from("user_memory")
    .select("id")
    .eq("user_id", user_id)
    .eq("profile_id", bufferItem.profile_id)
    .eq("is_active", true)
    .eq("canonical_hash", canonicalHash)
    .maybeSingle();

  if (existing) {
    console.log(`[process-memory-buffer] Duplicate detected, discarding buffer item`);
    await discardBufferItem(bufferItem, "Duplicate of existing memory");
    return;
  }

  // Insert into user_memory
  const memoryRow = {
    user_id,
    profile_id: bufferItem.profile_id,
    conversation_id,
    source_message_id: bufferItem.source_message_id,
    memory_text: finalText,
    memory_type: bufferItem.observation_type,
    confidence_score: finalConfidence,
    origin_mode: 'chat',
    reference_count: 1,
    canonical_hash: canonicalHash,
    memory_tier: action.tier || 'long_term',
    promoted_from_buffer_id: bufferItem.id,
    memory_metadata: {
      time_horizon: bufferItem.time_horizon,
      value_score: finalValueScore,
      rationale: action.reasoning,
      extractor: "intelligent_buffer",
      extractor_model: GEMINI_MODEL,
      buffer_turns_observed: bufferItem.turns_observed,
      promoted_at: new Date().toISOString()
    }
  };

  const { error: insertError } = await supabase
    .from("user_memory")
    .insert([memoryRow]);

  if (insertError) {
    console.error("[process-memory-buffer] Memory insert failed:", insertError);
    throw insertError;
  }

  // Mark buffer item as confirmed and committed
  await supabase
    .from("user_memory_buffer")
    .update({
      status: "confirmed",
      updated_at: new Date().toISOString(),
      extraction_metadata: {
        ...bufferItem.extraction_metadata,
        committed_at: new Date().toISOString(),
        commit_reasoning: action.reasoning,
        memory_tier: action.tier
      }
    })
    .eq("id", bufferItem.id);

  console.log("[process-memory-buffer] Memory committed:", {
    buffer_id: bufferItem.id,
    tier: action.tier,
    text: finalText.substring(0, 50)
  });
}

// Discard buffer item
async function discardBufferItem(bufferItem, reasoning) {
  await supabase
    .from("user_memory_buffer")
    .update({
      status: "contradicted",
      updated_at: new Date().toISOString(),
      extraction_metadata: {
        ...bufferItem.extraction_metadata,
        discarded_at: new Date().toISOString(),
        discard_reasoning: reasoning
      }
    })
    .eq("id", bufferItem.id);

  console.log("[process-memory-buffer] Buffer item discarded:", {
    buffer_id: bufferItem.id,
    reasoning
  });
}

// Merge multiple buffer items into one committed memory
async function mergeBufferItems(primaryItem, action, conversation_id, user_id, allBufferItems) {
  const mergeIds = action.merge_with_buffer_ids || [];
  const itemsToMerge = allBufferItems.filter(item => mergeIds.includes(item.id));

  // Mark merged items as merged
  for (const item of itemsToMerge) {
    await supabase
      .from("user_memory_buffer")
      .update({
        status: "merged",
        updated_at: new Date().toISOString(),
        related_buffer_ids: [primaryItem.id],
        extraction_metadata: {
          ...item.extraction_metadata,
          merged_at: new Date().toISOString(),
          merged_into: primaryItem.id
        }
      })
      .eq("id", item.id);
  }

  // Commit the primary item with merged data
  await commitToMemory(primaryItem, action, conversation_id, user_id);
}

// Supersede existing memory or buffer with new version
async function supersedeMemoryOrBuffer(bufferItem, action, conversation_id, user_id, existingMemories) {
  if (action.supersedes_memory_id) {
    // Deactivate existing memory
    await supabase
      .from("user_memory")
      .update({
        is_active: false,
        memory_metadata: {
          superseded_at: new Date().toISOString(),
          superseded_by_buffer: bufferItem.id
        }
      })
      .eq("id", action.supersedes_memory_id);

    console.log("[process-memory-buffer] Superseded existing memory:", action.supersedes_memory_id);
  }

  // Commit new version
  await commitToMemory(bufferItem, action, conversation_id, user_id);
}

// Update buffer item metadata
async function updateBufferItem(bufferItem, updates) {
  await supabase
    .from("user_memory_buffer")
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq("id", bufferItem.id);
}

// Utilities
function safeJson(text) {
  try {
    const stripped = text.trim().replace(/^```json\s*|\s*```$/g, "");
    return JSON.parse(stripped);
  } catch {
    return null;
  }
}

function canonicalize(text) {
  if (!text) return "";
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

