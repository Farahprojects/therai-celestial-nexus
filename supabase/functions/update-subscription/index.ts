import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function for consistent JSON responses
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: { message: "No authorization header", type: "AuthError" } }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) {
      return jsonResponse({ 
        error: { 
          message: `Authentication error: ${userError.message}`, 
          type: "AuthError" 
        } 
      }, 401);
    }
    
    const user = userData.user;
    if (!user?.email) {
      return jsonResponse({ 
        error: { message: "User not authenticated", type: "AuthError" } 
      }, 401);
    }

    const { newPriceId } = await req.json();
    if (!newPriceId) {
      return jsonResponse({ 
        error: { message: "Missing newPriceId parameter", type: "ValidationError" } 
      }, 400);
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Get user's current subscription
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("stripe_subscription_id, stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.stripe_subscription_id) {
      return jsonResponse({ 
        error: { message: "No active subscription found", type: "NotFoundError" } 
      }, 404);
    }

    // Retrieve current subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
    
    // Get current subscription item (future-proof for multiple items)
    const currentItem = subscription.items.data.find(
      (item) => item.price.id !== newPriceId
    );
    
    if (!currentItem) {
      return jsonResponse({ 
        error: { 
          message: "Already subscribed to this plan", 
          type: "ValidationError" 
        } 
      }, 400);
    }

    // Get current subscription currency
    const currentCurrency = currentItem.price.currency;

    // Fetch the new price to check its currency
    const newPrice = await stripe.prices.retrieve(newPriceId);
    
    // Verify currency matches
    if (newPrice.currency !== currentCurrency) {
      return jsonResponse({ 
        error: { 
          message: `Cannot upgrade: Current subscription is in ${currentCurrency.toUpperCase()}, but selected plan is in ${newPrice.currency.toUpperCase()}. Currency must match.`,
          type: "CurrencyMismatchError",
          code: "currency_mismatch",
          currentCurrency,
          newCurrency: newPrice.currency
        } 
      }, 400);
    }

    // Update subscription with new price
    const updatedSubscription = await stripe.subscriptions.update(
      profile.stripe_subscription_id,
      {
        items: [
          {
            id: currentItem.id,
            price: newPriceId,
          },
        ],
        proration_behavior: "create_prorations", // Credit unused time and charge difference
        invoice_now: true, // Immediately generate invoice for prorated difference
      }
    );

    console.log(`Updated subscription ${profile.stripe_subscription_id} to price ${newPriceId}`);

    return jsonResponse({
      success: true,
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        current_period_end: updatedSubscription.current_period_end,
        currency: updatedSubscription.currency,
      },
    });

  } catch (error: any) {
    console.error("Error updating subscription:", error);
    
    // Handle Stripe errors with better structure
    if (error.type === "StripeInvalidRequestError") {
      return jsonResponse({
        error: {
          message: error.message,
          type: error.type || "StripeError",
          code: error.code || null,
          param: error.param || null,
        }
      }, 400);
    }
    
    return jsonResponse({
      error: {
        message: error instanceof Error ? error.message : "Unknown error",
        type: "InternalError",
      }
    }, 500);
  }
});

