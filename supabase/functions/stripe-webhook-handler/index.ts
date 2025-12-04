// @ts-nocheck - Deno runtime, types checked at deployment
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

/**
 * Get friendly plan name from price_list table by Stripe price ID
 * Returns the plan name or 'Unknown Plan' if not found
 */
async function getPlanNameFromPriceList(stripePriceId: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('price_list')
      .select('name')
      .eq('stripe_price_id', stripePriceId)
      .eq('endpoint', 'subscription')
      .maybeSingle()
    
    if (error) {
      console.error(`❌ Error looking up plan name for price ${stripePriceId}:`, error)
      return 'Unknown Plan'
    }
    
    if (data?.name) {
      console.log(`✅ Found plan name in price_list: "${data.name}" for price ${stripePriceId}`)
      return data.name
    }
    
    console.warn(`⚠️ No match in price_list for price ${stripePriceId}`)
    return 'Unknown Plan'
  } catch (err) {
    console.error(`❌ Exception looking up plan name for price ${stripePriceId}:`, err)
    return 'Unknown Plan'
  }
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

  // Check if this is a credit purchase (Payment Element flow)
  if (paymentIntent.metadata?.credits && paymentIntent.metadata?.user_id) {
    const userId = paymentIntent.metadata.user_id
    const credits = parseInt(paymentIntent.metadata.credits, 10)
    const isAutoTopup = paymentIntent.metadata.is_auto_topup === 'true'
    const amountUsd = paymentIntent.amount / 100
    
    console.log(`[Webhook] Processing credit purchase for user ${userId}: ${credits} credits ($${amountUsd})`)
    
    try {
      // Add credits to user account
      const { error: creditError } = await supabase.rpc('add_credits', {
        _user_id: userId,
        _credits: credits,
        _amount_usd: amountUsd,
        _type: isAutoTopup ? 'auto_topup' : 'purchase',
        _reference_id: paymentIntent.id,
        _description: isAutoTopup 
          ? `Auto top-up: ${credits} credits` 
          : `Credit purchase: ${credits} credits`
      })
      
      if (creditError) {
        console.error(`[Webhook] Failed to add credits for user ${userId}:`, creditError)
        throw creditError
      }
      
      // Log to topup_logs
      await supabase.from('topup_logs').insert({
        user_id: userId,
        stripe_payment_intent_id: paymentIntent.id,
        amount_cents: paymentIntent.amount,
        credits: credits,
        is_auto_topup: isAutoTopup,
        status: 'succeeded',
        credited: true,
        receipt_url: null
      })
      
      console.log(`[Webhook] ✅ Successfully credited ${credits} credits to user ${userId}`)
    } catch (error) {
      console.error(`[Webhook] Error processing credit purchase:`, error)
      
      // Log failed topup
      await supabase.from('topup_logs').insert({
        user_id: userId,
        stripe_payment_intent_id: paymentIntent.id,
        amount_cents: paymentIntent.amount,
        credits: credits,
        is_auto_topup: isAutoTopup,
        status: 'failed',
        credited: false
      })
    }
    return
  }

  // Guest report payments are no longer supported
  console.log('[Webhook] No credits or user_id found in metadata, skipping');
  return
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

  // Get plan name from price_list table (no fallbacks)
  const stripePriceId = subscription.items.data[0]?.price?.id
  const planName = stripePriceId 
    ? await getPlanNameFromPriceList(stripePriceId)
    : 'Unknown Plan'

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

  // Get plan name from price_list table (no fallbacks)
  const stripePriceId = subscription.items.data[0]?.price?.id
  const stripeNickname = subscription.items.data[0]?.price?.nickname
  const planName = stripePriceId 
    ? await getPlanNameFromPriceList(stripePriceId)
    : 'Unknown Plan'
  const accessUntil = subscription.current_period_end 
    ? new Date(subscription.current_period_end * 1000).toLocaleDateString()
    : new Date().toLocaleDateString()

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

  // Send subscription cancelled email notification
  try {
    await supabase.functions.invoke('send-payment-notification', {
      body: {
        user_id: userId,
        template_type: 'subscription_cancelled',
        variables: {
          cancellation_date: new Date().toLocaleDateString(),
          plan_name: planName,
          access_until: accessUntil
        }
      }
    }).catch((err) => {
      console.error(`[Webhook] Failed to send subscription cancelled email for user ${userId}:`, err)
    })
  } catch (err) {
    console.error(`[Webhook] Error sending subscription cancelled email:`, err)
  }
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

  // Send email notification based on payment status
  try {
    if (eventType === 'invoice.payment_failed') {
      // Send payment failed email
      const retryDate = invoice.next_payment_attempt 
        ? new Date(invoice.next_payment_attempt * 1000).toLocaleDateString()
        : 'N/A'

      await supabase.functions.invoke('send-payment-notification', {
        body: {
          user_id: userId,
          template_type: 'payment_failed',
          variables: {
            amount: `$${(invoice.amount_due / 100).toFixed(2)}`,
            date: new Date().toLocaleDateString(),
            retry_date: retryDate,
            invoice_number: invoice.number || 'N/A'
          }
        }
      }).catch((err) => {
        console.error(`[Webhook] Failed to send payment failed email for user ${userId}:`, err)
      })
    } else if (eventType === 'invoice.payment_succeeded') {
      // Send payment successful email (receipt)
      // Need to get subscription to find next billing date
      let nextBillingDate = 'N/A'
      if (invoice.subscription) {
        try {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
          if (subscription.current_period_end) {
            nextBillingDate = new Date(subscription.current_period_end * 1000).toLocaleDateString()
          }
        } catch (subErr) {
          console.error(`[Webhook] Failed to retrieve subscription for next billing date:`, subErr)
        }
      }

      await supabase.functions.invoke('send-payment-notification', {
        body: {
          user_id: userId,
          template_type: 'payment_successful',
          variables: {
            amount: `$${((invoice.amount_paid || invoice.total) / 100).toFixed(2)}`,
            date: new Date().toLocaleDateString(),
            next_billing_date: nextBillingDate,
            invoice_number: invoice.number || 'N/A',
            receipt_url: invoice.hosted_invoice_url || '#'
          }
        }
      }).catch((err) => {
        console.error(`[Webhook] Failed to send payment successful email for user ${userId}:`, err)
      })
    }
  } catch (err) {
    console.error(`[Webhook] Error sending invoice payment email:`, err)
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  // Check if this is a credit purchase
  if (session.metadata?.credits && session.metadata?.user_id) {
    const userId = session.metadata.user_id
    const credits = parseInt(session.metadata.credits, 10)
    const isAutoTopup = session.metadata.is_auto_topup === 'true'
    const amountUsd = session.amount_total ? session.amount_total / 100 : 0
    
    console.log(`Processing credit purchase for user ${userId}: ${credits} credits ($${amountUsd})`)
    
    try {
      // Add credits to user account
      const { error: creditError } = await supabase.rpc('add_credits', {
        _user_id: userId,
        _credits: credits,
        _amount_usd: amountUsd,
        _type: isAutoTopup ? 'auto_topup' : 'purchase',
        _reference_id: session.id,
        _description: isAutoTopup 
          ? `Auto top-up: ${credits} credits` 
          : `Credit purchase: ${credits} credits`
      })
      
      if (creditError) {
        console.error(`Failed to add credits for user ${userId}:`, creditError)
        throw creditError
      }
      
      // Log to topup_logs
      await supabase.from('topup_logs').insert({
        user_id: userId,
        stripe_payment_intent_id: session.payment_intent as string,
        amount_cents: session.amount_total,
        credits: credits,
        is_auto_topup: isAutoTopup,
        status: 'succeeded',
        credited: true,
        receipt_url: session.url
      })
      
      console.log(`✅ Successfully credited ${credits} credits to user ${userId}`)
    } catch (error) {
      console.error(`Error processing credit purchase:`, error)
      
      // Log failed topup
      await supabase.from('topup_logs').insert({
        user_id: userId,
        stripe_payment_intent_id: session.payment_intent as string,
        amount_cents: session.amount_total,
        credits: credits,
        is_auto_topup: isAutoTopup,
        status: 'failed',
        credited: false
      })
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

  // Send payment method updated email notification
  if (paymentMethod.type === 'card' && paymentMethod.card) {
    try {
      await supabase.functions.invoke('send-payment-notification', {
        body: {
          user_id: userId,
          template_type: 'payment_method_updated',
          variables: {
            card_brand: paymentMethod.card.brand.charAt(0).toUpperCase() + paymentMethod.card.brand.slice(1),
            card_last4: paymentMethod.card.last4,
            date: new Date().toLocaleDateString()
          }
        }
      }).catch((err) => {
        console.error(`[Webhook] Failed to send payment method updated email for user ${userId}:`, err)
      })
    } catch (err) {
      console.error(`[Webhook] Error sending payment method updated email:`, err)
    }
  }
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
