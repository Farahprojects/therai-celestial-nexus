-- Create dedicated user_images table for persistent image gallery
-- This table persists images even when chats/messages are deleted
-- Images are populated automatically when image generation completes

CREATE TABLE IF NOT EXISTS user_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  image_url text NOT NULL,
  image_path text, -- Storage path if applicable
  prompt text, -- Image generation prompt
  model text, -- Model used (e.g., 'imagen-4.0-fast-generate-001')
  size text, -- Image size (e.g., '1024x1024')
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_user_images_user_id ON user_images(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_images_chat_id ON user_images(chat_id) WHERE chat_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_images_message_id ON user_images(message_id) WHERE message_id IS NOT NULL;
-- Enable RLS
ALTER TABLE user_images ENABLE ROW LEVEL SECURITY;
-- RLS: Users can only view their own images
DROP POLICY IF EXISTS "Users can view own images" ON user_images;
CREATE POLICY "Users can view own images"
  ON user_images
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
-- RLS: Service role can insert/update/delete (for edge functions)
DROP POLICY IF EXISTS "Service role full access to user images" ON user_images;
CREATE POLICY "Service role full access to user images"
  ON user_images
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
-- RLS: Users can delete their own images (for cleanup)
DROP POLICY IF EXISTS "Users can delete own images" ON user_images;
CREATE POLICY "Users can delete own images"
  ON user_images
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
COMMENT ON TABLE user_images IS 'Persistent image gallery for users - images remain even when chats/messages are deleted';
COMMENT ON COLUMN user_images.chat_id IS 'Nullable - chat may be deleted but image persists';
COMMENT ON COLUMN user_images.message_id IS 'Nullable - message may be deleted but image persists';
