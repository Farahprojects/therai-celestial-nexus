-- Voice usage tracking schema and helpers
-- Note: SQL already applied in production; saved here for history.

-- 1. Voice usage table and index
CREATE TABLE IF NOT EXISTS public.voice_usage (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  seconds_used INTEGER NOT NULL DEFAULT 0,
  billing_cycle_start DATE NOT NULL,
  billing_cycle_end DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_usage_cycle_end ON public.voice_usage (billing_cycle_end);

-- Enable RLS and policies
ALTER TABLE public.voice_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view own voice usage"
  ON public.voice_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Service role manages voice usage"
  ON public.voice_usage FOR ALL
  USING (auth.role() = 'service_role');

-- 2. Billing cycle helper
CREATE OR REPLACE FUNCTION public.get_current_billing_cycle(p_user_id UUID)
RETURNS TABLE(cycle_start DATE, cycle_end DATE) AS $$
DECLARE
  v_subscription_start DATE;
  v_day_of_month INTEGER;
  v_current_date DATE := CURRENT_DATE;
  v_cycle_start DATE;
  v_cycle_end DATE;
BEGIN
  -- Get subscription start date from profiles
  SELECT subscription_start_date::DATE INTO v_subscription_start
  FROM public.profiles
  WHERE id = p_user_id;

  -- If no subscription, default to account creation date
  IF v_subscription_start IS NULL THEN
    SELECT created_at::DATE INTO v_subscription_start
    FROM public.profiles
    WHERE id = p_user_id;
  END IF;

  -- Guard against missing profile entry
  IF v_subscription_start IS NULL THEN
    RAISE EXCEPTION 'No profile found for user %', p_user_id;
  END IF;

  -- Get day of month from subscription (e.g., 15 from 2025-01-15)
  v_day_of_month := EXTRACT(DAY FROM v_subscription_start);

  -- Calculate current billing cycle
  v_cycle_start := MAKE_DATE(
    EXTRACT(YEAR FROM v_current_date)::INTEGER,
    EXTRACT(MONTH FROM v_current_date)::INTEGER,
    LEAST(
      v_day_of_month,
      EXTRACT(DAY FROM DATE_TRUNC('month', v_current_date) + INTERVAL '1 month - 1 day')::INTEGER
    )
  );

  -- If current date is before cycle start day this month, go back one month
  IF v_current_date < v_cycle_start THEN
    v_cycle_start := v_cycle_start - INTERVAL '1 month';
  END IF;

  -- Cycle ends one month later
  v_cycle_end := v_cycle_start + INTERVAL '1 month';

  RETURN QUERY SELECT v_cycle_start, v_cycle_end;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Increment helper
CREATE OR REPLACE FUNCTION public.increment_voice_usage(
  p_user_id UUID,
  p_seconds INTEGER
) RETURNS VOID AS $$
DECLARE
  v_cycle_start DATE;
  v_cycle_end DATE;
BEGIN
  -- Get current billing cycle
  SELECT cycle_start, cycle_end INTO v_cycle_start, v_cycle_end
  FROM public.get_current_billing_cycle(p_user_id);

  -- Upsert entry for current cycle
  INSERT INTO public.voice_usage (
    user_id,
    seconds_used,
    billing_cycle_start,
    billing_cycle_end,
    updated_at
  )
  VALUES (p_user_id, p_seconds, v_cycle_start, v_cycle_end, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    seconds_used = CASE
      WHEN public.voice_usage.billing_cycle_end >= v_cycle_end
        THEN public.voice_usage.seconds_used + p_seconds
      ELSE p_seconds
    END,
    billing_cycle_start = v_cycle_start,
    billing_cycle_end = v_cycle_end,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Voice limit check
CREATE OR REPLACE FUNCTION public.check_voice_limit(
  p_user_id UUID,
  p_requested_seconds INTEGER DEFAULT 0
) RETURNS JSONB AS $$
DECLARE
  v_plan_id TEXT;
  v_limit INTEGER;
  v_current_usage INTEGER := 0;
  v_subscription_active BOOLEAN;
BEGIN
  -- Get user's plan info
  SELECT subscription_plan, subscription_active
  INTO v_plan_id, v_subscription_active
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_plan_id IS NULL THEN
    v_plan_id := 'free';
  END IF;

  -- Determine plan limit
  SELECT voice_seconds_limit INTO v_limit
  FROM public.plan_limits
  WHERE plan_id = v_plan_id
    AND is_active = TRUE;

  -- NULL limit means unlimited usage
  IF v_limit IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', TRUE,
      'is_unlimited', TRUE,
      'seconds_used', 0,
      'limit', NULL
    );
  END IF;

  -- Fetch current usage (treat no-row as 0)
  SELECT COALESCE(seconds_used, 0) INTO v_current_usage
  FROM public.voice_usage
  WHERE user_id = p_user_id;
  
  -- If no row exists, SELECT INTO leaves variable unchanged (already 0)
  -- But to be explicit, we check FOUND
  IF NOT FOUND THEN
    v_current_usage := 0;
  END IF;

  -- Evaluate allowance
  IF v_current_usage + p_requested_seconds <= v_limit THEN
    RETURN jsonb_build_object(
      'allowed', TRUE,
      'is_unlimited', FALSE,
      'seconds_used', v_current_usage,
      'remaining', v_limit - v_current_usage,
      'limit', v_limit
    );
  ELSE
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'is_unlimited', FALSE,
      'seconds_used', v_current_usage,
      'remaining', GREATEST(0, v_limit - v_current_usage),
      'limit', v_limit,
      'reason', 'Voice limit exceeded for current billing cycle'
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

