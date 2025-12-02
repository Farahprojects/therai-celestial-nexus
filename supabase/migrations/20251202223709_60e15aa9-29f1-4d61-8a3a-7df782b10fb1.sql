-- Drop topup_queue table and related function
DROP TABLE IF EXISTS public.topup_queue;

-- Drop the check_balance_for_topup function (no longer needed)
DROP FUNCTION IF EXISTS public.check_balance_for_topup();