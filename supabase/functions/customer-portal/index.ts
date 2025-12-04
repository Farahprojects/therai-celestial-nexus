// @ts-nocheck
//pushed 
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Customer portal function for Stripe billing management

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

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Get customer from Stripe
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      throw new Error("No Stripe customer found");
    }

    const customerId = customers.data[0].id;
    const origin = req.headers.get("origin") || "https://api.therai.co";

    // Create a fresh Therai-branded portal configuration
    const config = await stripe.billingPortal.configurations.create({
      business_profile: {
        headline: "Therai Subscription Management",
        privacy_policy_url: "https://therai.co/privacy",
        terms_of_service_url: "https://therai.co/terms",
      },
      features: {
        customer_update: {
          enabled: true,
          allowed_updates: ["email", "address"],
        },
        invoice_history: {
          enabled: true,
        },
        payment_method_update: {
          enabled: true,
        },
        subscription_cancel: {
          enabled: true,
          mode: "at_period_end",
          proration_behavior: "none",
        },
        subscription_pause: {
          enabled: false,
        },
      },
      default_return_url: `${origin}/therai`,
    });
    
    const configurationId = config.id;

    // Create billing portal session with configuration
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/therai`,
      configuration: configurationId,
    });

    return new Response(JSON.stringify({ url: portalSession.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error creating customer portal:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
