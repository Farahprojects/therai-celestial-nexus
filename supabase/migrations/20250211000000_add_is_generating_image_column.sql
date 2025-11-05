-- Add is_generating_image boolean column to messages table
-- This column signals when an image is being generated for reliable skeleton rendering

ALTER TABLE messages 
ADD COLUMN is_generating_image boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN messages.is_generating_image IS 'True when image generation is in progress, triggers skeleton UI';

