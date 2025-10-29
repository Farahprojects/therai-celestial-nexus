// @ts-nocheck
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Cancel subscription function for Stripe subscription management

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");

    const { cancelImmediately = false } = await req.json();

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Get user's current subscription
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("stripe_subscription_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.stripe_subscription_id) {
      throw new Error("No active subscription found");
    }

    let result;
    if (cancelImmediately) {
      // Cancel subscription immediately
      result = await stripe.subscriptions.cancel(profile.stripe_subscription_id);
      console.log(`Canceled subscription ${profile.stripe_subscription_id} immediately`);
    } else {
      // Cancel at period end
      result = await stripe.subscriptions.update(profile.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
      console.log(`Set subscription ${profile.stripe_subscription_id} to cancel at period end`);
    }

    // Update profiles table
    const { error: updateError } = await supabaseClient
      .from("profiles")
      .update({
        subscription_status: cancelImmediately ? "canceled" : "active",
        subscription_active: !cancelImmediately,
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Error updating profile:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        canceled_immediately: cancelImmediately,
        cancel_at_period_end: result.cancel_at_period_end,
        current_period_end: result.current_period_end,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error canceling subscription:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

