// @ts-nocheck
// Generate weekly energy summaries from 4-turn conversation summaries
// Runs weekly (cron job)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
const GEMINI_MODEL = "gemini-2.0-flash-exp";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const json = (status: number, data: any) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

const weeklyPrompt = `Synthesize weekly energy summary from conversation summaries.

Focus on:
- Dominant emotional patterns throughout the week
- Key themes and recurring concerns
- Energy shifts and transitions

Output 2-3 paragraphs capturing the week's essence.`;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get all users with profile-based conversations in the past week
    const { data: conversations } = await supabase
      .from("conversations")
      .select("user_id, profile_id")
      .not("profile_id", "is", null)
      .gte("updated_at", weekAgo.toISOString());

    if (!conversations || conversations.length === 0) {
      return json(200, { message: "No profile conversations this week" });
    }

    const userProfiles = new Map();
    conversations.forEach(c => {
      const key = `${c.user_id}_${c.profile_id}`;
      userProfiles.set(key, { user_id: c.user_id, profile_id: c.profile_id });
    });

    let summariesGenerated = 0;

    for (const [_, { user_id, profile_id }] of userProfiles) {
      // Get user timezone
      const { data: profile } = await supabase
        .from("user_profile_list")
        .select("timezone")
        .eq("id", profile_id)
        .single();

      const timezone = profile?.timezone || "UTC";

      // Calculate week boundaries in user's timezone
      const userNow = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
      const year = userNow.getFullYear();
      const weekNumber = getWeekNumber(userNow);
      const { start, end } = getWeekBoundaries(year, weekNumber, timezone);

      // Check if already generated
      const { data: existing } = await supabase
        .from("user_memory_weekly_summaries")
        .select("id")
        .eq("user_id", user_id)
        .eq("profile_id", profile_id)
        .eq("year", year)
        .eq("week_number", weekNumber)
        .single();

      if (existing) continue;

      // Get 4-turn summaries from this week
      const { data: summaries } = await supabase
        .from("conversation_summaries")
        .select("summary_text, created_at")
        .in("chat_id", conversations.filter(c => c.profile_id === profile_id).map(c => c.id))
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: true });

      if (!summaries || summaries.length === 0) continue;

      const summariesText = summaries.map((s, i) => `Summary ${i + 1}: ${s.summary_text}`).join("\n\n");

      // Generate weekly summary with Gemini
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
      const resp = await fetch(geminiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GOOGLE_API_KEY
        },
        body: JSON.stringify({
          system_instruction: { role: "system", parts: [{ text: weeklyPrompt }] },
          contents: [{ role: "user", parts: [{ text: summariesText }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 400 }
        })
      });

      if (!resp.ok) continue;

      const data = await resp.json();
      const weeklySummary = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

      if (!weeklySummary) continue;

      // Store weekly summary
      await supabase
        .from("user_memory_weekly_summaries")
        .insert({
          user_id,
          profile_id,
          year,
          week_number: weekNumber,
          week_start_date: start.toISOString().split("T")[0],
          week_end_date: end.toISOString().split("T")[0],
          emotional_summary: weeklySummary,
          conversation_count: summaries.length
        });

      summariesGenerated++;
    }

    return json(200, { message: "Weekly summaries generated", count: summariesGenerated });

  } catch (e) {
    console.error("[generate-weekly-summaries] Error:", e);
    return json(500, { error: e.message });
  }
});

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getWeekBoundaries(year: number, week: number, timezone: string) {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const start = new Date(simple);
  if (dow <= 4) start.setDate(simple.getDate() - simple.getDay() + 1);
  else start.setDate(simple.getDate() + 8 - simple.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

