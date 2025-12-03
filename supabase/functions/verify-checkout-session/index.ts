import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withStandardHandling, withAuth, HttpError, AuthContext } from '../_shared/authHelper.ts';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

// Core verification logic - separated from auth concerns
async function verifyCheckoutHandler(req: Request, authCtx: AuthContext): Promise<Response> {
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    {
      global: {
        headers: { Authorization: authCtx.authHeader! },
      },
    }
  );

  // User is already authenticated via middleware
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    throw new HttpError(401, "User authentication failed");
  }

  const body = await req.json();
  const { session_id, payment_intent_id } = body;

  if (!session_id && !payment_intent_id) {
    throw new HttpError(400, "Missing session_id or payment_intent_id");
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
      throw new HttpError(403, "Session does not belong to user");
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
      throw new HttpError(403, "Payment intent does not belong to user");
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
    { headers: { "Content-Type": "application/json" } }
  );
}

Deno.serve(async (req) => {
  return withStandardHandling(req, async () => {
    if (req.method !== "POST") {
      throw new HttpError(405, "Method not allowed");
    }

    return withAuth(req, (authCtx) => verifyCheckoutHandler(req, authCtx));
  });
});

