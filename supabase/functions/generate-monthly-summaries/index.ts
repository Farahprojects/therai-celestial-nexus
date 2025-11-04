// @ts-nocheck
// Generate monthly summaries from weekly summaries
// Runs monthly (cron job) + manual backfill endpoint

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

const monthlyPrompt = `Synthesize monthly energy and growth summary from weekly summaries.

Focus on:
- Emotional and cognitive patterns across the month
- Key themes and how they evolved
- Notable shifts or transitions
- Astrological context (if available)

Output JSON:
{
  "emotional_summary": "2-3 paragraphs",
  "cognitive_summary": "2-3 paragraphs",
  "key_themes": ["theme1", "theme2", ...],
  "insights": "Growth patterns observed"
}`;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const body = await req.json();
    const action = body?.action || "generate";
    
    let targetYear, targetMonth;
    
    if (action === "backfill" && body.year && body.month) {
      targetYear = body.year;
      targetMonth = body.month;
    } else {
      // Default: previous month
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      targetYear = lastMonth.getFullYear();
      targetMonth = lastMonth.getMonth() + 1;
    }

    // Get all users with weekly summaries from target month
    const { data: weeklySummaries } = await supabase
      .from("user_memory_weekly_summaries")
      .select("user_id, profile_id, emotional_summary")
      .eq("year", targetYear)
      .gte("week_number", getFirstWeekOfMonth(targetYear, targetMonth))
      .lte("week_number", getLastWeekOfMonth(targetYear, targetMonth));

    if (!weeklySummaries || weeklySummaries.length === 0) {
      return json(200, { message: "No weekly summaries found for this month" });
    }

    const userProfiles = new Map();
    weeklySummaries.forEach(w => {
      const key = `${w.user_id}_${w.profile_id}`;
      if (!userProfiles.has(key)) {
        userProfiles.set(key, { user_id: w.user_id, profile_id: w.profile_id, summaries: [] });
      }
      userProfiles.get(key).summaries.push(w.emotional_summary);
    });

    let summariesGenerated = 0;

    for (const [_, { user_id, profile_id, summaries }] of userProfiles) {
      // Check if already exists
      const { data: existing } = await supabase
        .from("user_memory_monthly_summaries")
        .select("id")
        .eq("user_id", user_id)
        .eq("profile_id", profile_id)
        .eq("year", targetYear)
        .eq("month", targetMonth)
        .single();

      if (existing && action !== "backfill") continue;

      const weeklySummariesText = summaries.map((s, i) => `Week ${i + 1}:\n${s}`).join("\n\n");

      // Generate monthly summary with Gemini
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
      const resp = await fetch(geminiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GOOGLE_API_KEY
        },
        body: JSON.stringify({
          system_instruction: { role: "system", parts: [{ text: monthlyPrompt }] },
          contents: [{ role: "user", parts: [{ text: weeklySummariesText }] }],
          generationConfig: { 
            temperature: 0.4, 
            maxOutputTokens: 800,
            responseMimeType: "application/json"
          }
        })
      });

      if (!resp.ok) continue;

      const data = await resp.json();
      const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const result = JSON.parse(responseText);

      if (!result.emotional_summary) continue;

      // Upsert monthly summary
      const monthlySummary = {
        user_id,
        profile_id,
        year: targetYear,
        month: targetMonth,
        emotional_summary: result.emotional_summary,
        cognitive_summary: result.cognitive_summary || "",
        key_themes: result.key_themes || [],
        weekly_summaries_used: summaries.length
      };

      await supabase
        .from("user_memory_monthly_summaries")
        .upsert(monthlySummary, { onConflict: "user_id,profile_id,year,month" });

      summariesGenerated++;
    }

    return json(200, { 
      message: "Monthly summaries generated", 
      count: summariesGenerated,
      year: targetYear,
      month: targetMonth
    });

  } catch (e) {
    console.error("[generate-monthly-summaries] Error:", e);
    return json(500, { error: e.message });
  }
});

function getFirstWeekOfMonth(year: number, month: number): number {
  const firstDay = new Date(year, month - 1, 1);
  return getWeekNumber(firstDay);
}

function getLastWeekOfMonth(year: number, month: number): number {
  const lastDay = new Date(year, month, 0);
  return getWeekNumber(lastDay);
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

