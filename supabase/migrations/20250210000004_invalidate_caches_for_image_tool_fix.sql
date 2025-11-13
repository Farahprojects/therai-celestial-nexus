-- Invalidate all existing conversation caches
-- Reason: Image generation tool description was updated to prevent unwanted image generation
-- All caches will be recreated with the new stricter tool definition on next LLM request

DELETE FROM conversation_caches;

-- Add comment explaining the invalidation
COMMENT ON TABLE conversation_caches IS 'Stores Gemini API cache references. Invalidated 2025-02-10 to update image generation tool constraints.';






