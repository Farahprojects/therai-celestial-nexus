-- Update deduct_credits function to remove topup_queue reference
CREATE OR REPLACE FUNCTION public.deduct_credits(_user_id uuid, _credits integer, _endpoint text, _reference_id uuid DEFAULT NULL::uuid, _description text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
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
    VALUES (_user_id, 0)
    RETURNING credits INTO _current_credits;
  END IF;
  
  -- Check sufficient balance
  IF _current_credits < _credits THEN
    RAISE EXCEPTION 'Insufficient credits: % < %', _current_credits, _credits;
  END IF;
  
  -- Deduct credits
  _new_credits := _current_credits - _credits;
  UPDATE user_credits
  SET credits = _new_credits, last_updated = now()
  WHERE user_id = _user_id;
  
  -- Log transaction
  INSERT INTO credit_transactions (user_id, type, credits, endpoint, reference_id, description)
  VALUES (_user_id, 'deduct', _credits, _endpoint, _reference_id, _description);
  
  RETURN true;
END;
$function$;

-- Drop clean_completed_topups function (references topup_queue)
DROP FUNCTION IF EXISTS public.clean_completed_topups();