// Swiss Data Generator - Create Subscription Checkout Function
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
})

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response('Missing authorization header', { status: 401, headers: corsHeaders })
    }

    // Get user from JWT token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response('Invalid token', { status: 401, headers: corsHeaders })
    }

    const { priceId, successUrl, cancelUrl, embedded, returnUrl } = await req.json()

    if (!priceId) {
      return new Response('Missing priceId', { status: 400, headers: corsHeaders })
    }

    console.log(`Creating subscription checkout for user: ${user.id}, plan: ${priceId}`)

    // Get plan details from database
    const { data: plan, error: planError } = await supabase
      .from('price_list')
      .select('id, name, description, unit_price_usd, product_code, stripe_price_id')
      .eq('id', priceId)
      .single();

    if (planError || !plan) {
      console.error('Plan lookup error:', planError);
      return new Response(JSON.stringify({ error: "Plan not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found plan: ${plan.name}, stripe_price_id: ${plan.stripe_price_id}`);

    if (!plan.stripe_price_id) {
      return new Response(JSON.stringify({ error: "Stripe price ID not found for this plan" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get or create Stripe customer
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    let customerId = profile?.stripe_customer_id

    if (!customerId) {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email!,
        metadata: {
          user_id: user.id
        }
      })
      customerId = customer.id

      // Update profile with stripe_customer_id
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)

      console.log(`Created new Stripe customer: ${customerId}`)
    }

    // Create checkout session for subscription (supports hosted or embedded UI)
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      client_reference_id: user.id, // Critical for webhook user resolution
      payment_method_types: ['card'],
      billing_address_collection: 'required', // Collect billing address
      line_items: [
        {
          price: plan.stripe_price_id,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      // Hosted Checkout uses success/cancel URLs; Embedded uses ui_mode + return_url + client_secret
      success_url: embedded ? undefined : (successUrl || `${req.headers.get("origin")}/success?session_id={CHECKOUT_SESSION_ID}`),
      cancel_url: embedded ? undefined : (cancelUrl || `${req.headers.get("origin")}/canceled`),
      return_url: embedded ? (returnUrl || `${req.headers.get("origin")}/success`) : undefined,
      ui_mode: embedded ? 'embedded' : undefined,
      metadata: {
        user_id: user.id,
        plan_id: priceId,
        payment_type: 'subscription'
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan_id: priceId
        }
      }
    })

    console.log(`Created checkout session: ${session.id} for user: ${user.id}, plan: ${plan.name}`)

    return new Response(JSON.stringify({ 
      url: session.url,
      sessionId: session.id,
      clientSecret: (session as any).client_secret || null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Create subscription checkout error:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})