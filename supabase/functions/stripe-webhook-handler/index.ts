
// Swiss Data Generator - Stripe Webhook Handler
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.18.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-08-16',
})

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    const signature = req.headers.get('stripe-signature')
    const body = await req.text()
    const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

    if (!signature || !endpointSecret) {
      return new Response('Missing signature or secret', { status: 400 })
    }

    let event: Stripe.Event
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret)
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return new Response('Invalid signature', { status: 400 })
    }

    console.log(`Processing webhook event: ${event.type}`)

    // Store the webhook event for audit purposes
    await supabase
      .from('stripe_webhook_events')
      .insert({
        stripe_event_id: event.id,
        stripe_event_type: event.type,
        stripe_kind: event.type.split('.')[0],
        stripe_customer_id: getCustomerIdFromEvent(event),
        payload: event,
        processed: false
      })

    // Process the event
    await processWebhookEvent(event)

    // Mark as processed
    await supabase
      .from('stripe_webhook_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('stripe_event_id', event.id)

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return new Response('Internal server error', { status: 500 })
  }
})

function getCustomerIdFromEvent(event: Stripe.Event): string | null {
  const obj = event.data.object as any
  return obj.customer || obj.customer_id || null
}

async function processWebhookEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent)
      break
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionChange(event.data.object as Stripe.Subscription)
      break
    
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
      break
    
    case 'invoice.payment_succeeded':
    case 'invoice.payment_failed':
      await handleInvoicePayment(event.data.object as Stripe.Invoice, event.type)
      break
    
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
      break
    
    case 'setup_intent.succeeded':
      await handleSetupIntentSucceeded(event.data.object as Stripe.SetupIntent)
      break
    
    case 'payment_method.attached':
      await handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod)
      break
    
    case 'payment_method.detached':
      await handlePaymentMethodDetached(event.data.object as Stripe.PaymentMethod)
      break
    
    default:
      console.log(`Unhandled event type: ${event.type}`)
  }
}
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log('[Webhook] Processing payment_intent.succeeded:', {
    paymentIntentId: paymentIntent.id,
    metadata: paymentIntent.metadata,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency
  });

  const guestId = (paymentIntent.metadata?.guest_id as string) || ''
  
  if (!guestId) {
    console.log('[Webhook] No guest_id found in metadata, skipping guest report update');
    return
  }

  console.log(`[Webhook] Updating guest_reports for guest_id: ${guestId}`);

  const { error } = await supabase
    .from('guest_reports')
    .update({ payment_status: 'paid', updated_at: new Date().toISOString() })
    .eq('id', guestId)

  if (error) {
    console.error(`[Webhook] Failed to update guest_reports for ${guestId}:`, error);
  } else {
    console.log(`[Webhook] ✅ Successfully updated guest_reports payment_status to 'paid' for ${guestId}`);
  }
}

async function resolveUserId(customerId: string, clientReferenceId?: string, metadata?: any): Promise<string | null> {
  // Try client_reference_id first (this is the Supabase user_id)
  if (clientReferenceId) {
    return clientReferenceId
  }

  // Try metadata.user_id
  if (metadata?.user_id) {
    return metadata.user_id
  }

  // Fallback: lookup by stripe_customer_id in profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  return profile?.id || null
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const userId = await resolveUserId(subscription.customer as string, undefined, subscription.metadata)
  if (!userId) {
    console.error('Could not resolve user ID for subscription:', subscription.id)
    return
  }

  const status = subscription.status
  const isActive = ['active', 'trialing'].includes(status)
  
  let nextCharge: string | null = null
  if (subscription.current_period_end) {
    nextCharge = new Date(subscription.current_period_end * 1000).toISOString()
  }

  const planName = subscription.items.data[0]?.price?.nickname || 
                   subscription.items.data[0]?.price?.id || 'unknown'

  await supabase
    .from('profiles')
    .update({
      stripe_customer_id: subscription.customer as string,
      stripe_subscription_id: subscription.id,
      subscription_status: status,
      subscription_active: isActive,
      subscription_plan: planName,
      subscription_start_date: new Date(subscription.created * 1000).toISOString(),
      subscription_next_charge: nextCharge,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)

  // Update payment method with next billing date
  if (nextCharge) {
    await supabase
      .from('payment_method')
      .update({
        next_billing_at: nextCharge
      })
      .eq('user_id', userId)
      .eq('active', true)
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = await resolveUserId(subscription.customer as string, undefined, subscription.metadata)
  if (!userId) return

  await supabase
    .from('profiles')
    .update({
      subscription_status: 'canceled',
      subscription_active: false,
      subscription_next_charge: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)

  // Clear next billing date
  await supabase
    .from('payment_method')
    .update({
      next_billing_at: null
    })
    .eq('user_id', userId)
    .eq('active', true)
}

async function handleInvoicePayment(invoice: Stripe.Invoice, eventType: string) {
  const userId = await resolveUserId(invoice.customer as string)
  if (!userId) return

  const paymentStatus = eventType === 'invoice.payment_succeeded' ? 'succeeded' : 'failed'
  const chargeAt = new Date().toISOString()

  console.log(`Handling invoice payment for user ${userId}: ${paymentStatus}`)

  await supabase
    .from('profiles')
    .update({
      last_payment_status: paymentStatus,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)

  // Update payment method with billing details
  const invoiceEntry = {
    id: invoice.id,
    number: invoice.number,
    amount_cents: invoice.amount_paid || invoice.total,
    currency: invoice.currency,
    status: paymentStatus,
    charge_date: chargeAt,
    receipt_url: invoice.hosted_invoice_url
  }

  // Get current invoice history
  const { data: currentPaymentMethod } = await supabase
    .from('payment_method')
    .select('invoice_history')
    .eq('user_id', userId)
    .eq('active', true)
    .single()

  const currentHistory = currentPaymentMethod?.invoice_history || []
  const updatedHistory = [invoiceEntry, ...currentHistory].slice(0, 12) // Keep last 12 invoices

  await supabase
    .from('payment_method')
    .update({
      last_charge_at: chargeAt,
      last_charge_status: paymentStatus,
      last_invoice_id: invoice.id,
      last_invoice_number: invoice.number,
      last_invoice_amount_cents: invoice.amount_paid || invoice.total,
      last_invoice_currency: invoice.currency,
      last_receipt_url: invoice.hosted_invoice_url,
      invoice_history: updatedHistory
    })
    .eq('user_id', userId)
    .eq('active', true)

  console.log(`Updated payment method billing info for user ${userId}`)
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  // Check if this is a guest checkout by looking for guest_id in URLs
  const successUrl = session.success_url
  const cancelUrl = session.cancel_url
  
  // Look for guest_id in either success_url or cancel_url
  const guestIdMatch = successUrl?.match(/guest_id=([a-f0-9-]+)/) || cancelUrl?.match(/guest_id=([a-f0-9-]+)/)
  
  if (guestIdMatch && guestIdMatch[1]) {
    const guestId = guestIdMatch[1]
    console.log(`Processing guest checkout completion for guest_id: ${guestId}`)
    
    // Update guest_reports payment_status to 'paid'
    const { error: guestUpdateError } = await supabase
      .from('guest_reports')
      .update({ 
        payment_status: 'paid',
        updated_at: new Date().toISOString()
      })
      .eq('id', guestId)

    if (guestUpdateError) {
      console.error(`Failed to update guest payment status for ${guestId}:`, guestUpdateError)
    } else {
      console.log(`✅ Successfully updated guest payment status to 'paid' for ${guestId}`)
    }
    return
  }

  // Handle authenticated user checkout
  const userId = await resolveUserId(session.customer as string, session.client_reference_id, session.metadata)
  if (!userId) return

  const updateData: any = {
    stripe_customer_id: session.customer,
    updated_at: new Date().toISOString()
  }

  if (session.subscription) {
    updateData.stripe_subscription_id = session.subscription
  }

  await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', userId)
}

async function handleSetupIntentSucceeded(setupIntent: Stripe.SetupIntent) {
  const userId = await resolveUserId(setupIntent.customer as string, undefined, setupIntent.metadata)
  if (!userId) return

  // Get the payment method that was set up
  if (setupIntent.payment_method) {
    const paymentMethod = await stripe.paymentMethods.retrieve(setupIntent.payment_method as string)
    await updatePaymentMethodInDb(userId, paymentMethod)
  }
}

async function handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod) {
  const userId = await resolveUserId(paymentMethod.customer as string)
  if (!userId) return

  await updatePaymentMethodInDb(userId, paymentMethod)
}

async function handlePaymentMethodDetached(paymentMethod: Stripe.PaymentMethod) {
  // Mark payment method as inactive in our DB
  await supabase
    .from('payment_method')
    .update({ 
      active: false,
      status_reason: 'detached_from_stripe',
      status_changed_at: new Date().toISOString()
    })
    .eq('stripe_payment_method_id', paymentMethod.id)
}

async function updatePaymentMethodInDb(userId: string, paymentMethod: Stripe.PaymentMethod) {
  if (paymentMethod.type !== 'card' || !paymentMethod.card) return

  console.log(`Updating payment method for user ${userId}: ${paymentMethod.id}`)

  // Get billing details from Stripe
  const billingDetails = paymentMethod.billing_details || {}
  
  // Deactivate other payment methods for this user
  await supabase
    .from('payment_method')
    .update({ 
      active: false,
      status_reason: 'replaced_by_new_card',
      status_changed_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .eq('active', true)

  // Insert or update the new payment method with complete billing information
  const paymentMethodData = {
    user_id: userId,
    stripe_customer_id: paymentMethod.customer as string,
    stripe_payment_method_id: paymentMethod.id,
    card_brand: paymentMethod.card.brand,
    card_last4: paymentMethod.card.last4,
    exp_month: paymentMethod.card.exp_month,
    exp_year: paymentMethod.card.exp_year,
    fingerprint: paymentMethod.card.fingerprint,
    payment_method_type: 'card',
    active: true,
    ts: new Date().toISOString(),
    // Billing address information
    email: billingDetails.email,
    billing_name: billingDetails.name,
    billing_address_line1: billingDetails.address?.line1,
    billing_address_line2: billingDetails.address?.line2,
    city: billingDetails.address?.city,
    state: billingDetails.address?.state,
    postal_code: billingDetails.address?.postal_code,
    country: billingDetails.address?.country,
    payment_status: 'active'
  }

  await supabase
    .from('payment_method')
    .upsert(paymentMethodData, {
      onConflict: 'stripe_payment_method_id'
    })

  console.log(`Successfully updated payment method for user ${userId}`)
}
