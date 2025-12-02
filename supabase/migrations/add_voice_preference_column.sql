-- Add voice preference column to user_preferences table
-- This will store the selected TTS voice for each user

ALTER TABLE user_preferences 
ADD COLUMN tts_voice TEXT DEFAULT 'Puck';

-- Add a comment to document the column
COMMENT ON COLUMN user_preferences.tts_voice IS 'User selected TTS voice name (e.g., Puck, Achernar, etc.)';

-- Optional: Add a check constraint to ensure valid voice names
-- (Uncomment if you want to enforce valid voice options)
/*
ALTER TABLE user_preferences 
ADD CONSTRAINT check_valid_voice 
CHECK (tts_voice IN (
  'Puck', 'Algenib', 'Enceladus', 'Orus', 
  'Achernar', 'Aoede', 'Leda', 'Sulafat', 'Zephyr'
));
*/
