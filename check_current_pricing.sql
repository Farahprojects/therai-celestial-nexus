-- Query to check current subscription plans in price_list table
SELECT 
  id,
  endpoint,
  name,
  description,
  unit_price_usd,
  product_code,
  stripe_price_id
FROM price_list 
WHERE endpoint = 'subscription' 
ORDER BY unit_price_usd;

-- Also check if there are any other pricing entries
SELECT 
  id,
  endpoint,
  name,
  description,
  unit_price_usd
FROM price_list 
ORDER BY endpoint, unit_price_usd;
