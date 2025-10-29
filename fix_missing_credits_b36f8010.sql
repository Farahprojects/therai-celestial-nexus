-- Manual credit addition for failed Stripe payment
-- User ID: b36f8010-aa1b-4433-9a9f-26d50f9a56fd
-- Payment Intent: pi_3SNOYqJ1YhE4Ljp01qe4iP09
-- Amount: $5.00 = 50 credits

-- NOTE: Run this AFTER applying the migration in 20251029_fix_credit_transactions_reference_id.sql

-- Add the 50 credits for the $5 payment
SELECT add_credits(
  'b36f8010-aa1b-4433-9a9f-26d50f9a56fd'::uuid,  -- your user_id
  50,  -- credits ($5 @ $0.10/credit)
  5.00,  -- amount_usd
  'manual_correction',  -- type
  'pi_3SNOYqJ1YhE4Ljp01qe4iP09',  -- Stripe payment intent ID
  'Manual correction for failed webhook processing on 2025-10-29 - Payment succeeded in Stripe but credits not added due to UUID type mismatch error'  -- description
);

-- Verify the credits were added
SELECT 
  user_id,
  credits,
  last_updated
FROM user_credits 
WHERE user_id = 'b36f8010-aa1b-4433-9a9f-26d50f9a56fd';

-- Check the transaction was logged
SELECT 
  id,
  type,
  credits,
  amount_usd,
  reference_id,
  description,
  created_at
FROM credit_transactions 
WHERE user_id = 'b36f8010-aa1b-4433-9a9f-26d50f9a56fd' 
ORDER BY created_at DESC 
LIMIT 1;

