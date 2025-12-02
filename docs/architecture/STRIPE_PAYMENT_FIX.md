# Stripe Payment Credit System Fix

## Issue Summary

**Problem:** Payments succeed in Stripe, but credits are not added to user accounts.

**Root Cause:** The `credit_transactions.reference_id` column was defined as type `uuid`, but Stripe payment intent IDs are strings (e.g., `pi_3SNOYqJ1YhE4Ljp01qe4iP09`). This causes a PostgreSQL type mismatch error when the webhook handler tries to log the transaction.

**Error Message:**
```
[Webhook] Failed to add credits for user b36f8010-aa1b-4433-9a9f-26d50f9a56fd: {
  code: "22P02",
  details: null,
  hint: null,
  message: 'invalid input syntax for type uuid: "pi_3SNOYqJ1YhE4Ljp01qe4iP09"'
}
```

## Payment Flow (Before Fix)

1. ✅ User completes payment in Stripe ($5)
2. ✅ Stripe sends `payment_intent.succeeded` webhook
3. ✅ Webhook handler receives event and extracts metadata
4. ✅ Handler calls `add_credits()` RPC function
5. ❌ Function fails trying to insert Stripe payment intent ID into UUID column
6. ❌ Credits NOT added to `user_credits` table
7. ❌ Transaction NOT logged in `credit_transactions` table

## Solution Applied

### Migration: `20251029_fix_credit_transactions_reference_id.sql`

1. **Changed column type**: `credit_transactions.reference_id` from `uuid` to `text`
2. **Updated function**: `add_credits()` now accepts `text` for `_reference_id` parameter

### Why This Fix Works

- Stripe payment intent IDs are strings by design
- The `reference_id` field is meant to store external IDs from various systems (Stripe, etc.)
- Using `text` type allows flexibility for different external ID formats
- No changes needed to webhook handler code

## Applying the Fix

### 1. Apply the Migration

```bash
# Push the migration to Supabase
npx supabase db push

# OR if using Supabase CLI directly
supabase db push
```

### 2. Verify the Migration

```sql
-- Check the column type
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'credit_transactions' 
AND column_name = 'reference_id';

-- Should return: data_type = 'text'
```

### 3. Check Function Signature

```sql
-- View the updated function
SELECT 
  routine_name,
  parameter_name,
  data_type
FROM information_schema.parameters
WHERE routine_name = 'add_credits'
ORDER BY ordinal_position;

-- The _reference_id parameter should now be 'text' type
```

## Testing After Fix

### Test 1: Make a Test Payment

1. Go to your app's checkout page
2. Make a small test payment (e.g., $1 for 10 credits)
3. Check the webhook logs in Supabase Dashboard > Edge Functions > stripe-webhook-handler
4. Look for: `[Webhook] ✅ Successfully credited X credits to user Y`

### Test 2: Verify Database

```sql
-- Check user credits
SELECT * FROM user_credits WHERE user_id = 'YOUR_USER_ID';

-- Check transaction log
SELECT * FROM credit_transactions 
WHERE user_id = 'YOUR_USER_ID' 
ORDER BY created_at DESC 
LIMIT 5;

-- Verify the reference_id now contains Stripe payment intent IDs
SELECT reference_id, credits, amount_usd, description
FROM credit_transactions
WHERE reference_id LIKE 'pi_%'
ORDER BY created_at DESC;
```

### Test 3: Check topup_logs

```sql
-- Verify the topup was logged
SELECT * FROM topup_logs 
WHERE user_id = 'YOUR_USER_ID' 
ORDER BY created_at DESC;
```

## Handling Your Failed $5 Payment

Your $5 payment succeeded in Stripe but the credits were never added. After applying this migration, you have two options:

### Option A: Manual Credit Addition (Recommended)

Run this SQL to manually add the missing credits:

```sql
-- Replace with your actual values
SELECT add_credits(
  'b36f8010-aa1b-4433-9a9f-26d50f9a56fd'::uuid,  -- your user_id
  50,  -- credits (adjust based on your $5 package)
  5.00,  -- amount_usd
  'manual_correction',  -- type
  'pi_3SNOYqJ1YhE4Ljp01qe4iP09',  -- the failed payment intent ID
  'Manual correction for failed webhook processing on 2025-10-29'  -- description
);

-- Verify it worked
SELECT * FROM user_credits WHERE user_id = 'b36f8010-aa1b-4433-9a9f-26d50f9a56fd';
SELECT * FROM credit_transactions WHERE user_id = 'b36f8010-aa1b-4433-9a9f-26d50f9a56fd' ORDER BY created_at DESC LIMIT 1;
```

### Option B: Replay the Webhook

1. Go to Stripe Dashboard > Developers > Webhooks
2. Find your webhook endpoint
3. Click on the failed event
4. Click "Resend event" button
5. The webhook will process again with the fixed function

## Prevention

This fix ensures:
- ✅ All future payments will process correctly
- ✅ Stripe payment intent IDs are properly stored
- ✅ Transaction audit trail is maintained
- ✅ Credits are added atomically with transaction logging

## Monitoring

After deploying, monitor these for the next few payments:

1. **Webhook logs** (Supabase Dashboard > Edge Functions > stripe-webhook-handler)
   - Look for success messages
   - No more UUID errors

2. **Database consistency**
   - `user_credits.credits` increases correctly
   - `credit_transactions` has matching entries
   - `topup_logs` records payment details

3. **Stripe Dashboard**
   - Webhook delivery success rate should be 100%
   - Check Events & Logs section

## Related Tables

### user_credits
- Stores current credit balance per user
- Updated by `add_credits()` function

### credit_transactions  
- Audit log of all credit changes
- **Fixed column**: `reference_id` (now `text` instead of `uuid`)

### topup_logs
- Tracks payment attempts and Stripe metadata
- Logged separately in webhook handler

## Need Help?

If issues persist:
1. Check Supabase logs for detailed error messages
2. Verify the migration applied successfully
3. Test with a small payment amount first
4. Contact Stripe support if payments aren't reaching webhooks

