// @ts-nocheck
// Compare year-over-year patterns from monthly summaries
// Called on-demand or during annual review generation

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

const comparisonPrompt = `Compare yearly patterns and growth.

Analyze the monthly summaries from two years and identify:
- Recurring themes or cycles
- Growth and evolution
- Shifts in energy or focus
- Notable differences year-over-year

Output JSON:
{
  "recurring_patterns": ["pattern1", "pattern2"],
  "growth_areas": ["area1", "area2"],
  "shifts": "Description of major shifts",
  "insights": "Overall insights about the user's journey"
}`;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const body = await req.json();
    const { user_id, profile_id, year1, year2 } = body;

    if (!user_id || !profile_id || !year1 || !year2) {
      return json(400, { error: "Missing required fields: user_id, profile_id, year1, year2" });
    }

    // Fetch monthly summaries for both years
    const [year1Result, year2Result] = await Promise.all([
      supabase
        .from("user_memory_monthly_summaries")
        .select("month, emotional_summary, key_themes")
        .eq("user_id", user_id)
        .eq("profile_id", profile_id)
        .eq("year", year1)
        .order("month", { ascending: true }),
      
      supabase
        .from("user_memory_monthly_summaries")
        .select("month, emotional_summary, key_themes")
        .eq("user_id", user_id)
        .eq("profile_id", profile_id)
        .eq("year", year2)
        .order("month", { ascending: true })
    ]);

    const year1Data = year1Result.data || [];
    const year2Data = year2Result.data || [];

    if (year1Data.length === 0 && year2Data.length === 0) {
      return json(200, { message: "No data available for comparison" });
    }

    // Format data for LLM
    const year1Text = year1Data.map(m => 
      `${new Date(year1, m.month - 1).toLocaleDateString('en-US', { month: 'long' })}:\n${m.emotional_summary}`
    ).join('\n\n');

    const year2Text = year2Data.map(m =>
      `${new Date(year2, m.month - 1).toLocaleDateString('en-US', { month: 'long' })}:\n${m.emotional_summary}`
    ).join('\n\n');

    const prompt = `Year ${year1}:\n${year1Text}\n\nYear ${year2}:\n${year2Text}`;

    // Call Gemini for comparison
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
    const resp = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GOOGLE_API_KEY
      },
      body: JSON.stringify({
        system_instruction: { role: "system", parts: [{ text: comparisonPrompt }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1000,
          responseMimeType: "application/json"
        }
      })
    });

    if (!resp.ok) {
      throw new Error(`Gemini API error: ${resp.status}`);
    }

    const data = await resp.json();
    const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const result = JSON.parse(responseText);

    return json(200, {
      comparison: result,
      year1,
      year2,
      months_compared: { year1: year1Data.length, year2: year2Data.length }
    });

  } catch (e) {
    console.error("[compare-yearly-patterns] Error:", e);
    return json(500, { error: e.message });
  }
});

