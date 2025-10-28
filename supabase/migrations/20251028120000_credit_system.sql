-- Credit System Migration
-- Replaces subscription system with credit-based pricing
-- Credits are purchased at $0.10 per credit (minimum $5 = 50 credits)

-- 1. Drop existing user_credits table and recreate
DROP TABLE IF EXISTS user_credits CASCADE;

CREATE TABLE user_credits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  credits integer NOT NULL DEFAULT 0,
  auto_topup_enabled boolean DEFAULT false,
  auto_topup_threshold integer DEFAULT 10, -- ~$1 threshold (10 credits @ $0.10 each)
  auto_topup_amount integer DEFAULT 50, -- $5 package (50 credits @ $0.10 each)
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- RLS policies for user_credits
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credits" 
  ON user_credits 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access" 
  ON user_credits 
  FOR ALL 
  USING (auth.role() = 'service_role');

-- 2. Create credit_transactions table
CREATE TABLE credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('purchase', 'deduct', 'refund', 'auto_topup')),
  credits integer NOT NULL,
  amount_usd numeric(10,2), -- Only for purchases
  description text,
  reference_id uuid, -- Link to stripe payment or chat message
  endpoint text, -- e.g., 'chat-send', 'translator-edge'
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_credit_transactions_user ON credit_transactions(user_id, created_at DESC);

-- RLS policies for credit_transactions
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" 
  ON credit_transactions 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on transactions" 
  ON credit_transactions 
  FOR ALL 
  USING (auth.role() = 'service_role');

-- 3. Update topup_logs table
ALTER TABLE topup_logs ADD COLUMN IF NOT EXISTS credits integer;
ALTER TABLE topup_logs ADD COLUMN IF NOT EXISTS is_auto_topup boolean DEFAULT false;

-- 4. Create credit deduction function
CREATE OR REPLACE FUNCTION deduct_credits(
  _user_id uuid,
  _credits integer,
  _endpoint text,
  _reference_id uuid DEFAULT NULL,
  _description text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _current_credits integer;
  _new_credits integer;
  _auto_topup_enabled boolean;
  _auto_topup_threshold integer;
  _auto_topup_amount integer;
BEGIN
  -- Lock row and get current balance
  SELECT credits, auto_topup_enabled, auto_topup_threshold, auto_topup_amount 
  INTO _current_credits, _auto_topup_enabled, _auto_topup_threshold, _auto_topup_amount
  FROM user_credits
  WHERE user_id = _user_id
  FOR UPDATE;
  
  -- Create record if doesn't exist
  IF _current_credits IS NULL THEN
    INSERT INTO user_credits (user_id, credits)
    VALUES (_user_id, 0)
    RETURNING credits, auto_topup_enabled, auto_topup_threshold, auto_topup_amount 
    INTO _current_credits, _auto_topup_enabled, _auto_topup_threshold, _auto_topup_amount;
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
  
  -- Check if auto top-up should trigger
  IF _auto_topup_enabled AND _new_credits <= _auto_topup_threshold THEN
    -- Insert into topup_queue for processing
    INSERT INTO topup_queue (user_id, amount_usd, status, message)
    VALUES (
      _user_id, 
      (_auto_topup_amount * 0.10), 
      'pending', 
      'Auto top-up triggered: balance dropped to ' || _new_credits || ' credits'
    );
  END IF;
  
  RETURN true;
END;
$$;

-- 5. Create function to add credits
CREATE OR REPLACE FUNCTION add_credits(
  _user_id uuid,
  _credits integer,
  _amount_usd numeric,
  _type text DEFAULT 'purchase',
  _reference_id uuid DEFAULT NULL,
  _description text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- 6. Create function to update auto top-up settings
CREATE OR REPLACE FUNCTION update_auto_topup_settings(
  _user_id uuid,
  _enabled boolean,
  _threshold integer,
  _amount integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Ensure user_credits record exists
  INSERT INTO user_credits (user_id, auto_topup_enabled, auto_topup_threshold, auto_topup_amount)
  VALUES (_user_id, _enabled, _threshold, _amount)
  ON CONFLICT (user_id) DO UPDATE
  SET 
    auto_topup_enabled = _enabled,
    auto_topup_threshold = _threshold,
    auto_topup_amount = _amount,
    last_updated = now();
  
  RETURN true;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION deduct_credits TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION add_credits TO service_role;
GRANT EXECUTE ON FUNCTION update_auto_topup_settings TO service_role, authenticated;

