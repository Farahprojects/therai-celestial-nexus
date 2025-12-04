import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.18.0'
import { getSecureCorsHeaders } from "../_shared/secureCors.ts";

// Helper function for structured logging to admin_logs
const logToAdmin = async (supabase: any, userId: string, eventType: string, message: string, metadata: any = {}) => {
  try {
    await supabase.from('admin_logs').insert({
      page: 'delete_account',
      event_type: eventType,
      user_id: userId,
      logs: message,
      meta: {
        ...metadata,
        timestamp: new Date().toISOString()
      },
      created_at: new Date().toISOString()
    });
    console.log(`✅ Logged to admin_logs: ${eventType} - ${message}`);
  } catch (logError) {
    console.error('⚠️ Failed to log to admin_logs:', logError);
  }
};

Deno.serve(async (req) => {
  console.log('🚀 Delete account function invoked')

  if (req.method === 'OPTIONS') {
    console.log('📋 Handling CORS preflight request')
    const corsHeaders = getSecureCorsHeaders(req);
    return new Response(null, { headers: corsHeaders })
  }

  console.log('📨 Request method:', req.method)
  const corsHeaders = getSecureCorsHeaders(req);
  
  // Initialize Supabase client with service role key
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  
  try {
    if (req.method !== 'POST') {
      console.log('❌ Method not allowed:', req.method)
      return new Response('Method not allowed', { status: 405, headers: corsHeaders })
    }

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.log('❌ Missing authorization header')
      return new Response('Missing authorization header', { status: 401, headers: corsHeaders })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.log('❌ Invalid token or user not found:', authError)
      return new Response('Invalid token', { status: 401, headers: corsHeaders })
    }

    console.log(`🎯 Starting account deletion for user: ${user.id}`)
    
    // Log the deletion start
    await logToAdmin(supabase, user.id, 'deletion_initiated', `Account deletion initiated for user ${user.id}`, {
      user_email: user.email,
      user_id: user.id
    })

    // Step 1: Cancel Stripe subscriptions and payment methods - NON-BLOCKING
    let stripeCleanupSuccess = false
    try {
      const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
      if (!stripeKey) {
        console.log('⚠️ No Stripe secret key found, skipping Stripe cleanup')
        await logToAdmin(supabase, user.id, 'stripe_skipped', 'No Stripe secret key configured, skipping Stripe cleanup')
      } else {
        console.log('💳 Starting Stripe cleanup...')
        await logToAdmin(supabase, user.id, 'stripe_cleanup_started', 'Starting Stripe cleanup process')
        
        const stripe = new Stripe(stripeKey, { apiVersion: '2023-08-16' })

        const { data: paymentMethods } = await supabase
          .from('payment_method')
          .select('stripe_customer_id, stripe_payment_method_id')
          .eq('user_id', user.id)
          .eq('active', true)

        if (paymentMethods && paymentMethods.length > 0) {
          for (const pm of paymentMethods) {
            if (pm.stripe_customer_id) {
              try {
                console.log(`💳 Processing customer: ${pm.stripe_customer_id}`)
                
                // Cancel all active subscriptions
                const subscriptions = await stripe.subscriptions.list({
                  customer: pm.stripe_customer_id,
                  status: 'active'
                })

                for (const subscription of subscriptions.data) {
                  await stripe.subscriptions.cancel(subscription.id, {
                    cancellation_details: {
                      comment: 'Account deletion requested by user'
                    }
                  })
                  console.log(`✅ Cancelled subscription: ${subscription.id}`)
                }

                // Cancel all trialing subscriptions
                const trialingSubscriptions = await stripe.subscriptions.list({
                  customer: pm.stripe_customer_id,
                  status: 'trialing'
                })

                for (const subscription of trialingSubscriptions.data) {
                  await stripe.subscriptions.cancel(subscription.id, {
                    cancellation_details: {
                      comment: 'Account deletion requested by user'
                    }
                  })
                  console.log(`✅ Cancelled trialing subscription: ${subscription.id}`)
                }

                // Detach all payment methods
                const customerPaymentMethods = await stripe.paymentMethods.list({
                  customer: pm.stripe_customer_id,
                  type: 'card'
                })

                for (const paymentMethod of customerPaymentMethods.data) {
                  await stripe.paymentMethods.detach(paymentMethod.id)
                  console.log(`✅ Detached payment method: ${paymentMethod.id}`)
                }

                // Update customer to indicate account deleted
                await stripe.customers.update(pm.stripe_customer_id, {
                  metadata: {
                    account_deleted: 'true',
                    deleted_at: new Date().toISOString()
                  }
                })

                console.log(`✅ Completed Stripe cleanup for customer: ${pm.stripe_customer_id}`)
              } catch (stripeError) {
                console.error(`❌ Stripe cleanup error for customer ${pm.stripe_customer_id}:`, stripeError)
                await logToAdmin(supabase, user.id, 'stripe_customer_error', `Stripe cleanup failed for customer ${pm.stripe_customer_id}`, {
                  customer_id: pm.stripe_customer_id,
                  error: stripeError instanceof Error ? stripeError.message : String(stripeError)
                })
              }
            }
          }
          stripeCleanupSuccess = true
          await logToAdmin(supabase, user.id, 'stripe_cleanup_completed', 'Stripe cleanup completed successfully')
        } else {
          console.log('ℹ️ No active payment methods found for user')
          await logToAdmin(supabase, user.id, 'stripe_no_payment_methods', 'No active payment methods found, skipping Stripe cleanup')
          stripeCleanupSuccess = true
        }
      }
    } catch (stripeError) {
      console.error('❌ Stripe cleanup failed:', stripeError)
      await logToAdmin(supabase, user.id, 'stripe_cleanup_failed', 'Stripe cleanup failed but continuing with deletion', {
        error: stripeError instanceof Error ? stripeError.message : String(stripeError)
      })
      // Continue with deletion - don't let Stripe errors block account deletion
    }

    // Step 2: Delete all user data from database - CRITICAL STEP
    let databaseCleanupSuccess = false
    try {
      console.log('🗄️ Starting comprehensive database cleanup...')
      const { error: deleteError } = await supabase.rpc('delete_user_account', {
        user_id_to_delete: user.id
      })

      if (deleteError) {
        console.error('❌ Database deletion error:', deleteError)
        await logToAdmin(supabase, user.id, 'database_cleanup_failed', `Database cleanup failed: ${deleteError.message}`, {
          error: deleteError.message,
          error_code: deleteError.code
        })
        // Don't return here - still attempt Auth deletion
      } else {
        console.log('✅ Database cleanup completed successfully')
        databaseCleanupSuccess = true
      }
    } catch (dbError) {
      console.error('❌ Unexpected database error:', dbError)
      await logToAdmin(supabase, user.id, 'database_cleanup_unexpected_error', `Unexpected database error: ${dbError instanceof Error ? dbError.message : String(dbError)}`, {
        error: dbError instanceof Error ? dbError.message : String(dbError)
      })
    }

    // Step 3: Delete the user from Supabase Auth - FINAL CRITICAL STEP
    let authDeletionSuccess = false
    try {
      console.log('🔐 Attempting to delete user from Supabase Auth...')
      await logToAdmin(supabase, user.id, 'auth_deletion_started', 'Starting Supabase Auth user deletion')
      
      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(user.id)

      if (authDeleteError) {
        console.error('❌ Auth deletion error:', authDeleteError)
        await logToAdmin(supabase, user.id, 'auth_deletion_failed', `Auth deletion failed: ${authDeleteError.message}`, {
          error: authDeleteError.message,
          error_code: authDeleteError.code
        })
        
        return new Response(JSON.stringify({ 
          error: 'Failed to delete user from authentication system',
          details: authDeleteError.message,
          partial_success: {
            stripe_cleanup: stripeCleanupSuccess,
            database_cleanup: databaseCleanupSuccess
          }
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      authDeletionSuccess = true
      console.log(`✅ Auth deletion completed for user: ${user.id}`)
      
      // Final success log
      await logToAdmin(supabase, user.id, 'account_deletion_completed', 'Account deletion process completed successfully', {
        stripe_cleanup: stripeCleanupSuccess,
        database_cleanup: databaseCleanupSuccess,
        auth_deletion: authDeletionSuccess
      })

    } catch (authError) {
      console.error('❌ Unexpected auth error:', authError)
      await logToAdmin(supabase, user.id, 'auth_deletion_unexpected_error', `Unexpected auth deletion error: ${authError instanceof Error ? authError.message : String(authError)}`, {
        error: authError instanceof Error ? authError.message : String(authError)
      })
      
      return new Response(JSON.stringify({ 
        error: 'Unexpected error during authentication deletion',
        details: authError instanceof Error ? authError.message : String(authError)
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`🎉 Complete account deletion successful for user: ${user.id}`)

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Account deleted successfully. All subscriptions have been cancelled and no further charges will occur.',
      summary: {
        stripe_cleanup: stripeCleanupSuccess,
        database_cleanup: databaseCleanupSuccess,
        auth_deletion: authDeletionSuccess
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('❌ Unexpected delete account error:', error)
    
    // Try to log the error if we have the supabase client
    try {
      await logToAdmin(supabase, 'unknown', 'unexpected_deletion_error', `Unexpected error in delete account function: ${error instanceof Error ? error.message : String(error)}`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
    } catch (logError) {
      console.error('⚠️ Failed to log unexpected error:', logError)
    }
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})