-- Update or insert $10/month starter plan in price_list
-- This is a starter offer at $10/month for early customers

-- Add stripe_price_id column if it doesn't exist
ALTER TABLE price_list ADD COLUMN IF NOT EXISTS stripe_price_id text;

-- Clean up existing subscription plans
DELETE FROM price_list WHERE endpoint = 'subscription';

-- Insert the single $10/month Premium plan
INSERT INTO price_list (id, endpoint, name, description, unit_price_usd, product_code, stripe_price_id)
VALUES (
  '10_monthly',
  'subscription',
  'Premium',
  'Unlimited conversations, reports, and voice features',
  10.00,
  'premium_monthly',
  'price_1SJ7e6J1YhE4Ljp06kfxhNc5'
);

-- Add comment
COMMENT ON TABLE price_list IS 'Product pricing catalog - simplified to single $10/month subscription plan';
COMMENT ON COLUMN price_list.stripe_price_id IS 'Stripe Price ID for subscription/payment processing';

