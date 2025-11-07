

// Swiss Data Generator - Subscription Check Function
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createPooledClient } from "../_shared/supabaseClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createPooledClient();

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
      // No customer found, mark as inactive
      await supabaseClient.from("profiles").upsert({
        id: user.id,
        email: user.email,
        subscription_active: false,
        last_payment_status: "no_customer",
        stripe_customer_id: null,
        stripe_subscription_id: null,
      });
      
      return new Response(JSON.stringify({ 
        subscription_active: false, 
        subscription_plan: null 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;

    // Get all subscriptions (not just active ones)
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
    });

    let subscriptionData = {
      subscription_active: false,
      subscription_status: "inactive",
      subscription_plan: null as string | null,
      subscription_start_date: null as string | null,
      subscription_next_charge: null as string | null,
      stripe_subscription_id: null as string | null,
      last_payment_status: "inactive",
    };

    let nextBillingAt: string | null = null;

    if (subscriptions.data.length > 0) {
      const subscription = subscriptions.data[0];
      const isActive = subscription.status === "active" || subscription.status === "trialing";
      const plan = subscription.metadata?.subscription_plan || "10_monthly";
      
      nextBillingAt = new Date(subscription.current_period_end * 1000).toISOString();
      
      subscriptionData = {
        subscription_active: isActive,
        subscription_status: subscription.status,
        subscription_plan: plan,
        subscription_start_date: new Date(subscription.created * 1000).toISOString(),
        subscription_next_charge: nextBillingAt,
        stripe_subscription_id: subscription.id,
        last_payment_status: isActive ? "active" : subscription.status,
      };
    }

    // Update profile with subscription data using service role
    const serviceClient = createPooledClient();

    await serviceClient.from("profiles").upsert({
      id: user.id,
      email: user.email,
      stripe_customer_id: customerId,
      ...subscriptionData,
    });

    // Update payment method with next billing date if we have an active subscription
    if (nextBillingAt) {
      await serviceClient
        .from("payment_method")
        .update({
          next_billing_at: nextBillingAt
        })
        .eq('user_id', user.id)
        .eq('active', true);
    }

    return new Response(JSON.stringify({
      subscription_active: subscriptionData.subscription_active,
      subscription_plan: subscriptionData.subscription_plan,
      subscription_next_charge: subscriptionData.subscription_next_charge,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error checking subscription:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
