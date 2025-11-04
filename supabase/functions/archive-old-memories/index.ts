// @ts-nocheck
// Archive old memories based on retention limits
// Runs daily (cron job)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const json = (status: number, data: any) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

// Retention limits per user
const MAX_ACTIVE_MEMORIES = 200;
const MAX_UNREFERENCED_AGE_DAYS = 90;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    // Get all users with memories
    const { data: users } = await supabase
      .from("user_memory")
      .select("user_id")
      .eq("is_active", true);

    if (!users || users.length === 0) {
      return json(200, { message: "No memories to archive" });
    }

    const uniqueUsers = [...new Set(users.map(u => u.user_id))];
    let archivedCount = 0;

    for (const userId of uniqueUsers) {
      // Archive unreferenced old memories
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - MAX_UNREFERENCED_AGE_DAYS);

      const { data: unreferencedOld } = await supabase
        .from("user_memory")
        .select("id")
        .eq("user_id", userId)
        .eq("is_active", true)
        .eq("reference_count", 0)
        .lt("created_at", cutoffDate.toISOString());

      if (unreferencedOld && unreferencedOld.length > 0) {
        await supabase
          .from("user_memory")
          .update({ is_active: false })
          .in("id", unreferencedOld.map(m => m.id));

        archivedCount += unreferencedOld.length;
      }

      // Enforce max active memories limit
      const { data: allActive } = await supabase
        .from("user_memory")
        .select("id")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("reference_count", { ascending: false })
        .order("created_at", { ascending: false });

      if (allActive && allActive.length > MAX_ACTIVE_MEMORIES) {
        const toArchive = allActive.slice(MAX_ACTIVE_MEMORIES);
        await supabase
          .from("user_memory")
          .update({ is_active: false })
          .in("id", toArchive.map(m => m.id));

        archivedCount += toArchive.length;
      }
    }

    return json(200, {
      message: "Memory archival complete",
      archived: archivedCount,
      users_processed: uniqueUsers.length
    });

  } catch (e) {
    console.error("[archive-old-memories] Error:", e);
    return json(500, { error: e.message });
  }
});

