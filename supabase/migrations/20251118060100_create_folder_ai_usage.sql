-- Create folder_ai_usage table for tracking separate usage limits
CREATE TABLE IF NOT EXISTS public.folder_ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_count INTEGER NOT NULL DEFAULT 0,
  last_reset_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure one row per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_folder_ai_usage_user_id 
  ON public.folder_ai_usage(user_id);

-- Enable Row Level Security
ALTER TABLE public.folder_ai_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can read their own usage
CREATE POLICY "Users can read their own folder AI usage"
  ON public.folder_ai_usage
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policy: Service role can manage all usage (for edge functions)
CREATE POLICY "Service role can manage all folder AI usage"
  ON public.folder_ai_usage
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to increment usage count
CREATE OR REPLACE FUNCTION public.increment_folder_ai_usage(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert or update usage count
  INSERT INTO public.folder_ai_usage (user_id, operation_count, last_reset_at, updated_at)
  VALUES (p_user_id, 1, now(), now())
  ON CONFLICT (user_id)
  DO UPDATE SET
    operation_count = folder_ai_usage.operation_count + 1,
    updated_at = now();
END;
$$;

-- Function to check if user has reached limit
CREATE OR REPLACE FUNCTION public.check_folder_ai_limit(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 50
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
  v_last_reset TIMESTAMPTZ;
BEGIN
  -- Get current usage
  SELECT operation_count, last_reset_at
  INTO v_count, v_last_reset
  FROM public.folder_ai_usage
  WHERE user_id = p_user_id;

  -- If no record exists, user hasn't used it yet
  IF NOT FOUND THEN
    RETURN true;
  END IF;

  -- Reset if last reset was more than 24 hours ago
  IF v_last_reset < now() - INTERVAL '24 hours' THEN
    UPDATE public.folder_ai_usage
    SET operation_count = 0,
        last_reset_at = now(),
        updated_at = now()
    WHERE user_id = p_user_id;
    
    RETURN true;
  END IF;

  -- Check if under limit
  RETURN v_count < p_limit;
END;
$$;

-- Function to reset usage (for testing or admin purposes)
CREATE OR REPLACE FUNCTION public.reset_folder_ai_usage(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.folder_ai_usage
  SET operation_count = 0,
      last_reset_at = now(),
      updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

