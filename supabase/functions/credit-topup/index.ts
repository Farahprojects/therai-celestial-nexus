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

    const { amount_usd, credits, is_auto_topup, embedded } = await req.json();

    // Validate inputs
    if (!amount_usd || !credits) {
      return new Response(
        JSON.stringify({ error: "Missing amount_usd or credits" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate minimum purchase ($5)
    if (amount_usd < 5) {
      return new Response(
        JSON.stringify({ error: "Minimum purchase is $5" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate credit calculation (should be amount_usd / 0.15)
    const expectedCredits = Math.floor(amount_usd / 0.15);
    if (Math.abs(credits - expectedCredits) > 1) {
      return new Response(
        JSON.stringify({ error: "Invalid credit calculation" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get or create Stripe customer
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("stripe_customer_id, email")
      .eq("id", user.id)
      .single();

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || profile?.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      // Update profile with customer ID
      await supabaseClient
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    // Create checkout session
    const sessionConfig: any = {
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${credits} Credits`,
              description: `Purchase ${credits} credits for your Therai account${is_auto_topup ? ' (Auto top-up)' : ''}`,
            },
            unit_amount: Math.round(amount_usd * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      metadata: {
        user_id: user.id,
        credits: credits.toString(),
        is_auto_topup: is_auto_topup ? "true" : "false",
      },
    };

    // Configure for embedded or redirect mode
    if (embedded) {
      sessionConfig.ui_mode = "embedded";
      sessionConfig.return_url = `${req.headers.get("origin")}/settings?credit_purchase=success`;
    } else {
      sessionConfig.success_url = `${req.headers.get("origin")}/settings?credit_purchase=success`;
      sessionConfig.cancel_url = `${req.headers.get("origin")}/settings?credit_purchase=cancelled`;
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return new Response(
      JSON.stringify({ 
        sessionId: session.id, 
        clientSecret: session.client_secret,
        url: session.url 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error creating credit topup session:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

