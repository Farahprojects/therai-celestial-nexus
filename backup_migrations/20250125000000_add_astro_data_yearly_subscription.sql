-- Add $30 yearly subscription for Therai Astro data
-- This subscription provides access to astro data for the Swiss route page

INSERT INTO price_list (id, endpoint, name, description, unit_price_usd, product_code, stripe_price_id)
VALUES (
  '30_yearly_astro',
  'subscription',
  'Therai Astro data',
  'Yearly subscription for astro data access on Swiss route page',
  30.00,
  'astro_data_yearly',
  'price_1SLKcqJ1YhE4Ljp0XwJpMogF'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  unit_price_usd = EXCLUDED.unit_price_usd,
  product_code = EXCLUDED.product_code,
  stripe_price_id = EXCLUDED.stripe_price_id;

-- Add comment
COMMENT ON TABLE price_list IS 'Product pricing catalog - includes Growth ($15), Premium ($25 with voice), test plan ($0.50), and Astro data yearly ($30)';
