-- Fix credit_transactions.reference_id to accept Stripe payment intent IDs
-- The reference_id field stores external IDs like Stripe payment intents (e.g., "pi_3SNOYqJ1YhE4Ljp01qe4iP09")
-- which are strings, not UUIDs

-- Step 1: Change the reference_id column type from uuid to text
ALTER TABLE credit_transactions 
ALTER COLUMN reference_id TYPE text USING reference_id::text;

-- Step 2: Update the add_credits function to accept text for reference_id
CREATE OR REPLACE FUNCTION public.add_credits(
  _user_id uuid, 
  _credits integer, 
  _amount_usd numeric, 
  _type text DEFAULT 'purchase'::text, 
  _reference_id text DEFAULT NULL::text,  -- Changed from uuid to text
  _description text DEFAULT NULL::text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  _current_credits integer;
  _new_credits integer;
BEGIN
  -- Lock row and get current balance
  SELECT credits INTO _current_credits
  FROM user_credits
  WHERE user_id = _user_id
  FOR UPDATE;
  
  -- Create record if doesn't exist
  IF _current_credits IS NULL THEN
    INSERT INTO user_credits (user_id, credits)
    VALUES (_user_id, _credits)
    RETURNING credits INTO _new_credits;
  ELSE
    -- Add credits
    _new_credits := _current_credits + _credits;
    UPDATE user_credits
    SET credits = _new_credits, last_updated = now()
    WHERE user_id = _user_id;
  END IF;
  
  -- Log transaction
  INSERT INTO credit_transactions (user_id, type, credits, amount_usd, reference_id, description)
  VALUES (_user_id, _type, _credits, _amount_usd, _reference_id, _description);
  
  RETURN true;
END;
$function$;

