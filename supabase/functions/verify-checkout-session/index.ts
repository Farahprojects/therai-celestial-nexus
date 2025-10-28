import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { session_id, payment_intent_id } = await req.json();

    if (!session_id && !payment_intent_id) {
      return new Response(
        JSON.stringify({ error: "Missing session_id or payment_intent_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let paymentStatus = "pending";
    let credits = 0;
    let amountUsd = 0;
    let customerEmail = "";

    // Handle checkout session verification (mobile hosted checkout)
    if (session_id) {
      const session = await stripe.checkout.sessions.retrieve(session_id);
      
      // Verify user owns this session
      if (session.metadata?.user_id !== user.id) {
        return new Response(
          JSON.stringify({ error: "Session does not belong to user" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      paymentStatus = session.payment_status;
      credits = parseInt(session.metadata?.credits || "0", 10);
      amountUsd = (session.amount_total || 0) / 100;
      customerEmail = session.customer_details?.email || "";
    }

    // Handle payment intent verification (desktop Payment Element)
    if (payment_intent_id) {
      const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
      
      // Verify user owns this payment intent
      if (paymentIntent.metadata?.user_id !== user.id) {
        return new Response(
          JSON.stringify({ error: "Payment intent does not belong to user" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      paymentStatus = paymentIntent.status === "succeeded" ? "paid" : paymentIntent.status;
      credits = parseInt(paymentIntent.metadata?.credits || "0", 10);
      amountUsd = paymentIntent.amount / 100;
    }

    // Get current user credit balance
    const { data: creditData } = await supabaseClient
      .from("user_credits")
      .select("credits")
      .eq("user_id", user.id)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        payment_status: paymentStatus,
        credits: credits,
        amount_usd: amountUsd,
        customer_email: customerEmail,
        current_balance: creditData?.credits || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error verifying checkout session:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

