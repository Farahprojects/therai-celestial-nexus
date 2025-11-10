import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, reward_type } = await req.json();

    if (!user_id || !reward_type) {
      return new Response(
        JSON.stringify({ error: "user_id and reward_type required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[grant-share-reward] Processing reward for user: ${user_id}, type: ${reward_type}`);

    // Get current date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    // Check if user has already claimed this reward today
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('last_share_reward_date')
      .eq('id', user_id)
      .single();

    if (profileError) {
      console.error('[grant-share-reward] Error fetching profile:', profileError);
      return new Response(
        JSON.stringify({ error: "Failed to check reward eligibility" }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Check if already claimed today
    if (profile?.last_share_reward_date === today) {
      console.log('[grant-share-reward] Reward already claimed today');
      return new Response(
        JSON.stringify({ 
          success: false, 
          already_claimed: true,
          message: "Share reward already claimed today" 
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Grant the reward: decrement image count by 1 (gives them +1 credit)
    // Get current period
    const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM

    // Find or create feature_usage record for images
    const { data: usageRecord, error: fetchError } = await supabase
      .from('feature_usage')
      .select('*')
      .eq('user_id', user_id)
      .eq('feature_type', 'images')
      .eq('period', currentPeriod)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[grant-share-reward] Error fetching usage:', fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch usage" }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (usageRecord) {
      // Decrement usage_count by 1 (gives them +1 credit)
      const newCount = Math.max(0, (usageRecord.usage_count || 0) - 1);
      
      const { error: updateError } = await supabase
        .from('feature_usage')
        .update({ usage_count: newCount })
        .eq('id', usageRecord.id);

      if (updateError) {
        console.error('[grant-share-reward] Error updating usage:', updateError);
        return new Response(
          JSON.stringify({ error: "Failed to grant reward" }),
          { status: 500, headers: corsHeaders }
        );
      }
    } else {
      // No usage record exists yet, create one with -1 (gives them +1 credit)
      const { error: insertError } = await supabase
        .from('feature_usage')
        .insert({
          user_id,
          feature_type: 'images',
          period: currentPeriod,
          usage_count: -1
        });

      if (insertError) {
        console.error('[grant-share-reward] Error inserting usage:', insertError);
        return new Response(
          JSON.stringify({ error: "Failed to grant reward" }),
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // Update last_share_reward_date to today
    const { error: updateProfileError } = await supabase
      .from('profiles')
      .update({ last_share_reward_date: today })
      .eq('id', user_id);

    if (updateProfileError) {
      console.error('[grant-share-reward] Error updating profile:', updateProfileError);
      // Don't fail the request, reward was granted
    }

    console.log('[grant-share-reward] Reward granted successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "+1 free image granted" 
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('[grant-share-reward] Exception:', error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});

