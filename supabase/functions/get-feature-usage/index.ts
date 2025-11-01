// Get Feature Usage - Returns current monthly usage for authenticated user
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { FEATURE_LIMITS } from "../_shared/featureLimits.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: any, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "No authorization header" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return jsonResponse({ error: "Authentication error" }, 401);
    }

    const user = userData.user;
    const currentPeriod = new Date().toISOString().slice(0, 7); // 'YYYY-MM'

    // Get user's subscription plan
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('subscription_plan, subscription_active, subscription_status')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return jsonResponse({ error: "Failed to fetch user profile" }, 500);
    }

    const plan = profile.subscription_plan || 'free';
    const limits = FEATURE_LIMITS[plan] || FEATURE_LIMITS['free'];
    const isActive = profile.subscription_active && 
                     ['active', 'trialing'].includes(profile.subscription_status || '');

    // Get current usage for this period (modular table: one row per user per period)
    const { data: usageData, error: usageError } = await supabaseClient
      .from('feature_usage')
      .select('voice_seconds, insights_count')
      .eq('user_id', user.id)
      .eq('period', currentPeriod)
      .maybeSingle();

    if (usageError) {
      console.error('Error fetching usage:', usageError);
      return jsonResponse({ error: "Failed to fetch usage data" }, 500);
    }

    // Extract usage from the single row
    const voiceUsed = usageData?.voice_seconds || 0;
    const insightsUsed = usageData?.insights_count || 0;

    // Return usage data with limits
    return jsonResponse({
      period: currentPeriod,
      subscription_active: isActive,
      subscription_plan: plan,
      voice_seconds: {
        used: voiceUsed,
        limit: limits.voice_seconds, // null = unlimited
        remaining: limits.voice_seconds === null 
          ? null 
          : Math.max(0, limits.voice_seconds - voiceUsed)
      },
      insights_count: {
        used: insightsUsed,
        limit: limits.insights_count, // null = unlimited
        remaining: limits.insights_count === null 
          ? null 
          : Math.max(0, limits.insights_count - insightsUsed)
      }
    });

  } catch (error) {
    console.error("Error in get-feature-usage:", error);
    return jsonResponse({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }, 500);
  }
});

