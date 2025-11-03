
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response('Missing authorization header', { status: 401, headers: corsHeaders });
    }

    // Get user from JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response('Invalid token', { status: 401, headers: corsHeaders });
    }

    const { planId, successUrl, cancelUrl, embedded, returnUrl } = await req.json();

    if (!planId) {
      return new Response(JSON.stringify({ error: "Plan ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SECURITY: Use authenticated user ID, not from request body
    const userId = user.id;

    console.log(`Creating one-shot checkout for user: ${userId}, plan: ${planId}`);

    // Get plan details from database
    const { data: plan, error: planError } = await supabase
      .from('price_list')
      .select('id, name, description, unit_price_usd, product_code')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      console.error('Plan lookup error:', planError);
      return new Response(JSON.stringify({ error: "Plan not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found plan: ${plan.name}, price: $${plan.unit_price_usd}`);

    // Get or create Stripe customer
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      // Get user email for Stripe customer creation
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .single();

      if (!userProfile?.email) {
        return new Response(JSON.stringify({ error: "User email not found" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: userProfile.email,
        metadata: {
          user_id: userId
        }
      });
      customerId = customer.id;

      // Update profile with stripe_customer_id
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId);

      console.log(`Created new Stripe customer: ${customerId}`);
    }

    // Create checkout session for one-shot payment (supports hosted or embedded)
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      client_reference_id: userId,
      payment_method_types: ['card'],
      billing_address_collection: 'auto',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: plan.name,
              description: plan.description,
            },
            unit_amount: Math.round(plan.unit_price_usd * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      // Hosted Checkout uses success/cancel URLs; Embedded uses ui_mode + return_url + client_secret
      success_url: embedded ? undefined : (successUrl || `${req.headers.get("origin")}/therai?payment_status=success`),
      cancel_url: embedded ? undefined : (cancelUrl || `${req.headers.get("origin")}/therai?payment_status=cancelled`),
      return_url: embedded ? (returnUrl || `${req.headers.get("origin")}/therai?payment_status=success`) : undefined,
      ui_mode: embedded ? 'embedded' : undefined,
      metadata: {
        user_id: userId,
        plan_id: planId,
        payment_type: 'one_shot'
      }
    });

    console.log(`Created checkout session: ${session.id} for user: ${userId}, plan: ${plan.name}`);

    return new Response(JSON.stringify({ 
      url: session.url,
      sessionId: session.id,
      clientSecret: (session as any).client_secret || null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Create checkout error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
