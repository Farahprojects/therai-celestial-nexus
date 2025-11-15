-- Backfill user_images table from existing messages and image_generation_log
-- This populates the gallery with images that were generated before the user_images table existed

INSERT INTO user_images (user_id, chat_id, message_id, image_url, image_path, prompt, model, size, created_at)
SELECT DISTINCT ON (m.id)
  m.user_id,
  m.chat_id,
  m.id as message_id,
  m.meta->>'image_url' as image_url,
  m.meta->>'image_path' as image_path,
  m.meta->>'image_prompt' as prompt,
  m.meta->>'image_model' as model,
  m.meta->>'image_size' as size,
  m.created_at
FROM messages m
WHERE m.meta->>'message_type' = 'image'
  AND m.meta->>'image_url' IS NOT NULL
  AND m.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_images ui 
    WHERE ui.message_id = m.id
  )
ON CONFLICT DO NOTHING;
-- Also backfill from image_generation_log for images that might not have messages
INSERT INTO user_images (user_id, chat_id, image_url, model, created_at)
SELECT DISTINCT ON (igl.id)
  igl.user_id,
  igl.chat_id,
  igl.image_url,
  igl.model,
  igl.created_at
FROM image_generation_log igl
WHERE igl.image_url IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_images ui 
    WHERE ui.image_url = igl.image_url 
    AND ui.user_id = igl.user_id
    AND ABS(EXTRACT(EPOCH FROM (ui.created_at - igl.created_at))) < 60 -- Within 60 seconds
  )
ON CONFLICT DO NOTHING;
COMMENT ON TABLE user_images IS 'Backfilled from messages and image_generation_log - all user images now persist even after chat deletion';
