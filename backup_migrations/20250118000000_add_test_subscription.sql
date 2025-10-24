-- Add test subscription plan for 50 cents
-- This is a temporary test product that will be removed after testing

INSERT INTO price_list (id, endpoint, name, description, unit_price_usd, product_code, stripe_price_id)
VALUES (
  'test_50c',
  'subscription',
  'Test Plan',
  'Test subscription for 50 cents - for testing only',
  0.50,
  'test_subscription',
  'price_1SJRokJ1YhE4Ljp0ObrRBhio'
)
ON CONFLICT (id) DO UPDATE SET
  stripe_price_id = EXCLUDED.stripe_price_id,
  unit_price_usd = EXCLUDED.unit_price_usd,
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- Add comment
COMMENT ON COLUMN price_list.stripe_price_id IS 'Stripe Price ID for subscription/payment processing - test plan added for testing';

