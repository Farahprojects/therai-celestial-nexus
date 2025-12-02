-- Create user_profile_list table for saving birth data profiles
-- Each row represents one person's birth data that can be reused
-- Both primary and secondary persons from forms get their own row

CREATE TABLE IF NOT EXISTS user_profile_list (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User who owns this profile
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Profile identification
  profile_name TEXT NOT NULL, -- User-friendly name for this profile (e.g., "My Birth Data", "John's Profile")
  
  -- Person's basic info
  name TEXT NOT NULL, -- Person's name
  
  -- Birth date and time
  birth_date TEXT NOT NULL, -- Format: YYYY-MM-DD
  birth_time TEXT NOT NULL, -- Format: HH:MM
  
  -- Birth location data
  birth_location TEXT NOT NULL, -- Full location name (e.g., "New York, NY, USA")
  birth_latitude DOUBLE PRECISION, -- Latitude coordinate
  birth_longitude DOUBLE PRECISION, -- Longitude coordinate
  birth_place_id TEXT, -- Google Places ID for location accuracy
  
  -- Optional astrology fields
  timezone TEXT, -- Timezone (e.g., "America/New_York")
  house_system TEXT, -- House system for astrology calculations
  
  -- Optional notes
  notes TEXT, -- User notes about this profile
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_user_profile_list_user_id ON user_profile_list(user_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_user_profile_list_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_profile_list_updated_at_trigger ON user_profile_list;
CREATE TRIGGER update_user_profile_list_updated_at_trigger
  BEFORE UPDATE ON user_profile_list
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profile_list_updated_at();

-- Add RLS (Row Level Security) policies
ALTER TABLE user_profile_list ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own profiles
CREATE POLICY "Users can view their own profiles"
  ON user_profile_list
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own profiles
CREATE POLICY "Users can insert their own profiles"
  ON user_profile_list
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own profiles
CREATE POLICY "Users can update their own profiles"
  ON user_profile_list
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own profiles
CREATE POLICY "Users can delete their own profiles"
  ON user_profile_list
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE user_profile_list IS 'Stores saved birth data profiles for quick reuse in forms. Each person (primary or secondary) gets their own row.';
COMMENT ON COLUMN user_profile_list.profile_name IS 'User-friendly name for this saved profile';
COMMENT ON COLUMN user_profile_list.name IS 'Person''s actual name';
COMMENT ON COLUMN user_profile_list.birth_date IS 'Birth date in YYYY-MM-DD format';
COMMENT ON COLUMN user_profile_list.birth_time IS 'Birth time in HH:MM format';
COMMENT ON COLUMN user_profile_list.birth_location IS 'Full location name as entered by user';
COMMENT ON COLUMN user_profile_list.birth_place_id IS 'Google Places API place_id for precise location matching';
