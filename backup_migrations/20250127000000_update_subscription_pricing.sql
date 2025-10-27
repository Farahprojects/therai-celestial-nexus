-- Update subscription pricing
-- Keep test plan ($0.50) and update Growth to $10/month
-- Remove Premium ($25) and Astro yearly ($30)

-- Remove Premium $25/month plan
DELETE FROM price_list WHERE id = '25_monthly' AND endpoint = 'subscription';

-- Remove Astro $30/year plan
DELETE FROM price_list WHERE id = '30_yearly_astro' AND endpoint = 'subscription';

-- Update Growth plan from $15 to $10 with new Stripe price ID
UPDATE price_list 
SET 
  unit_price_usd = 10.00,
  stripe_price_id = 'price_1SJ7e6J1YhE4Ljp06kfxhNc5',
  name = 'Growth',
  description = 'Unlimited text conversations and reports'
WHERE id = '15_monthly' AND endpoint = 'subscription';

-- Update comment
COMMENT ON TABLE price_list IS 'Product pricing catalog - Test plan ($0.50) and Growth ($10/month)';

