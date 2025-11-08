-- Create audit table for image generation tracking
-- This table is immutable to prevent users from bypassing rate limits by deleting chats

CREATE TABLE IF NOT EXISTS image_generation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  image_url text,
  model text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast rate limit queries
CREATE INDEX IF NOT EXISTS idx_image_generation_log_user_date
  ON image_generation_log(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE image_generation_log ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only view their own logs
DROP POLICY IF EXISTS "Users can view own image generation logs" ON image_generation_log;
CREATE POLICY "Users can view own image generation logs"
  ON image_generation_log
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS: Service role has full access
DROP POLICY IF EXISTS "Service role full access to image generation logs" ON image_generation_log;
CREATE POLICY "Service role full access to image generation logs"
  ON image_generation_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- No INSERT/UPDATE/DELETE policies for authenticated users
-- Only service role can write to this table (audit integrity)

COMMENT ON TABLE image_generation_log IS 'Immutable audit log for image generation - used for rate limiting that persists even after chat deletion';
COMMENT ON COLUMN image_generation_log.chat_id IS 'Nullable - chat may be deleted but log persists for rate limiting';

