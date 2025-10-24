-- Update subscription plans
-- Growth ($15/month) - text only
-- Premium ($25/month) - includes voice features
-- Keep test plan ($0.50) for testing

-- Remove old $10 plan
DELETE FROM price_list WHERE id = '10_monthly' AND endpoint = 'subscription';

-- Add or update Growth $15 plan
INSERT INTO price_list (id, endpoint, name, description, unit_price_usd, product_code, stripe_price_id)
VALUES (
  '15_monthly',
  'subscription',
  'Growth',
  'Unlimited text conversations and reports',
  15.00,
  'growth_monthly',
  'price_1SJ7hMJ1YhE4Ljp0fVAM2xmx'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  unit_price_usd = EXCLUDED.unit_price_usd,
  product_code = EXCLUDED.product_code,
  stripe_price_id = EXCLUDED.stripe_price_id;

-- Add or update Premium $25 plan with voice features
INSERT INTO price_list (id, endpoint, name, description, unit_price_usd, product_code, stripe_price_id)
VALUES (
  '25_monthly',
  'subscription',
  'Premium',
  'Unlimited conversations, reports, and voice features',
  25.00,
  'premium_voice_monthly',
  'price_1SLCJQJ1YhE4Ljp03qpxRK22'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  unit_price_usd = EXCLUDED.unit_price_usd,
  product_code = EXCLUDED.product_code,
  stripe_price_id = EXCLUDED.stripe_price_id;

-- Add comment
COMMENT ON TABLE price_list IS 'Product pricing catalog - Growth ($15) and Premium ($25 with voice), plus test plan';

