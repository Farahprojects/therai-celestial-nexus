// @ts-nocheck
// Scheduled Cron: Process Inactive Memory Buffers
// Runs every 15 minutes to catch any buffers that weren't processed by inline checks
// Acts as a safety net for the intelligent memory system

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing required environment variables");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const json = (status, data) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });

Deno.serve(async (req) => {
  const startTime = Date.now();
  const cronId = crypto.randomUUID().substring(0, 8);

  console.log(`[process-inactive-buffers-cron] Starting cron job ${cronId}`);

  try {
    // Find all conversations with pending buffers that have been inactive for 10+ minutes
    const { data: conversationsToProcess, error: queryError } = await supabase
      .rpc('get_conversations_needing_buffer_processing', { inactivity_minutes: 10 });

    if (queryError) {
      console.error(`[process-inactive-buffers-cron] Query error:`, queryError);
      return json(500, { error: queryError.message });
    }

    if (!conversationsToProcess || conversationsToProcess.length === 0) {
      console.log(`[process-inactive-buffers-cron] No conversations need processing`);
      return json(200, { 
        message: "No conversations need processing", 
        processed: 0,
        duration_ms: Date.now() - startTime
      });
    }

    console.log(`[process-inactive-buffers-cron] Found ${conversationsToProcess.length} conversations to process`);

    // Process each conversation (fire-and-forget, parallel)
    const processingPromises = conversationsToProcess.map(async (conv) => {
      try {
        console.log(`[process-inactive-buffers-cron] Processing conversation ${conv.conversation_id}:`, {
          user_id: conv.user_id,
          pending_count: conv.pending_count,
          minutes_since_activity: conv.minutes_since_activity
        });

        const response = await fetch(`${SUPABASE_URL}/functions/v1/process-memory-buffer`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify({
            conversation_id: conv.conversation_id,
            user_id: conv.user_id,
            force: false
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[process-inactive-buffers-cron] Failed to process ${conv.conversation_id}:`, errorText);
          return { conversation_id: conv.conversation_id, success: false, error: errorText };
        }

        const result = await response.json();
        console.log(`[process-inactive-buffers-cron] Successfully processed ${conv.conversation_id}:`, result);
        return { conversation_id: conv.conversation_id, success: true, result };
      } catch (err) {
        console.error(`[process-inactive-buffers-cron] Exception processing ${conv.conversation_id}:`, err);
        return { 
          conversation_id: conv.conversation_id, 
          success: false, 
          error: err instanceof Error ? err.message : String(err) 
        };
      }
    });

    // Wait for all processing to complete
    const results = await Promise.all(processingPromises);
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    console.log(`[process-inactive-buffers-cron] Cron job ${cronId} complete:`, {
      total: results.length,
      success: successCount,
      failed: failureCount,
      duration_ms: Date.now() - startTime
    });

    return json(200, {
      message: "Cron job complete",
      processed: results.length,
      success: successCount,
      failed: failureCount,
      duration_ms: Date.now() - startTime,
      results
    });

  } catch (e) {
    console.error(`[process-inactive-buffers-cron] Fatal error in cron job ${cronId}:`, e);
    return json(500, { error: e.message ?? "Unknown error" });
  }
});

